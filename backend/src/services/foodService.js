import { FoodItem, Restaurant } from '../models/index.js';
import AppError from '../utils/AppError.js';
import { escapeRegex } from '../utils/geoHelpers.js';

async function assertRestaurantOwnership(restaurantId, actorUser) {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    throw new AppError('Restaurant not found', 404, 'RESTAURANT_NOT_FOUND');
  }
  if (
    actorUser.role !== 'admin' &&
    restaurant.ownerId.toString() !== actorUser._id.toString()
  ) {
    throw new AppError(
      'You are not authorized to manage menu items for this restaurant.',
      403,
      'OWNERSHIP_REQUIRED'
    );
  }
  return restaurant;
}

export async function listFoodItems({
  restaurantId,
  category,
  search,
  vegOnly,
  availableOnly,
  page = 1,
  limit = 40,
}) {
  const filter = {};
  if (restaurantId) filter.restaurantId = restaurantId;
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
  const [items, total] = await Promise.all([
    FoodItem.find(filter)
      .populate('restaurantId', 'name isOpen isActive address')
      .sort({ bestseller: -1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    FoodItem.countDocuments(filter),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function getOwnerMenu(actorUser, restaurantId) {
  await assertRestaurantOwnership(restaurantId, actorUser);
  return FoodItem.find({ restaurantId }).sort({ createdAt: -1 }).lean();
}

export async function createFoodItem(actorUser, payload) {
  await assertRestaurantOwnership(payload.restaurantId, actorUser);
  const item = await FoodItem.create({
    restaurantId: payload.restaurantId,
    name: payload.name,
    description: payload.description || '',
    price: payload.price,
    category: payload.category,
    isVeg: payload.isVeg ?? true,
    availability: payload.availability ?? true,
    bestseller: payload.bestseller ?? false,
    preparationTimeMins: payload.preparationTimeMins ?? 15,
    image:
      payload.image ||
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80',
  });
  return item;
}

export async function updateFoodItem(foodId, actorUser, payload) {
  const item = await FoodItem.findById(foodId);
  if (!item) {
    throw new AppError('Food item not found', 404, 'FOOD_ITEM_NOT_FOUND');
  }
  await assertRestaurantOwnership(item.restaurantId, actorUser);

  const updatable = [
    'name',
    'description',
    'price',
    'category',
    'isVeg',
    'availability',
    'bestseller',
    'preparationTimeMins',
    'image',
  ];
  for (const field of updatable) {
    if (payload[field] !== undefined) {
      item[field] = payload[field];
    }
  }
  await item.save();
  return item;
}

export async function setFoodAvailability(foodId, actorUser, availability) {
  const item = await FoodItem.findById(foodId);
  if (!item) {
    throw new AppError('Food item not found', 404, 'FOOD_ITEM_NOT_FOUND');
  }
  await assertRestaurantOwnership(item.restaurantId, actorUser);

  item.availability = typeof availability === 'boolean' ? availability : !item.availability;
  await item.save();
  return item;
}

export async function deleteFoodItem(foodId, actorUser) {
  const item = await FoodItem.findById(foodId);
  if (!item) {
    throw new AppError('Food item not found', 404, 'FOOD_ITEM_NOT_FOUND');
  }
  await assertRestaurantOwnership(item.restaurantId, actorUser);
  await item.deleteOne();
  return { deletedId: foodId };
}
