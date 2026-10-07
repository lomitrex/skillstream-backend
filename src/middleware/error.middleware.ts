import type { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred on the server';

  // Log in non-test environments for telemetry
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[Error] ${code}: ${message}`, err.details || err.stack);
  }

  sendError(res, statusCode, code, message, err.details);
};