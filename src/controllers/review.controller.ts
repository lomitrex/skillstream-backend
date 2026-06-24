import { Request, Response } from 'express';
import { ReviewService } from '../services/review.service';

export class ReviewController {
  static async add(req: Request, res: Response): Promise<void> {
    try {
      const { courseId, rating, comment } = req.body;
      
      
      if (!req.user) {
        res.status(401).json({ error: 'User context unauthenticated' });
        return;
      }
      
      const userId = req.user.id;
      const review = await ReviewService.addReview({ courseId, userId, rating, comment });
      res.status(201).json(review);
    } catch (error) {
      res.status(500).json({ error: 'Failed to save context review' });
    }
  }
}