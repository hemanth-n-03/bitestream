import { Router } from 'express';
import * as foodController from '../controllers/foodController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  createFoodSchema,
  foodIdParamSchema,
  listFoodQuerySchema,
  ownerMenuQuerySchema,
  toggleAvailabilitySchema,
  updateFoodSchema,
} from '../validators/foodValidator.js';

const router = Router();

router.get('/', validate(listFoodQuerySchema, 'query'), foodController.listFood);

router.get(
  '/my-menu',
  protect,
  authorize('restaurant', 'admin'),
  validate(ownerMenuQuerySchema, 'query'),
  foodController.getOwnerMenu
);

router.post(
  '/',
  protect,
  authorize('restaurant', 'admin'),
  validate(createFoodSchema, 'body'),
  foodController.createFood
);

router.patch(
  '/:id',
  protect,
  authorize('restaurant', 'admin'),
  validate(foodIdParamSchema, 'params'),
  validate(updateFoodSchema, 'body'),
  foodController.updateFood
);

router.patch(
  '/:id/availability',
  protect,
  authorize('restaurant', 'admin'),
  validate(foodIdParamSchema, 'params'),
  validate(toggleAvailabilitySchema, 'body'),
  foodController.toggleAvailability
);

router.delete(
  '/:id',
  protect,
  authorize('restaurant', 'admin'),
  validate(foodIdParamSchema, 'params'),
  foodController.deleteFood
);

export default router;
