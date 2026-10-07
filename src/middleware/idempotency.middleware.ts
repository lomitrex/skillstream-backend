import type { Request, Response, NextFunction } from 'express';
import { redisClient } from '../config/redis';
import { sendError } from '../utils/response';

export const idempotencyGuard = (expirySeconds = 86400) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only apply to state-modifying requests
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    const idempotencyKey = req.header('X-Idempotency-Key');
    if (!idempotencyKey) {
      return next();
    }

    const cacheKey = `idempotency:${idempotencyKey}`;

    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        res.status(parsed.status).set('X-Cache-Hit', 'true').json(parsed.body);
        return;
      }

      // Intercept and cache the real response before sending
      const originalSend = res.json.bind(res);
      res.json = (body: any): Response => {
        // Only cache deterministic outcomes (2xx and 4xx client errors)
        if (res.statusCode < 500) {
          redisClient.setEx(
            cacheKey,
            expirySeconds,
            JSON.stringify({ status: res.statusCode, body })
          ).catch((err) => console.error('Idempotency Redis write error:', err));
        }
        return originalSend(body);
      };

      next();
    } catch (err) {
      console.error('Idempotency middleware failure:', err);
      sendError(res, 500, 'IDEMPOTENCY_ERROR', 'Internal idempotency check failure');
    }
  };
};