import type { Request, Response, NextFunction } from 'express';
import { Course } from '../models/course.model';
import { redisClient } from '../config/redis';
import { sendSuccess, sendError } from '../utils/response';

export const listCourses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const search = (req.query.search as string) || '';
    const instructor = (req.query.instructor as string) || '';
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const cacheKey = `courses:page:${page}:limit:${limit}:s:${search}:i:${instructor}:sort:${sortBy}:${sortOrder}`;
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      return sendSuccess(res, 200, parsed.courses, parsed.meta);
    }

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { title: { $regex: search,$options: 'i' } },
        { description: { $regex: search,$options: 'i' } },
      ];
    }
    if (instructor) {
      filter.instructor = instructor;
    }

    const skip = (page - 1) * limit;

    const [courses, total] = await Promise.all([
      Course.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Course.countDocuments(filter),
    ]);

    const meta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };

    // Cache page result for 60 seconds
    await redisClient.setEx(cacheKey, 60, JSON.stringify({ courses, meta }));

    sendSuccess(res, 200, courses, meta);
  } catch (err) {
    next(err);
  }
};

export const createCourse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return sendError(res, 422, 'VALIDATION_FAILED', 'Title and description are required');
    }

    const newCourse = await Course.create({
      title,
      description,
      instructor: req.user?.email || String(req.user?.id),
    });

    // Invalidate course list cache
    const keys = await redisClient.keys('courses:*');
    if (keys.length > 0) {
      await redisClient.del(keys);
    }

    sendSuccess(res, 201, newCourse);
  } catch (err) {
    next(err);
  }
};