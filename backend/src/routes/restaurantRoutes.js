import { Router } from 'express';
import * as restaurantController from '../controllers/restaurantController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  menuQuerySchema,
  nearbyDetailQuerySchema,
  nearbyQuerySchema,
  restaurantIdParamSchema,
  searchQuerySchema,
  updateRestaurantLocationSchema,
} from '../validators/restaurantValidator.js';
import { toggleOpenSchema } from '../validators/deliveryValidator.js';

const router = Router();

// Static & owner routes must precede :id routes
router.get(
  '/owner/dashboard',
  protect,
  authorize('restaurant', 'admin'),
  restaurantController.getOwnerDashboard
);

router.get('/categories', restaurantController.getCategories);
router.get('/search', validate(searchQuerySchema, 'query'), restaurantController.searchRestaurants);
router.get(
  '/nearby',
  validate(nearbyQuerySchema, 'query'),
  restaurantController.getNearbyRestaurants
);

router.get(
  '/nearby/:id',
  validate(restaurantIdParamSchema, 'params'),
  validate(nearbyDetailQuerySchema, 'query'),
  restaurantController.getNearbyRestaurantById
);

router.get(
  '/:id/menu',
  validate(restaurantIdParamSchema, 'params'),
  validate(menuQuerySchema, 'query'),
  restaurantController.getRestaurantMenu
);

router.get(
  '/:id/location',
  validate(restaurantIdParamSchema, 'params'),
  restaurantController.getLocation
);

router.patch(
  '/:id/location',
  protect,
  authorize('restaurant', 'admin'),
  validate(restaurantIdParamSchema, 'params'),
  validate(updateRestaurantLocationSchema, 'body'),
  restaurantController.updateLocation
);

router.patch(
  '/:id/status',
  protect,
  authorize('restaurant', 'admin'),
  validate(restaurantIdParamSchema, 'params'),
  validate(toggleOpenSchema, 'body'),
  restaurantController.toggleOpenStatus
);

export default router;
