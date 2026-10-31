// In-memory sliding window rate limiter for Vercel Serverless
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const ipMap = new Map<string, RateLimitRecord>();

// Clean up old entries every 60 seconds
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, rec] of ipMap.entries()) {
      if (now > rec.resetAt) {
        ipMap.delete(ip);
      }
    }
  }, 60000);
}

export function checkRateLimit(
  req: Request,
  limit: number = 40,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetInSec: number } {
  // Extract real IP from standard Vercel / Cloudflare headers
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cfIp = req.headers.get("cf-connecting-ip");
  const ip = (cfIp || realIp || (forwarded ? forwarded.split(",")[0] : "127.0.0.1")).trim();

  const now = Date.now();
  const record = ipMap.get(ip);

  if (!record || now > record.resetAt) {
    ipMap.set(ip, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { allowed: true, remaining: limit - 1, resetInSec: Math.ceil(windowMs / 1000) };
  }

  if (record.count >= limit) {
    const resetInSec = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, resetInSec };
  }

  record.count += 1;
  const resetInSec = Math.ceil((record.resetAt - now) / 1000);
  return { allowed: true, remaining: limit - record.count, resetInSec };
}
