import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "../config/redis";
import xss from "xss";
import { sendError } from "../utils/response";
import helmet from "helmet";

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginResourcePolicy: { policy: "same-site" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: "deny" },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
});

const sendRedisCommand = async (...args: string[]): Promise<any> => {
  if (!redisClient.isOpen) {
    await redisClient.connect().catch(() => {});
  }
  return (await redisClient.sendCommand(args)) as any;
};

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (async (...args: string[]) => {
      if (!redisClient.isOpen) {
        await redisClient.connect();
        return await redisClient.sendCommand(args);
      }
      return redisClient.sendCommand(args);
    }) as any,
    prefix: "rl:api:",
  }),
  message: {
    success: false,
    data: null,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests, please try again after 15 minutes.",
    },
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (async (...args: string[]) => {
      if (!redisClient.isOpen) {
        await redisClient.connect();
        return await redisClient.sendCommand(args);
      }
      return redisClient.sendCommand(args);
    }) as any,
    prefix: "rl:auth:",
  }),
  message: {
    success: false,
    data: null,
    error: {
      code: "AUTH_RATE_LIMIT_EXCEEDED",
      message:
        "Too many authentication attempts, please try again after 15 minutes.",
    },
  },
});

/**
 * 3. NoSQL Injection Sanitizer
 */
const sanitizeNoSql = (target: unknown): unknown => {
  if (Array.isArray(target)) {
    return target.map(sanitizeNoSql);
  } else if (target !== null && typeof target === 'object') {
    const cleanObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(target as Record<string, unknown>)) {
      if (!key.startsWith('$') && !key.includes('.')) {
        cleanObj[key] = sanitizeNoSql(value);
      }
    }
    return cleanObj;
  }
  return target;
};

const mutateInPlace = (target: Record<string, any>, cleaned: Record<string, any>): void => {
  for (const key of Object.keys(target)) {
    delete target[key];
  }
  Object.assign(target, cleaned);
};

export const noSqlInjectionSanitizer = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === 'object') {
    mutateInPlace(req.body, sanitizeNoSql(req.body) as Record<string, any>);
  }
  if (req.query && typeof req.query === 'object') {
    mutateInPlace(req.query, sanitizeNoSql(req.query) as Record<string, any>);
  }
  if (req.params && typeof req.params === 'object') {
    mutateInPlace(req.params, sanitizeNoSql(req.params) as Record<string, any>);
  }
  next();
};

/**
 * 4. Cross-Site Scripting (XSS) Sanitizer
 */
const sanitizeXss = (target: unknown): unknown => {
  if (typeof target === 'string') {
    return xss(target.trim());
  } else if (Array.isArray(target)) {
    return target.map(sanitizeXss);
  } else if (target !== null && typeof target === 'object') {
    const cleanObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(target as Record<string, unknown>)) {
      cleanObj[key] = sanitizeXss(value);
    }
    return cleanObj;
  }
  return target;
};

export const xssSanitizer = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === 'object') {
    mutateInPlace(req.body, sanitizeXss(req.body) as Record<string, any>);
  }
  if (req.query && typeof req.query === 'object') {
    mutateInPlace(req.query, sanitizeXss(req.query) as Record<string, any>);
  }
  if (req.params && typeof req.params === 'object') {
    mutateInPlace(req.params, sanitizeXss(req.params) as Record<string, any>);
  }
  next();
};

const SQL_META_PATTERN =
  /(--|\/\*|\*\/|;\s*$|xp_|exec\s+|union\s+select|insert\s+into|drop\s+table)/i;

export const sqlInjectionGuard = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const checkValue = (val: unknown): boolean => {
    if (typeof val === "string" && SQL_META_PATTERN.test(val)) {
      return true;
    } else if (val !== null && typeof val === "object") {
      return Object.values(val as Record<string, unknown>).some(checkValue);
    }
    return false;
  };

  const hasSuspiciousSql =
    checkValue(req.query) ||
    checkValue(req.params) ||
    (req.path.startsWith("/api/v1/auth") && checkValue(req.body));

  if (hasSuspiciousSql) {
    sendError(
      res,
      400,
      "SQL_INJECTION_DETECTED",
      "Malicious SQL sequence detected in input parameters",
    );
    return;
  }

  next();
};
