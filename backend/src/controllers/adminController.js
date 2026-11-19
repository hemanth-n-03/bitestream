import * as adminService from '../services/adminService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getOverview = asyncHandler(async (_req, res) => {
  const data = await adminService.getPlatformOverview();
  res.status(200).json({
    success: true,
    message: 'Admin portal access granted',
    data,
  });
});

export const getOrders = asyncHandler(async (req, res) => {
  const result = await adminService.getAdminOrders(req.query);
  res.status(200).json({
    success: true,
    data: result,
  });
});

export const getRestaurants = asyncHandler(async (_req, res) => {
  const restaurants = await adminService.listAllRestaurants();
  res.status(200).json({
    success: true,
    data: { restaurants },
  });
});

export const toggleRestaurantStatus = asyncHandler(async (req, res) => {
  const restaurant = await adminService.setRestaurantActiveStatus(
    req.params.id,
    req.body?.isActive
  );
  res.status(200).json({
    success: true,
    message: `${restaurant.name} marked ${restaurant.isActive ? 'active' : 'suspended'}`,
    data: { restaurant },
  });
});

export const getUsers = asyncHandler(async (_req, res) => {
  const users = await adminService.listAllUsers();
  res.status(200).json({
    success: true,
    data: { users },
  });
});

export const toggleUserStatus = asyncHandler(async (req, res) => {
  const user = await adminService.setUserActiveStatus(
    req.params.id,
    req.user._id,
    req.body?.isActive
  );
  res.status(200).json({
    success: true,
    message: `${user.name} account ${user.isActive ? 'enabled' : 'disabled'}`,
    data: { user },
  });
});

export const getPartners = asyncHandler(async (_req, res) => {
  const partners = await adminService.listAllPartners();
  res.status(200).json({
    success: true,
    data: { partners },
  });
});
