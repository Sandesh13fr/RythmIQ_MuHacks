import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import {
  AGENT_TRIGGERS,
  ALLOWED_AGENT_SLUGS,
  MASTER_AGENT_SLUG,
  FAN_OUT_CHILDREN,
} from "@/lib/agents/agent-trigger-registry";

const DEFAULT_INNGEST_DEV_SERVER = "http://127.0.0.1:8288";

function resolveInngestBaseUrl() {
  return process.env.INNGEST_DEV_SERVER_URL || DEFAULT_INNGEST_DEV_SERVER;
}

async function triggerSingleAgent(baseUrl, slug, payload = {}) {
  const targetUrl = `${baseUrl}/fn/${slug}`;

  const response = await fetch(targetUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`Inngest responded with ${response.status}`);
    error.detail = text.slice(0, 500);
    throw error;
  }

  return {
    status: response.status,
    detail: text.slice(0, 500),
  };
}

export async function POST(request) {
  const user = await currentUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = body?.slug;
  if (!slug || !ALLOWED_AGENT_SLUGS.has(slug)) {
    return NextResponse.json({ error: "Unknown agent slug" }, { status: 400 });
  }

  const baseUrl = resolveInngestBaseUrl();

  try {
    if (slug === MASTER_AGENT_SLUG) {
      const childResults = [];
      for (const childSlug of FAN_OUT_CHILDREN) {
        const childMeta = AGENT_TRIGGERS.find((agent) => agent.slug === childSlug);
        try {
          const result = await triggerSingleAgent(baseUrl, childSlug, body?.payload || {});
          childResults.push({
            slug: childSlug,
            label: childMeta?.label || childSlug,
            success: true,
            detail: result.detail,
          });
        } catch (error) {
          childResults.push({
            slug: childSlug,
            label: childMeta?.label || childSlug,
            success: false,
            detail: error.detail || error.message,
          });
        }
      }

      const successCount = childResults.filter((item) => item.success).length;
      const agent = AGENT_TRIGGERS.find((item) => item.slug === slug);
      return NextResponse.json({
        success: successCount === childResults.length,
        agent,
        summary: `Triggered ${successCount}/${childResults.length} agents`,
        children: childResults,
      });
    }

    const result = await triggerSingleAgent(baseUrl, slug, body?.payload || {});
    const agent = AGENT_TRIGGERS.find((item) => item.slug === slug);
    return NextResponse.json({ success: true, agent, detail: result.detail });
  } catch (error) {
    return NextResponse.json(
      {
        error: error.message || "Failed to reach Inngest dev server",
        detail: error.detail || "",
      },
      { status: 502 }
    );
  }
}
