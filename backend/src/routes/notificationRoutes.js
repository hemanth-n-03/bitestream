import { Router } from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} from '../validators/notificationValidator.js';

const router = Router();

router.use(protect);

router.get(
  '/',
  validate(listNotificationsQuerySchema, 'query'),
  notificationController.getMyNotifications
);

router.patch('/read-all', notificationController.readAllNotifications);

router.patch(
  '/:id/read',
  validate(notificationIdParamSchema, 'params'),
  notificationController.readNotification
);

export default router;
