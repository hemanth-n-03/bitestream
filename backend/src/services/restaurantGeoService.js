import mongoose from 'mongoose';
import { FoodItem, Restaurant } from '../models/index.js';
import AppError from '../utils/AppError.js';
import {
  calculateSphericalKm,
  escapeRegex,
  kmToMeters,
  kmToRadians,
} from '../utils/geoHelpers.js';

function getSortStage(sort) {
  if (sort === 'rating') return { 'rating.average': -1, distanceMeters: 1 };
  if (sort === 'fast') return { prepTimeMins: 1, distanceMeters: 1 };
  return { distanceMeters: 1, 'rating.average': -1 };
}

async function resolveDishMatchingRestaurants(searchRegex) {
  return FoodItem.distinct('restaurantId', {
    $or: [{ name: searchRegex }, { description: searchRegex }, { category: searchRegex }],
  });
}

async function buildRestaurantFilter({
  category,
  search,
  vegOnly,
  openOnly,
  minRating,
}) {
  const filter = { isActive: true };

  if (openOnly) filter.isOpen = true;
  if (vegOnly) filter.isVegOnly = true;
  if (minRating != null) filter['rating.average'] = { $gte: minRating };
  if (category && category !== 'All') {
    filter.cuisineTypes = { $in: [new RegExp(`^${escapeRegex(category)}$`, 'i')] };
  }

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    const dishRestaurantIds = await resolveDishMatchingRestaurants(regex);
    filter.$or = [
      { name: regex },
      { description: regex },
      { 'address.area': regex },
      { cuisineTypes: regex },
      ...(dishRestaurantIds.length > 0 ? [{ _id: { $in: dishRestaurantIds } }] : []),
    ];
  }

  return filter;
}

export async function findNearbyRestaurants(params) {
  const {
    latitude,
    longitude,
    radius,
    category,
    search,
    sort,
    vegOnly,
    openOnly,
    minRating,
    mode,
    page,
    limit,
  } = params;

  const userPoint = [longitude, latitude];
  const radiusMeters = kmToMeters(radius);
  const filter = await buildRestaurantFilter({ category, search, vegOnly, openOnly, minRating });
  const skip = (page - 1) * limit;

  if (mode === 'near') {
    const query = {
      ...filter,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: userPoint },
          $maxDistance: radiusMeters,
        },
      },
    };
    const docs = await Restaurant.find(query).skip(skip).limit(limit).lean();
    const total = await Restaurant.countDocuments({
      ...filter,
      location: { $geoWithin: { $centerSphere: [userPoint, kmToRadians(radius)] } },
    });

    const items = docs.map((doc) => ({
      ...doc,
      distanceKm: calculateSphericalKm(userPoint, doc.location?.coordinates),
    }));

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      queryInfo: {
        operator: '$near',
        centerGeoJson: userPoint,
        radiusKm: radius,
        maxDistanceMeters: radiusMeters,
      },
    };
  }

  if (mode === 'geoWithin') {
    const query = {
      ...filter,
      location: {
        $geoWithin: {
          $centerSphere: [userPoint, kmToRadians(radius)],
        },
      },
    };
    const allDocs = await Restaurant.find(query).lean();
    const withDist = allDocs.map((doc) => ({
      ...doc,
      distanceKm: calculateSphericalKm(userPoint, doc.location?.coordinates),
    }));

    withDist.sort((a, b) => {
      if (sort === 'rating') return b.rating.average - a.rating.average;
      if (sort === 'fast') return a.prepTimeMins - b.prepTimeMins;
      return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
    });

    const total = withDist.length;
    const items = withDist.slice(skip, skip + limit);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      queryInfo: {
        operator: '$geoWithin ($centerSphere)',
        centerGeoJson: userPoint,
        radiusKm: radius,
        maxDistanceMeters: radiusMeters,
      },
    };
  }

  // Default: $geoNear aggregation using 2dsphere index + spherical distance projection
  const pipeline = [
    {
      $geoNear: {
        near: { type: 'Point', coordinates: userPoint },
        distanceField: 'distanceMeters',
        maxDistance: radiusMeters,
        spherical: true,
        query: filter,
      },
    },
    {
      $addFields: {
        distanceKm: { $round: [{ $divide: ['$distanceMeters', 1000] }, 2] },
      },
    },
    { $sort: getSortStage(sort) },
    {
      $facet: {
        items: [{ $skip: skip }, { $limit: limit }, { $project: { __v: 0 } }],
        meta: [{ $count: 'total' }],
      },
    },
  ];

  const [result] = await Restaurant.aggregate(pipeline);
  const items = result?.items || [];
  const total = result?.meta?.[0]?.total || 0;

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    queryInfo: {
      operator: '$geoNear',
      centerGeoJson: userPoint,
      radiusKm: radius,
      maxDistanceMeters: radiusMeters,
    },
  };
}

