import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import { validateEnv } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import {
  DeliveryPartner,
  FoodItem,
  Notification,
  Order,
  Payment,
  Restaurant,
  User,
} from '../models/index.js';

const SEED_EMAIL_DOMAIN = '@bitestream.dev';

const SEEDED_CUSTOMERS = [
  {
    name: 'Ananya Rao',
    email: 'ananya@bitestream.dev',
    phone: '+91 98450 22190',
    role: 'customer',
    address: {
      label: 'Home',
      street: '42, 5th Main, Gokulam 3rd Stage',
      area: 'Gokulam',
      city: 'Mysuru',
      pincode: '570002',
      location: { type: 'Point', coordinates: [76.6258, 12.3282] },
    },
  },
  {
    name: 'Rohan Kulkarni',
    email: 'rohan@bitestream.dev',
    phone: '+91 99001 45321',
    role: 'customer',
    address: {
      label: 'Apartment',
      street: '18, Kalidasa Road, VV Mohalla',
      area: 'VV Mohalla',
      city: 'Mysuru',
      pincode: '570002',
      location: { type: 'Point', coordinates: [76.6299, 12.3198] },
    },
  },
];

const SEEDED_RESTAURANTS = [
  {
    owner: {
      name: 'Mylari Kitchen Partner',
      email: 'owner.mylari@bitestream.dev',
      phone: '+91 821 252 0190',
    },
    restaurant: {
      name: 'Mylari Heritage Kitchen',
      description:
        'Iconic Mysuru butter masala dosas, fluffy idlis, and roasted filter kaapi served fresh off cast-iron tawa.',
      cuisineTypes: ['South Indian', 'Beverages'],
      address: {
        street: 'Nazarbad Main Road',
        area: 'Nazarbad',
        city: 'Mysuru',
        pincode: '570010',
      },
      location: { type: 'Point', coordinates: [76.6634, 12.3079] },
      openingHours: { open: '07:00', close: '22:00' },
      rating: { average: 4.8, count: 1420 },
      prepTimeMins: 14,
      priceForTwo: 280,
      isVegOnly: true,
      isOpen: true,
      isActive: true,
      featuredTag: 'Mysuru Classic',
      image:
        'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=900&q=80',
    },
    menu: [
      {
        name: 'Mysuru Butter Masala Dosa',
        description:
          'Golden crisp sponge dosa generously topped with fresh white butter & coconut chutney.',
        price: 110,
        category: 'South Indian',
        isVeg: true,
        availability: true,
        bestseller: true,
        preparationTimeMins: 12,
        image:
          'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=500&q=80',
      },
      {
        name: 'Mallige Idli & Vada Combo',
        description:
          'Three cloud-soft steamed idlis paired with a crispy medu vada and piping hot sambar.',
        price: 95,
        category: 'South Indian',
        isVeg: true,
        availability: true,
        bestseller: true,
        preparationTimeMins: 10,
        image:
          'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=500&q=80',
      },
      {
        name: 'Chikmagalur Degree Filter Kaapi',
        description:
          'Single-estate 80:20 coffee decoction frothed with farm milk in an insulated flask.',
        price: 55,
        category: 'Beverages',
        isVeg: true,
        availability: true,
        bestseller: false,
        preparationTimeMins: 6,
        image:
          'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=500&q=80',
      },
      {
        name: 'Ghee Khara Bath & Kesari Combo',
        description:
          'Classic Mysuru chow-chow bath made with pure Nandini ghee and roasted cashews.',
        price: 105,
        category: 'South Indian',
        isVeg: true,
        availability: true,
        bestseller: false,
        preparationTimeMins: 10,
        image:
          'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=500&q=80',
      },
    ],
  },
  {
    owner: {
      name: 'Kalidasa Spice Partner',
      email: 'owner.kalidasa@bitestream.dev',
      phone: '+91 821 241 8820',
    },
    restaurant: {
      name: 'Kalidasa Spice Route',
      description:
        'Slow-cooked Donne Biryani, charcoal kebabs, and regional Karnataka curries crafted in small batches.',
      cuisineTypes: ['Biryani', 'North Indian'],
      address: {
        street: 'Kalidasa Road',
        area: 'VV Mohalla',
        city: 'Mysuru',
        pincode: '570002',
      },
      location: { type: 'Point', coordinates: [76.6285, 12.3214] },
      openingHours: { open: '11:30', close: '23:30' },
      rating: { average: 4.6, count: 980 },
      prepTimeMins: 22,
      priceForTwo: 560,
      isVegOnly: false,
      isOpen: true,
      isActive: true,
      featuredTag: 'Top Rated',
      image:
        'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=900&q=80',
    },
    menu: [
      {
        name: 'Natti Chicken Donne Biryani',
        description:
          'Fragrant seeraga samba rice cooked in fresh coriander-mint masala and tender chicken.',
        price: 260,
        category: 'Biryani',
        isVeg: false,
        availability: true,
        bestseller: true,
        preparationTimeMins: 20,
        image:
          'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=500&q=80',
      },
      {
        name: 'Mushroom Pepper Donne Biryani',
        description:
          'Seeraga samba biryani tossed with cracked black pepper, button mushrooms, and raita.',
        price: 210,
        category: 'Biryani',
        isVeg: true,
        availability: true,
        bestseller: false,
        preparationTimeMins: 18,
        image:
          'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=500&q=80',
      },
      {
        name: 'Charcoal Malai Chicken Tikka',
        description: '6-piece smoky boneless morsels marinated in cashew cream and cardamom.',
        price: 290,
        category: 'North Indian',
        isVeg: false,
        availability: true,
        bestseller: true,
        preparationTimeMins: 22,
        image:
          'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=500&q=80',
      },
    ],
  },
  {
    owner: {
      name: 'Gokulam Bowl Partner',
      email: 'owner.gokulam-bowl@bitestream.dev',
      phone: '+91 821 251 4401',
    },
    restaurant: {
      name: 'Gokulam Green Bowl Co.',
      description:
        'Protein-rich millet bowls, cold-pressed juices, and wholesome sourdough wraps in leafy Gokulam.',
      cuisineTypes: ['Bowls', 'Beverages'],
      address: {
        street: 'Contour Road, 3rd Stage',
        area: 'Gokulam',
        city: 'Mysuru',
        pincode: '570002',
      },
      location: { type: 'Point', coordinates: [76.6231, 12.3301] },
      openingHours: { open: '08:30', close: '22:00' },
      rating: { average: 4.7, count: 510 },
      prepTimeMins: 15,
      priceForTwo: 440,
      isVegOnly: true,
      isOpen: true,
      isActive: true,
      featuredTag: '15-Min Dispatch',
      image:
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80',
    },
    menu: [
      {
        name: 'Teriyaki Tofu & Quinoa Harvest Bowl',
        description: 'Sesame roasted tofu, edamame, avocado, pickled radish, and warm quinoa.',
        price: 245,
        category: 'Bowls',
        isVeg: true,
        availability: true,
        bestseller: true,
        preparationTimeMins: 14,
        image:
          'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=500&q=80',
      },
      {
        name: 'Peri-Peri Paneer Millet Bowl',
        description: 'Grilled cottage cheese over foxtail millet pilaf with roasted bell peppers.',
        price: 235,
        category: 'Bowls',
        isVeg: true,
        availability: true,
        bestseller: false,
        preparationTimeMins: 15,
        image:
          'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80',
      },
      {
        name: 'Cold-Pressed Watermelon Mint Cooler',
        description: 'Zero added sugar cold-pressed hydration bottle (300 ml).',
        price: 99,
        category: 'Beverages',
        isVeg: true,
        availability: true,
        bestseller: false,
        preparationTimeMins: 5,
        image:
          'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=500&q=80',
      },
    ],
  },
  {
    owner: {
      name: 'Chamundi Tandoor Partner',
      email: 'owner.chamundi@bitestream.dev',
      phone: '+91 821 254 9022',
    },
    restaurant: {
      name: 'Chamundi Tandoor & Curries',
      description:
        'Smoky clay-oven rotis, rich paneer makhani, and Kashmiri pulao with generous family-style portions.',
      cuisineTypes: ['North Indian', 'Biryani'],
      address: {
        street: '1st Main Road',
        area: 'Saraswathipuram',
        city: 'Mysuru',
        pincode: '570009',
      },
      location: { type: 'Point', coordinates: [76.6332, 12.3011] },
      openingHours: { open: '12:00', close: '23:00' },
      rating: { average: 4.5, count: 730 },
      prepTimeMins: 24,
      priceForTwo: 620,
      isVegOnly: false,
      isOpen: true,
      isActive: true,
      featuredTag: '20% Off Orders > ₹399',
      image:
        'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=80',
    },
    menu: [
      {
        name: 'Smoky Paneer Makhani & 2 Butter Naan',
        description: 'Velvety tomato-cashew gravy paired with blistered clay-oven butter naan.',
        price: 275,
        category: 'North Indian',
        isVeg: true,
        availability: true,
        bestseller: true,
        preparationTimeMins: 20,
        image:
          'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=500&q=80',
      },
      {
        name: 'Awadhi Mutton Dum Biryani',
        description: 'Saffron-kissed long-grain basmati slow-cooked on dum with bone-in mutton.',
        price: 340,
        category: 'Biryani',
        isVeg: false,
        availability: true,
        bestseller: true,
        preparationTimeMins: 24,
        image:
          'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=500&q=80',
      },
      {
        name: 'Dal Tadka & Jeera Rice Bowl',
        description: 'Tempered yellow lentils finished with garlic ghee over fragrant cumin rice.',
        price: 190,
        category: 'North Indian',
        isVeg: true,
        availability: true,
        bestseller: false,
        preparationTimeMins: 16,
        image:
          'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=500&q=80',
      },
    ],
  },
  {
    owner: {
      name: 'Devaraja Chaats Partner',
      email: 'owner.devaraja@bitestream.dev',
      phone: '+91 821 242 6670',
    },
    restaurant: {
      name: 'Devaraja Heritage Chaats',
      description:
        'Crispy masala puri, nippat masala, gobi manchurian, and Mysuru bonda packed tamper-proof.',
      cuisineTypes: ['Street Food', 'Beverages'],
      address: {
        street: 'Dhanvantri Road',
        area: 'Devaraja Mohalla',
        city: 'Mysuru',
        pincode: '570001',
      },
      location: { type: 'Point', coordinates: [76.6498, 12.3095] },
      openingHours: { open: '15:00', close: '22:30' },
      rating: { average: 4.4, count: 640 },
      prepTimeMins: 12,
      priceForTwo: 220,
      isVegOnly: true,
      isOpen: true,
      isActive: true,
      featuredTag: 'Pocket Friendly',
      image:
        'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80',
    },
    menu: [
      {
        name: 'Mysuru Hot Masala Puri',
        description: 'Crushed puris drenched in slow-simmered green peas gravy, sev, and coriander.',
        price: 75,
        category: 'Street Food',
        isVeg: true,
        availability: true,
        bestseller: true,
        preparationTimeMins: 10,
        image:
          'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=500&q=80',
      },
      {
        name: 'Crispy Nippat Masala Plate',
        description:
          'Spiced rice-cracker chaat topped with grated carrots, onions, peanuts, and tangy chutney.',
        price: 85,
        category: 'Street Food',
        isVeg: true,
        availability: true,
        bestseller: false,
        preparationTimeMins: 10,
        image:
          'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=500&q=80',
      },
      {
        name: 'Spiced Masala Badam Milk',
        description: 'Chilled saffron-almond milk infused with crushed cardamom and pistachios.',
        price: 65,
        category: 'Beverages',
        isVeg: true,
        availability: true,
        bestseller: false,
        preparationTimeMins: 5,
        image:
          'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=500&q=80',
      },
    ],
  },
  {
    owner: {
      name: 'Velvet Churn Partner',
      email: 'owner.velvet@bitestream.dev',
      phone: '+91 821 256 7711',
    },
    restaurant: {
      name: 'Velvet Churn Gelato & Waffles',
      description:
        'Small-batch Belgian waffles, Mysuru Pak tiramisu tubs, and hazelnut dark chocolate sundaes.',
      cuisineTypes: ['Desserts', 'Beverages'],
      address: {
        street: 'Panchamantra Road',
        area: 'Kuvempunagar',
        city: 'Mysuru',
        pincode: '570023',
      },
      location: { type: 'Point', coordinates: [76.6208, 12.2869] },
      openingHours: { open: '11:00', close: '00:30' },
      rating: { average: 4.9, count: 410 },
      prepTimeMins: 12,
      priceForTwo: 360,
      isVegOnly: true,
      isOpen: true,
      isActive: true,
      featuredTag: 'Late Night',
      image:
        'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=80',
    },
    menu: [
      {
        name: 'Belgian Dark Chocolate Waffle',
        description:
          'Crisp Liege-style waffle drizzled with 54% Belgian dark couverture & vanilla scoop.',
        price: 185,
        category: 'Desserts',
        isVeg: true,
        availability: true,
        bestseller: true,
        preparationTimeMins: 12,
        image:
          'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=500&q=80',
      },
      {
        name: 'Roasted Hazelnut Gelato Tub (300 ml)',
        description: 'Creamy Italian-style churned gelato loaded with toasted Piedmont hazelnuts.',
        price: 230,
        category: 'Desserts',
        isVeg: true,
        availability: false,
        bestseller: false,
        preparationTimeMins: 8,
        image:
          'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=500&q=80',
      },
      {
        name: 'Mysuru Pak Tiramisu Jar',
        description:
          'Mascarpone mousse layered with espresso sponge and caramelized gram-flour crumble.',
        price: 165,
        category: 'Desserts',
        isVeg: true,
        availability: true,
        bestseller: true,
        preparationTimeMins: 8,
        image:
          'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=500&q=80',
      },
    ],
  },
  {
    owner: {
      name: 'Hebbal Wok Partner',
      email: 'owner.hebbal-wok@bitestream.dev',
      phone: '+91 821 249 3310',
    },
    restaurant: {
      name: 'Hebbal Wok & Dumpling House',
      description:
        'High-flame Sichuan noodles, hand-folded steamed momos, and fragrant Thai curry bowls.',
      cuisineTypes: ['Bowls', 'Street Food'],
      address: {
        street: 'Ring Road, Hebbal 2nd Stage',
        area: 'Hebbal',
        city: 'Mysuru',
        pincode: '570016',
      },
      location: { type: 'Point', coordinates: [76.6142, 12.3438] },
      openingHours: { open: '12:00', close: '23:00' },
      rating: { average: 4.5, count: 315 },
      prepTimeMins: 19,
      priceForTwo: 480,
      isVegOnly: false,
      isOpen: true,
      isActive: true,
      featuredTag: 'North Mysuru',
      image:
        'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80',
    },
    menu: [
      {
        name: 'Chilli Garlic Hakka Noodles Bowl',
        description: 'Wok-tossed noodles with charred bell peppers, scallions, and sesame soy.',
        price: 195,
        category: 'Bowls',
        isVeg: true,
        availability: true,
        bestseller: true,
        preparationTimeMins: 16,
        image:
          'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=500&q=80',
      },
      {
        name: 'Steamed Chicken & Chive Dumplings (8 pcs)',
        description: 'Juicy hand-pleated dumplings served with roasted chilli oil dip.',
        price: 175,
        category: 'Street Food',
        isVeg: false,
        availability: true,
        bestseller: false,
        preparationTimeMins: 15,
        image:
          'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=500&q=80',
      },
    ],
  },
  {
    owner: {
      name: 'Jayalakshmipuram Brews Partner',
      email: 'owner.jaya-brews@bitestream.dev',
      phone: '+91 821 251 9920',
    },
    restaurant: {
      name: 'Jayalakshmipuram Filter Brews',
      description:
        'Artisanal South Indian tiffin, crispy set dosa, and slow-dripped cold brew tonics.',
      cuisineTypes: ['South Indian', 'Beverages', 'Desserts'],
      address: {
        street: 'Temple Road, Jayalakshmipuram',
        area: 'Jayalakshmipuram',
        city: 'Mysuru',
        pincode: '570012',
      },
      location: { type: 'Point', coordinates: [76.6279, 12.3137] },
      openingHours: { open: '07:30', close: '22:00' },
      rating: { average: 4.7, count: 485 },
      prepTimeMins: 14,
      priceForTwo: 310,
      isVegOnly: true,
      isOpen: true,
      isActive: true,
      featuredTag: 'Breakfast Fav',
      image:
        'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80',
    },
    menu: [
      {
        name: 'Podi Ghee Set Dosa (3 pcs)',
        description:
          'Spongy fermented dosas dusted with roasted lentil podi and served with veg kurma.',
        price: 115,
        category: 'South Indian',
        isVeg: true,
        availability: true,
        bestseller: true,
        preparationTimeMins: 12,
        image:
          'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=500&q=80',
      },
      {
        name: 'Coorg Cold Brew Tonic',
        description: '18-hour steeped Chikmagalur Arabica over chilled citrus tonic water.',
        price: 130,
        category: 'Beverages',
        isVeg: true,
        availability: true,
        bestseller: false,
        preparationTimeMins: 5,
        image:
          'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=500&q=80',
      },
    ],
  },
];

