import * as foodService from '../services/foodService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listFood = asyncHandler(async (req, res) => {
  const result = await foodService.listFoodItems(req.query);
  res.status(200).json({
    success: true,
    data: result,
  });
});

export const getOwnerMenu = asyncHandler(async (req, res) => {
  const items = await foodService.getOwnerMenu(req.user, req.query.restaurantId);
  res.status(200).json({
    success: true,
    data: { items },
  });
});

export const createFood = asyncHandler(async (req, res) => {
  const item = await foodService.createFoodItem(req.user, req.body);
  res.status(201).json({
    success: true,
    message: 'Food item created successfully',
    data: { item },
  });
});

export const updateFood = asyncHandler(async (req, res) => {
  const item = await foodService.updateFoodItem(req.params.id, req.user, req.body);
  res.status(200).json({
    success: true,
    message: 'Food item updated successfully',
    data: { item },
  });
});

export const toggleAvailability = asyncHandler(async (req, res) => {
  const item = await foodService.setFoodAvailability(
    req.params.id,
    req.user,
    req.body?.availability
  );
  res.status(200).json({
    success: true,
    message: `Item marked ${item.availability ? 'available' : 'unavailable'}`,
    data: { item },
  });
});

export const deleteFood = asyncHandler(async (req, res) => {
  const result = await foodService.deleteFoodItem(req.params.id, req.user);
  res.status(200).json({
    success: true,
    message: 'Food item deleted successfully',
    data: result,
  });
});
