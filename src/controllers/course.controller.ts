import { Request, Response } from 'express';
import { CourseService } from '../services/course.service';
import { ParamsDictionary } from 'express-serve-static-core';

interface CourseParams extends ParamsDictionary {
  id: string;
}

interface CreateCourseBody {
  title: string;
  description: string;
  instructor: string;
}
export class CourseController {
  static async create(req: Request<{}, any, CreateCourseBody>, res: Response): Promise<void> {
    try {
      const { title, description, instructor } = req.body;
      const course = await CourseService.createCourse({ title, description, instructor });
      res.status(201).json(course);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create course' });
    }
  }

  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const courses = await CourseService.getAllCourses();
      res.status(200).json(courses);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch courses' });
    }
  }

static async uploadThumbnail(req: Request<CourseParams>, res: Response): Promise<void> {
    try {
      const { id } = req.params; 

      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      
      const updatedCourse = await CourseService.updateCourse(id, { thumbnailUrl: req.file.path });
      
      if (!updatedCourse) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }
      res.status(200).json({ message: 'Thumbnail uploaded successfully', course: updatedCourse });
    } catch (error) {
      res.status(500).json({ error: 'Failed to upload thumbnail' });
    }
  }
}