const SEEDED_PARTNERS = [
  {
    name: 'Karthik Gowda',
    email: 'rider.karthik@bitestream.dev',
    phone: '+91 97412 88310',
    vehicleType: 'Electric Scooter',
    vehicleNumber: 'KA-09-EV-4821',
    availability: 'ONLINE',
    coordinates: [76.6421, 12.3175],
    totalDeliveries: 412,
    totalEarnings: 38450,
    rating: 4.9,
  },
  {
    name: 'Mahesh Naik',
    email: 'rider.mahesh@bitestream.dev',
    phone: '+91 96112 74509',
    vehicleType: 'Motorcycle',
    vehicleNumber: 'KA-09-HT-1190',
    availability: 'ONLINE',
    coordinates: [76.6264, 12.3261],
    totalDeliveries: 289,
    totalEarnings: 27100,
    rating: 4.7,
  },
  {
    name: 'Divya Shetty',
    email: 'rider.divya@bitestream.dev',
    phone: '+91 94480 65219',
    vehicleType: 'Electric Scooter',
    vehicleNumber: 'KA-09-EV-9023',
    availability: 'OFFLINE',
    coordinates: [76.6368, 12.3029],
    totalDeliveries: 156,
    totalEarnings: 14920,
    rating: 4.8,
  },
  {
    name: 'Prashanth Urs',
    email: 'rider.prashanth@bitestream.dev',
    phone: '+91 98802 31450',
    vehicleType: 'Motorcycle',
    vehicleNumber: 'KA-09-MJ-6642',
    availability: 'ONLINE',
    coordinates: [76.6215, 12.2912],
    totalDeliveries: 204,
    totalEarnings: 19380,
    rating: 4.6,
  },
];