export async function getRestaurantNearbyDetails(restaurantId, { latitude, longitude } = {}) {
  const objId = new mongoose.Types.ObjectId(restaurantId);
  let restaurant = null;

  if (latitude !== undefined && longitude !== undefined) {
    const userPoint = [longitude, latitude];
    const [doc] = await Restaurant.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: userPoint },
          distanceField: 'distanceMeters',
          spherical: true,
          query: { _id: objId, isActive: true },
        },
      },
      {
        $addFields: {
          distanceKm: { $round: [{ $divide: ['$distanceMeters', 1000] }, 2] },
        },
      },
      { $project: { __v: 0 } },
    ]);
    restaurant = doc || null;
  } else {
    restaurant = await Restaurant.findOne({ _id: objId, isActive: true }).select('-__v').lean();
  }

  if (!restaurant) {
    throw new AppError('Restaurant not found', 404, 'RESTAURANT_NOT_FOUND');
  }

  const menuSummary = await FoodItem.aggregate([
    { $match: { restaurantId: objId } },
    {
      $group: {
        _id: '$category',
        totalItems: { $sum: 1 },
        availableItems: { $sum: { $cond: ['$availability', 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return {
    restaurant,
    menuCategories: menuSummary.map((c) => ({
      category: c._id,
      totalItems: c.totalItems,
      availableItems: c.availableItems,
    })),
  };
}

export async function getRestaurantMenu(restaurantId, params) {
  const { category, search, vegOnly, availableOnly, page, limit } = params;
  const restaurant = await Restaurant.findOne({ _id: restaurantId, isActive: true })
    .select('name isOpen location address rating prepTimeMins')
    .lean();

  if (!restaurant) {
    throw new AppError('Restaurant not found', 404, 'RESTAURANT_NOT_FOUND');
  }

  const filter = { restaurantId: restaurant._id };
  if (category && category !== 'All') {
    filter.category = new RegExp(`^${escapeRegex(category)}$`, 'i');
  }
  if (vegOnly) filter.isVeg = true;
  if (availableOnly) filter.availability = true;
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: regex }, { description: regex }, { category: regex }];
  }

  const skip = (page - 1) * limit;
  const [items, total, categories] = await Promise.all([
    FoodItem.find(filter)
      .sort({ bestseller: -1, name: 1 })
      .skip(skip)
      .limit(limit)
      .select('-__v')
      .lean(),
    FoodItem.countDocuments(filter),
    FoodItem.distinct('category', { restaurantId: restaurant._id }),
  ]);

  return {
    restaurant,
    items,
    categories: categories.sort(),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function searchRestaurantsAndDishes(params) {
  const { q, search, category, vegOnly, latitude, longitude, page, limit } = params;
  const queryText = q || search || '';
  const hasCoords = latitude !== undefined && longitude !== undefined;

  let restaurantsResult;
  if (hasCoords) {
    restaurantsResult = await findNearbyRestaurants({
      latitude,
      longitude,
      radius: 25,
      category,
      search: queryText,
      sort: 'distance',
      vegOnly,
      mode: 'geoNear',
      page,
      limit,
    });
  } else {
    const filter = await buildRestaurantFilter({ category, search: queryText, vegOnly });
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Restaurant.find(filter).sort({ 'rating.average': -1 }).skip(skip).limit(limit).select('-__v').lean(),
      Restaurant.countDocuments(filter),
    ]);
    restaurantsResult = {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  const dishFilter = { availability: true };
  if (vegOnly) dishFilter.isVeg = true;
  if (category && category !== 'All') {
    dishFilter.category = new RegExp(`^${escapeRegex(category)}$`, 'i');
  }
  if (queryText) {
    const regex = new RegExp(escapeRegex(queryText), 'i');
    dishFilter.$or = [{ name: regex }, { description: regex }, { category: regex }];
  } else {
    dishFilter.bestseller = true;
  }

  const activeIds = restaurantsResult.items.map((r) => r._id);
  if (hasCoords) {
    dishFilter.restaurantId = { $in: activeIds };
  }

  const dishes = await FoodItem.find(dishFilter)
    .populate('restaurantId', 'name isOpen isActive address location prepTimeMins')
    .sort({ bestseller: -1, price: 1 })
    .limit(8)
    .select('-__v')
    .lean();

  const sanitizedDishes = dishes.filter((d) => d.restaurantId && d.restaurantId.isActive);

  return {
    restaurants: restaurantsResult.items,
    dishes: sanitizedDishes,
    pagination: restaurantsResult.pagination,
  };
}

export async function getCategoriesSummary() {
  const [foodCategories, restaurantCuisines] = await Promise.all([
    FoodItem.aggregate([
      { $match: { availability: true } },
      { $group: { _id: '$category', dishCount: { $sum: 1 } } },
      { $sort: { dishCount: -1, _id: 1 } },
    ]),
    Restaurant.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$cuisineTypes' },
      { $group: { _id: '$cuisineTypes', restaurantCount: { $sum: 1 } } },
    ]),
  ]);

  const restCountMap = Object.fromEntries(
    restaurantCuisines.map((c) => [c._id, c.restaurantCount])
  );

  const mergedNames = Array.from(
    new Set([
      ...foodCategories.map((c) => c._id),
      ...restaurantCuisines.map((c) => c._id),
    ])
  );

  const foodCountMap = Object.fromEntries(foodCategories.map((c) => [c._id, c.dishCount]));

  return mergedNames.map((name) => ({
    name,
    dishCount: foodCountMap[name] || 0,
    restaurantCount: restCountMap[name] || 0,
  }));
}

export async function getRestaurantLocation(restaurantId) {
  const restaurant = await Restaurant.findOne({ _id: restaurantId, isActive: true })
    .select('name address location isOpen openingHours')
    .lean();

  if (!restaurant) {
    throw new AppError('Restaurant not found', 404, 'RESTAURANT_NOT_FOUND');
  }
  return restaurant;
}

export async function updateRestaurantLocation(restaurantId, user, payload) {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    throw new AppError('Restaurant not found', 404, 'RESTAURANT_NOT_FOUND');
  }

  const isOwner = restaurant.ownerId.toString() === user._id.toString();
  if (user.role !== 'admin' && !isOwner) {
    throw new AppError(
      'You can only update location for restaurants you own.',
      403,
      'OWNERSHIP_REQUIRED'
    );
  }

  restaurant.location = { type: 'Point', coordinates: payload.coordinates };
  if (payload.address) {
    restaurant.address = { ...restaurant.address.toObject(), ...payload.address };
  }

  await restaurant.save();
  return restaurant;
}

export async function updateRestaurantOpenStatus(restaurantId, user, isOpen) {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    throw new AppError('Restaurant not found', 404, 'RESTAURANT_NOT_FOUND');
  }

  const isOwner = restaurant.ownerId.toString() === user._id.toString();
  if (user.role !== 'admin' && !isOwner) {
    throw new AppError(
      'You can only toggle open/closed status for your own restaurant.',
      403,
      'OWNERSHIP_REQUIRED'
    );
  }

  restaurant.isOpen = typeof isOpen === 'boolean' ? isOpen : !restaurant.isOpen;
  await restaurant.save();
  return restaurant;
}
