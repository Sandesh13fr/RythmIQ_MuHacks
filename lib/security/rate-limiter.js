/**
 * In-memory rate limiter for AI endpoints
 * Tracks requests per user to prevent abuse
 */

const DEFAULT_LIMITS = {
  "/api/RythmIQ-ai/chat": { requests: 30, windowMs: 60 * 1000 }, // 30 req/min
  "/api/RythmIQ-ai/search": { requests: 20, windowMs: 60 * 1000 }, // 20 req/min
  "/api/RythmIQ-ai/insights": { requests: 10, windowMs: 60 * 1000 }, // 10 req/min
  "/api/RythmIQ-ai/predict": { requests: 5, windowMs: 60 * 1000 }, // 5 req/min (forecasts are expensive)
  "/api/RythmIQ-ai/jarvis": { requests: 10, windowMs: 60 * 1000 }, // 10 req/min
};

const requestStore = new Map(); // userId -> { endpoint -> [timestamps] }

/**
 * Get current rate limit window
 */
function getWindowKey() {
  return Math.floor(Date.now() / 60000); // 1-minute windows
}

/**
 * Check if request is allowed
 */
export function isRateLimitExceeded(userId, endpoint) {
  if (!userId) return false; // Skip rate limiting for unauthenticated (they'll be rejected anyway)

  const limit = DEFAULT_LIMITS[endpoint];
  if (!limit) return false; // No rate limit defined for this endpoint

  const key = `${userId}:${getWindowKey()}:${endpoint}`;

  if (!requestStore.has(key)) {
    requestStore.set(key, 0);
  }

  const count = requestStore.get(key);
  return count >= limit.requests;
}

/**
 * Increment rate limit counter
 */
export function incrementRateLimit(userId, endpoint) {
  if (!userId) return;

  const key = `${userId}:${getWindowKey()}:${endpoint}`;
  const count = (requestStore.get(key) || 0) + 1;
  requestStore.set(key, count);

  // Cleanup old entries periodically (every 100 calls)
  if (requestStore.size > 1000) {
    cleanupOldEntries();
  }
}

/**
 * Get remaining requests for user on endpoint
 */
export function getRemainingRequests(userId, endpoint) {
  if (!userId) return 0;

  const limit = DEFAULT_LIMITS[endpoint];
  if (!limit) return Infinity;

  const key = `${userId}:${getWindowKey()}:${endpoint}`;
  const count = requestStore.get(key) || 0;
  return Math.max(0, limit.requests - count);
}

/**
 * Cleanup old rate limit entries
 */
function cleanupOldEntries() {
  const currentWindow = getWindowKey();
  const keysToDelete = [];

  for (const key of requestStore.keys()) {
    const [, window] = key.split(":");
    if (parseInt(window) < currentWindow - 2) {
      // Keep current and previous window
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => requestStore.delete(key));
}

/**
 * Create rate limit response headers
 */
export function getRateLimitHeaders(userId, endpoint) {
  const limit = DEFAULT_LIMITS[endpoint];
  if (!limit) return {};

  const remaining = getRemainingRequests(userId, endpoint);
  const resetTime = Math.ceil((getWindowKey() + 1) * 60);

  return {
    "X-RateLimit-Limit": String(limit.requests),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(resetTime),
  };
}

/**
 * Format error response for rate limit exceeded
 */
export function getRateLimitErrorResponse(userId, endpoint) {
  const limit = DEFAULT_LIMITS[endpoint];
  const resetTime = new Date((getWindowKey() + 1) * 60 * 1000);

  return {
    success: false,
    error: `Rate limit exceeded. Maximum ${limit.requests} requests per minute.`,
    retryAfter: resetTime.toISOString(),
    status: 429,
  };
}

/**
 * Middleware function to apply rate limiting
 * Usage: Inside your API route handler, call this at the beginning
 *
 * Example:
 * export async function POST(req) {
 *   const user = await checkUser();
 *   const rateLimitResult = checkRateLimit(user.id, req.nextUrl.pathname);
 *   if (rateLimitResult.exceeded) {
 *     return NextResponse.json(rateLimitResult.response, { status: 429 });
 *   }
 *   // ... rest of handler
 * }
 */
export function checkRateLimit(userId, endpoint) {
  if (isRateLimitExceeded(userId, endpoint)) {
    return {
      exceeded: true,
      response: getRateLimitErrorResponse(userId, endpoint),
      headers: getRateLimitHeaders(userId, endpoint),
    };
  }

  incrementRateLimit(userId, endpoint);

  return {
    exceeded: false,
    response: null,
    headers: getRateLimitHeaders(userId, endpoint),
  };
}

/**
 * Reset rate limit for a specific user/endpoint (admin function)
 */
export function resetRateLimit(userId, endpoint) {
  const key = `${userId}:${getWindowKey()}:${endpoint}`;
  requestStore.delete(key);
}

/**
 * Reset all rate limits for a user (admin function)
 */
export function resetUserRateLimits(userId) {
  const keysToDelete = [];
  for (const key of requestStore.keys()) {
    if (key.startsWith(`${userId}:`)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach((key) => requestStore.delete(key));
}

/**
 * Get rate limit statistics (for monitoring)
 */
export function getRateLimitStats() {
  const stats = {};

  for (const key of requestStore.keys()) {
    const [userId, window, endpoint] = key.split(":");
    if (!stats[endpoint]) stats[endpoint] = {};
    if (!stats[endpoint][userId]) stats[endpoint][userId] = 0;
    stats[endpoint][userId] += requestStore.get(key);
  }

  return stats;
}
