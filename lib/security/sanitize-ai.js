/**
 * Security utility for sanitizing AI-generated responses
 * Prevents XSS attacks from LLM outputs
 */

const DANGEROUS_PATTERNS = [
  /<script[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi, // event handlers like onclick=, onload=
  /<iframe[\s\S]*?<\/iframe>/gi,
  /<object[\s\S]*?<\/object>/gi,
  /<embed[\s\S]*?>/gi,
  /eval\(/gi,
  /expression\(/gi,
  /vbscript:/gi,
  /data:text\/html/gi,
];

const HTML_ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
};

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text) {
  if (typeof text !== "string") {
    return String(text);
  }
  return text.replace(/[&<>"'\/]/g, (char) => HTML_ENTITIES[char]);
}

/**
 * Check if text contains dangerous patterns
 */
export function containsDangerousPatterns(text) {
  if (typeof text !== "string") return false;
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Sanitize AI response - remove/escape dangerous content
 */
export function sanitizeAIResponse(response) {
  if (typeof response !== "string") {
    return String(response);
  }

  let sanitized = response;

  // Remove dangerous patterns
  DANGEROUS_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, "");
  });

  // Escape remaining HTML to be safe
  sanitized = escapeHtml(sanitized);

  // Unescape safe markdown-like formatting (common in AI outputs)
  // This is conservative - only allow basic formatting
  sanitized = sanitized
    .replace(/&lt;b&gt;/g, "<b>")
    .replace(/&lt;&#x2F;b&gt;/g, "</b>")
    .replace(/&lt;strong&gt;/g, "<strong>")
    .replace(/&lt;&#x2F;strong&gt;/g, "</strong>")
    .replace(/&lt;em&gt;/g, "<em>")
    .replace(/&lt;&#x2F;em&gt;/g, "</em>")
    .replace(/&lt;br&gt;/g, "<br>")
    .replace(/&lt;br&#x2F;&gt;/g, "<br>")
    .replace(/&lt;p&gt;/g, "<p>")
    .replace(/&lt;&#x2F;p&gt;/g, "</p>");

  return sanitized;
}

/**
 * Sanitize JSON response from AI (for structured outputs)
 */
export function sanitizeJSONResponse(jsonString) {
  if (typeof jsonString !== "string") {
    return JSON.stringify(jsonString);
  }

  let sanitized = jsonString;

  // Remove markdown code blocks if present
  sanitized = sanitized.replace(/```json\n?/g, "").replace(/```\n?/g, "");

  // Try to parse and validate JSON
  try {
    const parsed = JSON.parse(sanitized);
    
    // Recursively sanitize string values in JSON
    const sanitizeObject = (obj) => {
      if (typeof obj === "string") {
        return sanitizeAIResponse(obj);
      } else if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      } else if (obj !== null && typeof obj === "object") {
        const sanitized = {};
        for (const key in obj) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
        return sanitized;
      }
      return obj;
    };

    const sanitizedParsed = sanitizeObject(parsed);
    return JSON.stringify(sanitizedParsed);
  } catch (error) {
    // If JSON parsing fails, return escaped plain text
    console.warn("Failed to parse JSON response for sanitization:", error);
    return JSON.stringify({ error: "Invalid response format" });
  }
}

/**
 * Sanitize array of AI responses
 */
export function sanitizeAIResponses(responses) {
  if (!Array.isArray(responses)) {
    return sanitizeAIResponse(responses);
  }

  return responses.map((response) => {
    if (typeof response === "object" && response !== null) {
      return Object.keys(response).reduce((acc, key) => {
        acc[key] = sanitizeAIResponse(response[key]);
        return acc;
      }, {});
    }
    return sanitizeAIResponse(response);
  });
}

/**
 * Middleware-ready function to sanitize chat responses
 */
export function createSanitizedChatResponse(message, metadata = {}) {
  return {
    message: sanitizeAIResponse(message),
    ...metadata,
  };
}

/**
 * Sanitize insight card responses
 */
export function sanitizeInsights(insights) {
  if (!Array.isArray(insights)) return [];

  return insights.map((insight) => ({
    type: insight.type || "info", // Validate type
    icon: insight.icon || "💡", // Validate emoji
    message: sanitizeAIResponse(insight.message),
    detail: sanitizeAIResponse(insight.detail),
  }));
}

/**
 * Test function to validate sanitization
 * (remove before production if desired)
 */
export function testSanitization() {
  const testCases = [
    '<script>alert("xss")</script>Safe text',
    'onclick="alert()" Safe text',
    '<img src=x onerror="alert()"> Safe text',
    'Normal text with **markdown**',
    '{"message": "<script>alert()</script>"}',
  ];

  return testCases.map((test) => ({
    original: test,
    sanitized: sanitizeAIResponse(test),
    dangerousDetected: containsDangerousPatterns(test),
  }));
}
