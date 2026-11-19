import { Router } from 'express';
import * as deliveryController from '../controllers/deliveryController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  availabilityBodySchema,
  partnerLocationSchema,
  rejectTaskBodySchema,
  taskOrderIdParamSchema,
} from '../validators/deliveryValidator.js';

const router = Router();

router.use(protect, authorize('delivery'));

router.get('/partner/me', deliveryController.getPartnerProfile);
router.patch(
  '/partner/availability',
  validate(availabilityBodySchema, 'body'),
  deliveryController.toggleAvailability
);
router.patch(
  '/partner/location',
  validate(partnerLocationSchema, 'body'),
  deliveryController.updateLocation
);

router.get('/tasks/available', deliveryController.getAvailableTasks);
router.post(
  '/tasks/:orderId/accept',
  validate(taskOrderIdParamSchema, 'params'),
  deliveryController.acceptTask
);
router.post(
  '/tasks/:orderId/confirm',
  validate(taskOrderIdParamSchema, 'params'),
  deliveryController.confirmTask
);
router.post(
  '/tasks/:orderId/reject',
  validate(taskOrderIdParamSchema, 'params'),
  validate(rejectTaskBodySchema, 'body'),
  deliveryController.rejectTask
);
router.get('/orders/history', deliveryController.getDeliveryHistory);

export default router;
