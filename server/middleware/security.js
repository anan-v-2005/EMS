// Dependency-free security helpers: response headers and a small in-memory rate limiter.
// Note: the limiter is per server instance. On multi-instance/serverless deployments put a
// shared limiter (or your host's WAF/rate limiting) in front for strict guarantees.

export const securityHeaders = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  res.removeHeader("X-Powered-By");
  next();
};

export const createRateLimiter = ({ windowMs, max, keyFn, message = "Too many requests. Please try again later." }) => {
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = keyFn ? keyFn(req) : req.ip;
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      entry.count += 1;
      if (entry.count > max) {
        res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
        return res.status(429).json({ error: message });
      }
    }

    // Opportunistic cleanup so the map cannot grow without bound.
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }
    return next();
  };
};

const emailOf = (req) => String(req.body?.email || "").trim().toLowerCase();

export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => `${req.ip}|${emailOf(req)}`,
  message: "Too many login attempts. Please try again in 15 minutes.",
});

export const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyFn: (req) => `${req.ip}|${emailOf(req)}`,
  message: "Too many password reset requests. Please try again later.",
});
