import { Course, ICourse } from '../models/course.model';
import { redisClient } from '../config/redis';

export class CourseService {
  static async createCourse(data: Partial<ICourse>): Promise<ICourse> {
    const newCourse = new Course(data);
    const saved = await newCourse.save();
    await redisClient.del('all_courses');
    return saved;
  }

  static async getAllCourses(): Promise<ICourse[]> {
    const cachedCourses = await redisClient.get('all_courses');
    if (cachedCourses) {
      return JSON.parse(cachedCourses);
    }

    const courses = await Course.find();
    await redisClient.setEx('all_courses', 300, JSON.stringify(courses)); 
    return courses;
  }

  static async getCourseById(id: string): Promise<ICourse | null> {
    return await Course.findById(id);
  }

  static async updateCourse(id: string, data: Partial<ICourse>): Promise<ICourse | null> {
    const updated = await Course.findByIdAndUpdate(id, data, { new: true });
    await redisClient.del('all_courses');
    return updated;
  }

  static async deleteCourse(id: string): Promise<ICourse | null> {
    const deleted = await Course.findByIdAndDelete(id);
    await redisClient.del('all_courses');
    return deleted;
  }
}