async function upsertUser({ name, email, phone, role, passwordHash, address }) {
  const existing = await User.findOne({ email });
  if (existing) {
    existing.name = name;
    existing.phone = phone;
    existing.role = role;
    if (address) existing.address = address;
    await existing.save();
    return { doc: existing, created: false };
  }
  const doc = await User.create({
    name,
    email,
    phone,
    role,
    passwordHash,
    address: address || {},
  });
  return { doc, created: true };
}

export async function resetSeedData({ confirmReset = false } = {}) {
  if (!confirmReset) {
    throw new Error(
      'Refusing to reset seeded data without explicit confirmation (--confirm-reset).'
    );
  }

  const seededUsers = await User.find({
    email: { $regex: `${SEED_EMAIL_DOMAIN}$`, $options: 'i' },
  }).select('_id');

  const seededUserIds = seededUsers.map((u) => u._id);
  if (seededUserIds.length === 0) {
    return { removedUsers: 0, removedRestaurants: 0, removedFoodItems: 0, removedPartners: 0 };
  }

  const seededRestaurants = await Restaurant.find({ ownerId: { $in: seededUserIds } }).select('_id');
  const seededRestaurantIds = seededRestaurants.map((r) => r._id);

  const [demoOrderRes, demoPayRes, demoNotifRes] = await Promise.all([
    Order.deleteMany({ orderNumber: /^BS-DEMO-/ }),
    Payment.deleteMany({ transactionRef: /^COD-BS-DEMO-/ }),
    Notification.deleteMany({ dedupeKey: /^demo:/ }),
  ]);

  const [foodRes, restRes, dpRes, userRes] = await Promise.all([
    FoodItem.deleteMany({ restaurantId: { $in: seededRestaurantIds } }),
    Restaurant.deleteMany({ _id: { $in: seededRestaurantIds } }),
    DeliveryPartner.deleteMany({ userId: { $in: seededUserIds } }),
    User.deleteMany({ _id: { $in: seededUserIds } }),
  ]);

  return {
    removedUsers: userRes.deletedCount || 0,
    removedRestaurants: restRes.deletedCount || 0,
    removedFoodItems: foodRes.deletedCount || 0,
    removedPartners: dpRes.deletedCount || 0,
    removedDemoOrders: demoOrderRes.deletedCount || 0,
    removedDemoPayments: demoPayRes.deletedCount || 0,
    removedDemoNotifications: demoNotifRes.deletedCount || 0,
  };
}

