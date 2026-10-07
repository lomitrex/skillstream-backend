import type { Response } from "express";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  } | null;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    [key: string]: unknown;
  };
}

export const sendSuccess = <T>(
  res: Response,
  statusCode: number,
  data: T,
  meta?: ApiResponse["meta"],
): void => {
  const payload: ApiResponse<T> = {
    success: true,
    data,
    error: null,
    ...(meta !== undefined ? { meta } : {}),
  };

  res.status(statusCode).json(payload);
};

export const sendError = (
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): void => {
  const payload: ApiResponse<null> = {
    success: false,
    data: null,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
  res.status(statusCode).json(payload);
};
