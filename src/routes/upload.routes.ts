import { Router } from 'express';
import type { Request, Response } from 'express';
import { upload } from '../middleware/upload.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

router.post(
  '/single',
  authenticate,
  upload.single('file'),
  (req: Request, res: Response): void => {
    if (!req.file) {
      sendError(res, 400, 'NO_FILE_UPLOADED', 'Please provide a file to upload');
      return;
    }

    sendSuccess(res, 201, {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      path: req.file.path,
    });
  }
);

export default router;