import type { Request, Response, NextFunction } from 'express';
import { AuthService, setAuthCookies, clearAuthCookies } from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/response';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return sendError(res, 422, 'VALIDATION_FAILED', 'Email and password are required');
    }

    const newUser = await AuthService.register(email, password, role);
    sendSuccess(res, 201, newUser);
  } catch (err: any) {
    if (err.status) {
      return sendError(res, err.status, err.code, err.message);
    }
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendError(res, 422, 'VALIDATION_FAILED', 'Email and password are required');
    }

    const { user, accessToken, refreshToken } = await AuthService.login(email, password);

    setAuthCookies(res, accessToken, refreshToken);
    sendSuccess(res, 200, { user, accessToken, refreshToken });
  } catch (err: any) {
    if (err.status) {
      return sendError(res, err.status, err.code, err.message);
    }
    next(err);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const incomingToken = req.cookies?.refresh_token || req.body?.refreshToken;

    if (!incomingToken) {
      return sendError(res, 401, 'MISSING_TOKEN', 'No refresh token provided');
    }

    const { user, accessToken, refreshToken } = await AuthService.rotateRefreshToken(incomingToken);

    setAuthCookies(res, accessToken, refreshToken);
    sendSuccess(res, 200, { user, accessToken, refreshToken });
  } catch (err: any) {
    if (err.status) {
      return sendError(res, err.status, err.code, err.message);
    }
    next(err);
  }
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  clearAuthCookies(res);
  sendSuccess(res, 200, { message: 'Logged out successfully' });
};