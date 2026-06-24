import { Router } from 'express';
import authRoutes from './auth.routes';
import courseRoutes from './course.routes';
import reviewRoutes from './review.routes';
import webhookRoutes from './webhook.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/courses', courseRoutes);
router.use('/reviews', reviewRoutes);
router.use('/webhooks', webhookRoutes);

export default router;