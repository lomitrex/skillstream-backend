import { Types } from 'mongoose'; 
import { Review, IReview } from '../models/course.review.model';

export class ReviewService {
  static async addReview(data: Partial<IReview>): Promise<IReview> {
    const newReview = new Review(data);
    return await newReview.save();
  }

  
  static async getReviewsByCourse(courseId: string): Promise<IReview[]> {
    return await Review.find({ courseId: new Types.ObjectId(courseId) });
  }
}