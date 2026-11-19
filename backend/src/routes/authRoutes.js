import { Router } from 'express';
import { getMe, login, register } from '../controllers/authController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimitMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { loginSchema, registerSchema } from '../validators/authValidator.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.get('/me', protect, getMe);
router.get('/customer-access', protect, authorize('customer', 'admin'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Customer portal access granted',
    role: req.user.role,
  });
});

export default router;
