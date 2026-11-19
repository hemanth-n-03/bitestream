import {
  DeliveryPartner,
  FoodItem,
  Notification,
  Order,
  Payment,
  Restaurant,
  User,
} from '../models/index.js';
import AppError from '../utils/AppError.js';
import { escapeRegex } from '../utils/geoHelpers.js';

export async function getPlatformOverview() {
  const [
    totalUsers,
    totalCustomers,
    totalRestaurants,
    activeRestaurants,
    totalPartners,
    onlinePartners,
    totalOrders,
    orderAgg,
    restaurantPerfAgg,
    topDishesAgg,
    dailyTrendAgg,
    paymentAgg,
    partnerLeaderboard,
    foodItemsCount,
    paymentsCount,
    notificationsCount,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'customer' }),
    Restaurant.countDocuments(),
    Restaurant.countDocuments({ isActive: true }),
    DeliveryPartner.countDocuments(),
    DeliveryPartner.countDocuments({ availability: { $ne: 'OFFLINE' } }),
    Order.countDocuments(),
    Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
        },
      },
    ]),
    Order.aggregate([
      {
        $match: {
          status: { $nin: ['CANCELLED', 'REJECTED'] },
        },
      },
      {
        $group: {
          _id: '$restaurantId',
          orderCount: { $sum: 1 },
          deliveredCount: {
            $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] },
          },
          revenue: { $sum: '$totalAmount' },
        },
      },
      { $sort: { revenue: -1, orderCount: -1 } },
      { $limit: 8 },
      {
        $lookup: {
          from: 'restaurants',
          localField: '_id',
          foreignField: '_id',
          as: 'restaurant',
        },
      },
      { $unwind: { path: '$restaurant', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          restaurantId: '$_id',
          name: { $ifNull: ['$restaurant.name', 'Unknown Kitchen'] },
          area: { $ifNull: ['$restaurant.address.area', 'Mysuru'] },
          rating: { $ifNull: ['$restaurant.rating.average', 4.5] },
          orderCount: 1,
          deliveredCount: 1,
          revenue: 1,
          avgOrderValue: {
            $cond: [
              { $gt: ['$orderCount', 0] },
              { $round: [{ $divide: ['$revenue', '$orderCount'] }, 0] },
              0,
            ],
          },
        },
      },
    ]),
    Order.aggregate([
      { $match: { status: { $nin: ['CANCELLED', 'REJECTED'] } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.name',
          unitsSold: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.subtotal' },
          ordersCount: { $sum: 1 },
        },
      },
      { $sort: { unitsSold: -1, revenue: -1 } },
      { $limit: 6 },
      {
        $project: {
          _id: 0,
          name: '$_id',
          unitsSold: 1,
          revenue: 1,
          ordersCount: 1,
        },
      },
    ]),
    Order.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders: { $sum: 1 },
          delivered: {
            $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] },
          },
          cancelled: {
            $sum: {
              $cond: [{ $in: ['$status', ['CANCELLED', 'REJECTED']] }, 1, 0],
            },
          },
          revenue: {
            $sum: {
              $cond: [
                { $in: ['$status', ['CANCELLED', 'REJECTED']] },
                0,
                '$totalAmount',
              ],
            },
          },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 10 },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          orders: 1,
          delivered: 1,
          cancelled: 1,
          revenue: 1,
        },
      },
    ]),
    Payment.aggregate([
      {
        $group: {
          _id: { method: '$method', status: '$status' },
          count: { $sum: 1 },
          amount: { $sum: '$amount' },
        },
      },
      {
        $project: {
          _id: 0,
          method: '$_id.method',
          status: '$_id.status',
          count: 1,
          amount: 1,
        },
      },
    ]),
    DeliveryPartner.find()
      .select('name vehicleNumber availability totalDeliveries totalEarnings rating')
      .sort({ totalDeliveries: -1, rating: -1 })
      .limit(8)
      .lean(),
    FoodItem.countDocuments(),
    Payment.countDocuments(),
    Notification.countDocuments(),
  ]);

  const byStatus = {};
  let activeOrders = 0;
  let completedOrders = 0;
  let cancelledOrders = 0;
  let grossRevenue = 0;
  let nonCancelledOrders = 0;

  for (const row of orderAgg) {
    byStatus[row._id] = row.count;
    if (row._id === 'DELIVERED') {
      completedOrders += row.count;
      nonCancelledOrders += row.count;
      grossRevenue += row.revenue;
    } else if (row._id === 'CANCELLED' || row._id === 'REJECTED') {
      cancelledOrders += row.count;
    } else {
      activeOrders += row.count;
      nonCancelledOrders += row.count;
      grossRevenue += row.revenue;
    }
  }

  const avgOrderValue = nonCancelledOrders > 0 ? Math.round(grossRevenue / nonCancelledOrders) : 0;
  const completionRatePct =
    totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

  return {
    collections: {
      users: totalUsers,
      restaurants: totalRestaurants,
      food_items: foodItemsCount,
      orders: totalOrders,
      delivery_partners: totalPartners,
      payments: paymentsCount,
      notifications: notificationsCount,
    },
    metrics: {
      totalUsers,
      totalCustomers,
      totalRestaurants,
      activeRestaurants,
      totalPartners,
      onlinePartners,
      totalOrders,
      activeOrders,
      completedOrders,
      cancelledOrders,
      grossRevenue,
      avgOrderValue,
      completionRatePct,
      byStatus,
    },
    analytics: {
      restaurantPerformance: restaurantPerfAgg,
      topDishes: topDishesAgg,
      dailyTrend: dailyTrendAgg,
      paymentBreakdown: paymentAgg,
      partnerLeaderboard,
    },
  };
}

export async function getAdminOrders({
  status,
  restaurantId,
  startDate,
  endDate,
  search,
  page = 1,
  limit = 25,
}) {
  const filter = {};
  if (status && status !== 'ALL') filter.status = status;
  if (restaurantId) filter.restaurantId = restaurantId;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.orderNumber = regex;
  }

  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('customerId', 'name email phone')
      .populate('restaurantId', 'name address')
      .populate('deliveryPartnerId', 'name phone vehicleNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return {
    orders,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function listAllRestaurants() {
  return Restaurant.find().populate('ownerId', 'name email').sort({ createdAt: -1 }).lean();
}

export async function setRestaurantActiveStatus(restaurantId, isActive) {
  const rest = await Restaurant.findById(restaurantId);
  if (!rest) {
    throw new AppError('Restaurant not found', 404, 'RESTAURANT_NOT_FOUND');
  }
  rest.isActive = typeof isActive === 'boolean' ? isActive : !rest.isActive;
  await rest.save();
  return rest;
}

export async function listAllUsers() {
  return User.find().sort({ createdAt: -1 }).lean();
}

export async function setUserActiveStatus(targetUserId, adminUserId, isActive) {
  if (targetUserId === adminUserId.toString()) {
    throw new AppError('Administrators cannot disable their own account.', 400, 'SELF_DISABLE_BLOCKED');
  }
  const user = await User.findById(targetUserId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }
  user.isActive = typeof isActive === 'boolean' ? isActive : !user.isActive;
  await user.save();
  return user;
}

export async function listAllPartners() {
  return DeliveryPartner.find().populate('userId', 'email isActive').sort({ createdAt: -1 }).lean();
}
