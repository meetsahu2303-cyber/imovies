import mongoose from 'mongoose';
export const showSeatSchema = new mongoose.Schema(
  {
    seatId: { type: String, required: true },
    row: String,
    number: Number,
    tier: { type: String, enum: ['standard', 'premium'] },
    status: {
      type: String,
      enum: ['available', 'held', 'booked'],
      default: 'available',
    },
    holdId: String,
    holdOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    holdUntil: Date,
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  },
  { _id: false },
);
const schema = new mongoose.Schema(
  {
    movie: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Movie',
      required: true,
    },
    theatre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Theatre',
      required: true,
    },
    screen: { type: mongoose.Schema.Types.ObjectId, required: true },
    screenName: String,
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    basePrice: { type: Number, required: true, min: 100, integer: true },
    premiumPrice: { type: Number, required: true, min: 100, integer: true },
    format: { type: String, enum: ['2D', 'IMAX', '4DX'], default: '2D' },
    language: { type: String, required: true },
    status: {
      type: String,
      enum: ['scheduled', 'cancelled', 'completed'],
      default: 'scheduled',
    },
    seats: { type: [showSeatSchema], required: true },
  },
  { timestamps: true },
);
schema.index({ movie: 1, startsAt: 1, status: 1 });
schema.index({ theatre: 1, screen: 1, startsAt: 1, endsAt: 1 });
schema.index({ 'seats.holdUntil': 1, 'seats.status': 1 });
export const Show = mongoose.model('Show', schema);
export function publicSeats(show) {
  const now = new Date();
  return {
    seats: show.seats.map((s) => ({
      seatId: s.seatId,
      row: s.row,
      number: s.number,
      tier: s.tier,
      status: s.status === 'held' && s.holdUntil <= now ? 'available' : s.status,
    })),
    basePrice: show.basePrice,
    premiumPrice: show.premiumPrice,
  };
}
