import type { Request, Response, NextFunction } from 'express';
import { Course } from '../models/course.model';
import { sendError } from '../utils/response';

export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Authentication token required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(
        res,
        403,
        'FORBIDDEN_ROLE',
        `Role '${req.user.role}' lacks permission to access this endpoint`
      );
    }

    next();
  };
};

export const requireCourseOwnershipOrAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const course = await Course.findById(id);

    if (!course) {
      return sendError(res, 404, 'NOT_FOUND', 'Target course not found');
    }

    if (req.user?.role === 'admin') {
      return next();
    }

    // Horizontal check: Verify the creator equals the caller
    if (course.instructor !== req.user?.email && course.instructor !== String(req.user?.id)) {
      return sendError(
        res,
        403,
        'FORBIDDEN_RESOURCE',
        'Horizontal privilege escalation detected: You do not own this course'
      );
    }

    next();
  } catch (err) {
    sendError(res, 500, 'SERVER_ERROR', 'Authorization check failed');
  }
};