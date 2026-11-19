import { Router } from 'express';
import { getMe, updateProfile } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { updateProfileSchema } from '../validators/authValidator.js';

const router = Router();

router.use(protect);
router.get('/profile', getMe);
router.patch('/profile', validate(updateProfileSchema), updateProfile);

export default router;
