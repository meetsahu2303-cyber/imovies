import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, required: true, maxlength: 4000 },
    poster: { type: String, required: true },
    backdrop: { type: String, default: '' },
    genres: { type: [String], index: true, required: true },
    languages: { type: [String], index: true, required: true },
    duration: { type: Number, required: true, min: 1, max: 600 },
    rating: { type: Number, min: 0, max: 10, default: 0 },
    certificate: { type: String, enum: ['U', 'UA', 'A'], default: 'UA' },
    releaseDate: { type: Date, required: true },
    director: { type: String, default: '', maxlength: 150 },
    cast: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['now_showing', 'upcoming', 'archived'],
      default: 'now_showing',
      index: true,
    },
    featured: { type: Boolean, default: false },
    formats: { type: [String], default: ['2D'] },
  },
  { timestamps: true },
);
schema.index({ title: 'text', description: 'text', director: 'text' });
schema.index({ status: 1, releaseDate: -1 });
export const Movie = mongoose.model('Movie', schema);
