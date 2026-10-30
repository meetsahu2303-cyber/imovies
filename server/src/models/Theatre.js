import mongoose from 'mongoose';
const screenSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rows: { type: Number, required: true, min: 3, max: 15 },
  columns: { type: Number, required: true, min: 4, max: 18 },
  aisleAfter: { type: Number, required: true },
  premiumFrom: { type: Number, required: true },
  active: { type: Boolean, default: true },
});
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true },
    city: { type: String, required: true, index: true },
    address: { type: String, required: true, maxlength: 300 },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [72.8777, 19.076] },
    },
    amenities: {
      type: [String],
      default: ['Dolby Atmos', 'Food & drinks', 'Accessible seating'],
    },
    screens: { type: [screenSchema], required: true },
    active: { type: Boolean, default: true },
    scheduleVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);
schema.index({ location: '2dsphere' });
export const Theatre = mongoose.model('Theatre', schema);
const seatSchema = new mongoose.Schema(
  {
    theatre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Theatre',
      required: true,
    },
    screen: { type: mongoose.Schema.Types.ObjectId, required: true },
    seatId: { type: String, required: true },
    row: String,
    number: Number,
    tier: { type: String, enum: ['standard', 'premium'] },
    active: { type: Boolean, default: true },
    scheduleVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);
seatSchema.index({ theatre: 1, screen: 1, seatId: 1 }, { unique: true });
export const Seat = mongoose.model('Seat', seatSchema);
