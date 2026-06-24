import { Router } from 'express';
import { CourseController } from '../controllers/course.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import multer from 'multer';

const upload = multer({ dest: 'uploads/' });
const router = Router();

router.post('/', authenticateToken, authorizeRoles('admin', 'instructor'), CourseController.create);
router.get('/', authenticateToken, CourseController.getAll);
router.post('/:id/thumbnail', authenticateToken, authorizeRoles('admin'), upload.single('thumbnail'), CourseController.uploadThumbnail);

export default router;