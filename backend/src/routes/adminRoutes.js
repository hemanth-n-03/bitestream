import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  adminOrdersQuerySchema,
  entityIdParamSchema,
  toggleActiveSchema,
} from '../validators/deliveryValidator.js';

const router = Router();

router.use(protect, authorize('admin'));

router.get('/overview', adminController.getOverview);
router.get(
  '/orders',
  validate(adminOrdersQuerySchema, 'query'),
  adminController.getOrders
);
router.get('/restaurants', adminController.getRestaurants);
router.patch(
  '/restaurants/:id/status',
  validate(entityIdParamSchema, 'params'),
  validate(toggleActiveSchema, 'body'),
  adminController.toggleRestaurantStatus
);
router.get('/users', adminController.getUsers);
router.patch(
  '/users/:id/status',
  validate(entityIdParamSchema, 'params'),
  validate(toggleActiveSchema, 'body'),
  adminController.toggleUserStatus
);
router.get('/partners', adminController.getPartners);

export default router;
