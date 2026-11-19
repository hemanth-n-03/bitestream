import { Restaurant } from '../models/index.js';
import * as geoService from '../services/restaurantGeoService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getNearbyRestaurants = asyncHandler(async (req, res) => {
  const result = await geoService.findNearbyRestaurants(req.query);
  res.status(200).json({
    success: true,
    data: {
      restaurants: result.items,
      pagination: result.pagination,
      queryInfo: result.queryInfo,
    },
  });
});

export const getNearbyRestaurantById = asyncHandler(async (req, res) => {
  const result = await geoService.getRestaurantNearbyDetails(req.params.id, req.query);
  res.status(200).json({
    success: true,
    data: result,
  });
});

export const getRestaurantMenu = asyncHandler(async (req, res) => {
  const result = await geoService.getRestaurantMenu(req.params.id, req.query);
  res.status(200).json({
    success: true,
    data: result,
  });
});

export const searchRestaurants = asyncHandler(async (req, res) => {
  const result = await geoService.searchRestaurantsAndDishes(req.query);
  res.status(200).json({
    success: true,
    data: result,
  });
});

export const getCategories = asyncHandler(async (_req, res) => {
  const categories = await geoService.getCategoriesSummary();
  res.status(200).json({
    success: true,
    data: { categories },
  });
});

export const getLocation = asyncHandler(async (req, res) => {
  const locationInfo = await geoService.getRestaurantLocation(req.params.id);
  res.status(200).json({
    success: true,
    data: { restaurant: locationInfo },
  });
});

export const updateLocation = asyncHandler(async (req, res) => {
  const updated = await geoService.updateRestaurantLocation(req.params.id, req.user, req.body);
  res.status(200).json({
    success: true,
    message: 'Restaurant GeoJSON location updated successfully',
    data: { restaurant: updated },
  });
});

export const getOwnerDashboard = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { ownerId: req.user._id };
  const restaurants = await Restaurant.find(filter).select('-__v');
  res.status(200).json({
    success: true,
    message: 'Restaurant partner portal access granted',
    data: { restaurants },
  });
});

export const toggleOpenStatus = asyncHandler(async (req, res) => {
  const restaurant = await geoService.updateRestaurantOpenStatus(
    req.params.id,
    req.user,
    req.body?.isOpen
  );
  res.status(200).json({
    success: true,
    message: `${restaurant.name} marked ${restaurant.isOpen ? 'open' : 'closed'}`,
    data: { restaurant },
  });
});
