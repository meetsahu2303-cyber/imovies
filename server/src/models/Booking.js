import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    show: { type: mongoose.Schema.Types.ObjectId, ref: 'Show', required: true },
    movieTitle: String,
    poster: String,
    theatreName: String,
    city: String,
    screenName: String,
    startsAt: Date,
    seats: [{ _id: false, seatId: String, tier: String }],
    amount: {
      subtotal: Number,
      fee: Number,
      total: Number,
      currency: { type: String, default: 'INR' },
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'expired'],
      default: 'pending',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'refund_pending', 'refunded', 'refund_failed'],
      default: 'unpaid',
    },
    holdId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    idempotencyKey: { type: String, required: true },
    confirmedAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true },
);
schema.index({ user: 1, createdAt: -1 });
schema.index({ user: 1, idempotencyKey: 1 }, { unique: true });
schema.index({ show: 1, status: 1 });
schema.index({ status: 1, expiresAt: 1 });
export const Booking = mongoose.model('Booking', schema);
const paymentSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, enum: ['demo', 'stripe'], required: true },
    providerRef: { type: String, unique: true, sparse: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'refunded'],
      default: 'pending',
    },
    checkoutUrl: String,
    checkoutExpiresAt: Date,
    paymentIntent: String,
    failureReason: String,
  },
  { timestamps: true },
);
paymentSchema.index(
  { booking: 1, provider: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);
export const Payment = mongoose.model('Payment', paymentSchema);
const eventSchema = new mongoose.Schema(
  {
    providerEventId: { type: String, required: true, unique: true },
    type: String,
  },
  { timestamps: true },
);
eventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });
export const WebhookEvent = mongoose.model('WebhookEvent', eventSchema);
