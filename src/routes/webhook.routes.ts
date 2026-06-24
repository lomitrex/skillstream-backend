import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';

const router = Router();
router.post('/mobile-sync', WebhookController.receive);

export default router;