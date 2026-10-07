import { Router } from 'express';
import { register, login, refresh, logout } from '../controllers/auth.controller';
import { idempotencyGuard } from '../middleware/idempotency.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', idempotencyGuard(60), login);
router.post('/refresh', refresh);
router.post('/logout', logout);

export default router;