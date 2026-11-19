import mongoose from 'mongoose';

export const PAYMENT_METHODS = ['COD', 'UPI_SIMULATED', 'CARD_SIMULATED'];
export const PAYMENT_STATES = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'];

const paymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Payment amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      trim: true,
    },
    method: {
      type: String,
      enum: PAYMENT_METHODS,
      default: 'UPI_SIMULATED',
    },
    status: {
      type: String,
      enum: PAYMENT_STATES,
      default: 'PENDING',
      index: true,
    },
    transactionRef: {
      type: String,
      trim: true,
      default: '',
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'payments',
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
