import mongoose from 'mongoose';

const foodItemSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'restaurantId is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Food item name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [120, 'Name cannot exceed 120 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [1, 'Price must be greater than 0'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      index: true,
    },
    image: {
      type: String,
      default: '',
    },
    isVeg: {
      type: Boolean,
      default: true,
    },
    availability: {
      type: Boolean,
      default: true,
      index: true,
    },
    bestseller: {
      type: Boolean,
      default: false,
    },
    preparationTimeMins: {
      type: Number,
      default: 15,
      min: 3,
      max: 120,
    },
  },
  {
    collection: 'food_items',
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

foodItemSchema.index({ restaurantId: 1, category: 1 });

const FoodItem = mongoose.model('FoodItem', foodItemSchema);
export default FoodItem;
