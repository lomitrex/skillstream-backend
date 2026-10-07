import { Router } from 'express';
import { listCourses, createCourse } from '../controllers/course.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';
import { idempotencyGuard } from '../middleware/idempotency.middleware';

const router = Router();

router.get('/', authenticate, listCourses);
router.post(
  '/',
  authenticate,
  authorizeRoles('admin', 'instructor'),
  idempotencyGuard(3600),
  createCourse
);

export default router;