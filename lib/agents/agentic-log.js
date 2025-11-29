export function agenticLog(userId, capability, context = {}) {
  try {
    console.log(
      JSON.stringify({
        agent: "rhythmic-ai-master",
        userId,
        capability,
        timestamp: new Date().toISOString(),
        context,
      })
    );
  } catch (error) {
    console.log("[agentic-log]", capability, context, error?.message);
  }
}