async function seedDemoOrders() {
  const [customers, restaurants, partners] = await Promise.all([
    User.find({ email: { $in: ['ananya@bitestream.dev', 'rohan@bitestream.dev'] } }).lean(),
    Restaurant.find({ name: { $in: SEEDED_RESTAURANTS.map((r) => r.restaurant.name) } }).lean(),
    DeliveryPartner.find({
      name: { $in: ['Karthik Gowda', 'Mahesh Naik', 'Prashanth Urs'] },
    }).lean(),
  ]);

  if (customers.length === 0 || restaurants.length === 0) {
    return { demoOrdersCreated: 0 };
  }

  const allFoods = await FoodItem.find({
    restaurantId: { $in: restaurants.map((r) => r._id) },
    availability: true,
  }).lean();

  const foodsByRest = new Map();
  for (const f of allFoods) {
    const k = f.restaurantId.toString();
    if (!foodsByRest.has(k)) foodsByRest.set(k, []);
    foodsByRest.get(k).push(f);
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const specs = [
    { num: 'BS-DEMO-1001', restIdx: 0, custIdx: 0, partIdx: 0, status: 'DELIVERED', daysAgo: 4 },
    { num: 'BS-DEMO-1002', restIdx: 1, custIdx: 1, partIdx: 1, status: 'DELIVERED', daysAgo: 4 },
    { num: 'BS-DEMO-1003', restIdx: 2, custIdx: 0, partIdx: 2, status: 'DELIVERED', daysAgo: 3 },
    { num: 'BS-DEMO-1004', restIdx: 3, custIdx: 1, partIdx: 0, status: 'DELIVERED', daysAgo: 3 },
    { num: 'BS-DEMO-1005', restIdx: 0, custIdx: 1, partIdx: 1, status: 'DELIVERED', daysAgo: 2 },
    { num: 'BS-DEMO-1006', restIdx: 4, custIdx: 0, partIdx: 2, status: 'DELIVERED', daysAgo: 2 },
    { num: 'BS-DEMO-1007', restIdx: 1, custIdx: 0, partIdx: 0, status: 'DELIVERED', daysAgo: 1 },
    { num: 'BS-DEMO-1008', restIdx: 5, custIdx: 1, partIdx: 1, status: 'DELIVERED', daysAgo: 1 },
    { num: 'BS-DEMO-1009', restIdx: 2, custIdx: 0, partIdx: null, status: 'PREPARING', daysAgo: 0 },
    { num: 'BS-DEMO-1010', restIdx: 0, custIdx: 1, partIdx: null, status: 'CANCELLED', daysAgo: 1 },
  ];

  let demoOrdersCreated = 0;

  for (const spec of specs) {
    const existing = await Order.findOne({ orderNumber: spec.num }).select('_id').lean();
    if (existing) continue;

    const rest = restaurants[spec.restIdx % restaurants.length];
    const cust = customers[spec.custIdx % customers.length];
    const restFoods = foodsByRest.get(rest._id.toString()) || [];
    if (restFoods.length === 0) continue;

    const chosen = restFoods.slice(0, 2).map((f, idx) => {
      const qty = idx === 0 ? 2 : 1;
      return {
        foodItemId: f._id,
        name: f.name,
        price: f.price,
        quantity: qty,
        subtotal: f.price * qty,
      };
    });

    const itemsTotal = chosen.reduce((s, i) => s + i.subtotal, 0);
    const deliveryFee = itemsTotal >= 399 ? 0 : 25;
    const taxAmount = Math.round(itemsTotal * 0.05);
    const totalAmount = itemsTotal + deliveryFee + taxAmount;
    const partner =
      spec.partIdx !== null && partners[spec.partIdx % partners.length]
        ? partners[spec.partIdx % partners.length]
        : null;
    const createdAt = new Date(now - spec.daysAgo * dayMs - spec.restIdx * 3600000);
    const paymentStatus =
      spec.status === 'DELIVERED'
        ? 'PAID'
        : spec.status === 'CANCELLED'
        ? 'FAILED'
        : 'PENDING';

    const orderDoc = await Order.create({
      orderNumber: spec.num,
      customerId: cust._id,
      restaurantId: rest._id,
      deliveryPartnerId: partner?._id || null,
      items: chosen,
      itemsTotal,
      deliveryFee,
      taxAmount,
      totalAmount,
      deliveryAddress: {
        label: cust.address?.label || 'Home',
        street: cust.address?.street || '42, 5th Main, Gokulam',
        area: cust.address?.area || 'Gokulam',
        city: 'Mysuru',
      },
      deliveryLocation: cust.address?.location || {
        type: 'Point',
        coordinates: [76.6258, 12.3282],
      },
      status: spec.status,
      assignmentStatus: partner ? 'ACCEPTED' : 'NONE',
      statusHistory: [
        { status: 'PLACED', timestamp: createdAt, updatedBy: cust._id, note: 'Demo seed order' },
        { status: spec.status, timestamp: new Date(createdAt.getTime() + 900000), updatedBy: null, note: `Demo state ${spec.status}` },
      ],
      paymentStatus,
      estimatedDistanceKm: 2.8,
      createdAt,
      updatedAt: new Date(createdAt.getTime() + 900000),
    });

    await Payment.create({
      orderId: orderDoc._id,
      customerId: cust._id,
      amount: totalAmount,
      currency: 'INR',
      method: 'COD',
      status:
        spec.status === 'DELIVERED'
          ? 'SUCCESS'
          : spec.status === 'CANCELLED'
          ? 'FAILED'
          : 'PENDING',
      transactionRef: `COD-${spec.num}`,
      paidAt: spec.status === 'DELIVERED' ? new Date(createdAt.getTime() + 900000) : null,
    });

    demoOrdersCreated += 1;
  }

  return { demoOrdersCreated };
}

export async function seedDatabase({
  reset = false,
  confirmReset = false,
  withOrders = false,
} = {}) {
  let resetSummary = null;
  if (reset) {
    resetSummary = await resetSeedData({ confirmReset });
  }

  await Promise.all([
    User.syncIndexes(),
    Restaurant.syncIndexes(),
    FoodItem.syncIndexes(),
    DeliveryPartner.syncIndexes(),
  ]);

  const defaultHash = await bcrypt.hash('SeedPass@2026', 10);
  const summary = {
    usersCreated: 0,
    usersUpdated: 0,
    restaurantsCreated: 0,
    restaurantsUpdated: 0,
    foodItemsCreated: 0,
    foodItemsUpdated: 0,
    partnersCreated: 0,
    partnersUpdated: 0,
    resetSummary,
  };

  // 1. Seed sample customers & synthetic admin
  for (const cust of SEEDED_CUSTOMERS) {
    const res = await upsertUser({ ...cust, passwordHash: defaultHash });
    if (res.created) summary.usersCreated += 1;
    else summary.usersUpdated += 1;
  }

  const adminRes = await upsertUser({
    name: 'BiteStream Seed Admin',
    email: 'admin@bitestream.dev',
    phone: '+91 821 400 0900',
    role: 'admin',
    passwordHash: defaultHash,
  });
  if (adminRes.created) summary.usersCreated += 1;
  else summary.usersUpdated += 1;

  // 2. Seed restaurant owners, restaurants, and menus
  for (const entry of SEEDED_RESTAURANTS) {
    const ownerRes = await upsertUser({
      ...entry.owner,
      role: 'restaurant',
      passwordHash: defaultHash,
    });
    if (ownerRes.created) summary.usersCreated += 1;
    else summary.usersUpdated += 1;

    let restDoc = await Restaurant.findOne({
      ownerId: ownerRes.doc._id,
      name: entry.restaurant.name,
    });

    if (restDoc) {
      Object.assign(restDoc, entry.restaurant, { ownerId: ownerRes.doc._id });
      await restDoc.save();
      summary.restaurantsUpdated += 1;
    } else {
      restDoc = await Restaurant.create({
        ...entry.restaurant,
        ownerId: ownerRes.doc._id,
      });
      summary.restaurantsCreated += 1;
    }

    for (const item of entry.menu) {
      const existingFood = await FoodItem.findOne({
        restaurantId: restDoc._id,
        name: item.name,
      });
      if (existingFood) {
        Object.assign(existingFood, item, { restaurantId: restDoc._id });
        await existingFood.save();
        summary.foodItemsUpdated += 1;
      } else {
        await FoodItem.create({
          ...item,
          restaurantId: restDoc._id,
        });
        summary.foodItemsCreated += 1;
      }
    }
  }

  // 3. Seed delivery partner users & profiles
  for (const partner of SEEDED_PARTNERS) {
    const userRes = await upsertUser({
      name: partner.name,
      email: partner.email,
      phone: partner.phone,
      role: 'delivery',
      passwordHash: defaultHash,
    });
    if (userRes.created) summary.usersCreated += 1;
    else summary.usersUpdated += 1;

    const existingDp = await DeliveryPartner.findOne({ userId: userRes.doc._id });
    const dpPayload = {
      userId: userRes.doc._id,
      name: partner.name,
      phone: partner.phone,
      vehicleType: partner.vehicleType,
      vehicleNumber: partner.vehicleNumber,
      availability: partner.availability,
      currentLocation: { type: 'Point', coordinates: partner.coordinates },
      totalDeliveries: partner.totalDeliveries,
      totalEarnings: partner.totalEarnings,
      rating: partner.rating,
    };

    if (existingDp) {
      Object.assign(existingDp, dpPayload);
      await existingDp.save();
      summary.partnersUpdated += 1;
    } else {
      await DeliveryPartner.create(dpPayload);
      summary.partnersCreated += 1;
    }
  }

  if (withOrders) {
    const demoRes = await seedDemoOrders();
    summary.demoOrdersCreated = demoRes.demoOrdersCreated;
  }

  return summary;
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCli) {
  const reset = process.argv.includes('--reset');
  const confirmReset = process.argv.includes('--confirm-reset');
  const withOrders = process.argv.includes('--with-orders');

  validateEnv();
  connectDatabase()
    .then(() => seedDatabase({ reset, confirmReset, withOrders }))
    .then((summary) => {
      console.log('[BiteStream Seed] Completed:', JSON.stringify(summary, null, 2));
      return disconnectDatabase();
    })
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error('[BiteStream Seed] Failed:', err.message);
      await disconnectDatabase();
      process.exit(1);
    });
}
