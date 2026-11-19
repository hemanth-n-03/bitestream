import { Router } from 'express';
import * as orderController from '../controllers/orderController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  cancelOrderSchema,
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdParamSchema,
  reassignOrderSchema,
  updateOrderStatusSchema,
} from '../validators/orderValidator.js';

const router = Router();

router.use(protect);

router.post(
  '/',
  authorize('customer'),
  validate(createOrderSchema, 'body'),
  orderController.createOrder
);

router.get(
  '/my',
  authorize('customer', 'admin'),
  validate(listOrdersQuerySchema, 'query'),
  orderController.getMyOrders
);

router.get(
  '/restaurant',
  authorize('restaurant', 'admin'),
  validate(listOrdersQuerySchema, 'query'),
  orderController.getRestaurantOrders
);

router.get(
  '/:id',
  validate(orderIdParamSchema, 'params'),
  orderController.getOrderById
);

router.patch(
  '/:id/status',
  authorize('restaurant', 'delivery', 'admin'),
  validate(orderIdParamSchema, 'params'),
  validate(updateOrderStatusSchema, 'body'),
  orderController.updateOrderStatus
);

router.post(
  '/:id/cancel',
  authorize('customer', 'admin'),
  validate(orderIdParamSchema, 'params'),
  validate(cancelOrderSchema, 'body'),
  orderController.cancelOrder
);

router.post(
  '/:id/reassign',
  authorize('restaurant', 'admin'),
  validate(orderIdParamSchema, 'params'),
  validate(reassignOrderSchema, 'body'),
  orderController.reassignOrder
);

export default router;
