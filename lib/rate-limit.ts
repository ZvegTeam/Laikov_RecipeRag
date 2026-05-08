/**
 * Rate limiting utility for API routes
 * Uses in-memory storage (can be extended to use Redis for production)
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limiting
// In production, consider using Redis or a distributed cache
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval to prevent memory leaks
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
let cleanupTimer: NodeJS.Timeout | null = null;

/**
 * Clean up expired rate limit entries
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  const keysToDelete: string[] = [];
  rateLimitStore.forEach((entry, key) => {
    if (entry.resetAt < now) {
      keysToDelete.push(key);
    }
  });
  for (const key of keysToDelete) {
    rateLimitStore.delete(key);
  }
}

/**
 * Start cleanup timer if not already running
 */
function startCleanupTimer() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL);
  // Cleanup on process exit
  if (typeof process !== "undefined") {
    process.on("SIGTERM", () => {
      if (cleanupTimer) clearInterval(cleanupTimer);
    });
    process.on("SIGINT", () => {
      if (cleanupTimer) clearInterval(cleanupTimer);
    });
  }
}

export interface RateLimitOptions {
  /**
   * Maximum number of requests allowed
   * @default 10
   */
  maxRequests?: number;
  /**
   * Time window in milliseconds
   * @default 60000 (1 minute)
   */
  windowMs?: number;
  /**
   * Custom identifier for rate limiting (defaults to IP address)
   */
  identifier?: string;
}

export interface RateLimitResult {
  /**
   * Whether the request is allowed
   */
  allowed: boolean;
  /**
   * Number of requests remaining in the current window
   */
  remaining: number;
  /**
   * Time when the rate limit resets (Unix timestamp in milliseconds)
   */
  resetAt: number;
  /**
   * Total number of requests allowed in the window
   */
  limit: number;
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (e.g., IP address, user ID)
 * @param options - Rate limiting options
 * @returns Rate limit result
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const {
    maxRequests = 10,
    windowMs = 60 * 1000, // 1 minute default
  } = options;

  startCleanupTimer();

  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // No entry or expired entry - allow request
  if (!entry || entry.resetAt < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(identifier, newEntry);
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: newEntry.resetAt,
      limit: maxRequests,
    };
  }

  // Entry exists and is within window
  if (entry.count >= maxRequests) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      limit: maxRequests,
    };
  }

  // Increment count
  entry.count += 1;
  rateLimitStore.set(identifier, entry);

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
    limit: maxRequests,
  };
}

/**
 * Get client IP address from Next.js request
 * @param request - Next.js request object (Request or NextRequest)
 * @returns IP address string
 */
export function getClientIP(request: Request | { headers: Headers }): string {
  // Try to get IP from various headers (for proxies/load balancers)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(",")[0].trim();
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // Fallback to a default identifier if IP cannot be determined
  // In production, you might want to throw an error or use a session ID
  return "unknown";
}

/**
 * Rate limit middleware for Next.js API routes
 * Returns rate limit headers and checks if request should be allowed
 * @param request - Next.js request object (Request or NextRequest)
 * @param options - Rate limiting options
 * @returns Rate limit result with headers
 */
export function rateLimit(
  request: Request | { headers: Headers },
  options: RateLimitOptions = {}
): {
  result: RateLimitResult;
  headers: Record<string, string>;
} {
  const identifier = options.identifier || getClientIP(request);
  const result = checkRateLimit(identifier, options);

  // Create headers for rate limit information
  // Return as plain object for NextResponse headers
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": new Date(result.resetAt).toISOString(),
  };

  return { result, headers };
}
