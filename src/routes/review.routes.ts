import { Router } from 'express';
import { ReviewController } from '../controllers/review.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
router.post('/', authenticateToken, ReviewController.add);

export default router;