import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '../utils/response';

interface JwtPayload {
  id: number;
  email: string;
  role: string;
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.access_token;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : cookieToken;

  if (!token) {
    sendError(res, 401, 'UNAUTHORIZED', 'Access token is missing or malformed');
    return;
  }

  try {
    const secret = process.env.JWT_SECRET || 'access_secret_key_2026';
    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    sendError(res, 401, 'INVALID_TOKEN', 'Token is invalid or expired');
  }
};

// Alias export for backward compatibility
export const authMiddleware = authenticate;