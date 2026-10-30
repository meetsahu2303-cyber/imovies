import { z } from 'zod';
import { Movie } from '../models/Movie.js';
import { Theatre, Seat } from '../models/Theatre.js';
import { Show, publicSeats } from '../models/Show.js';
import { listMovies } from '../services/catalog.service.js';
import { assert } from '../utils/errors.js';
import { objectId, pagination } from '../utils/validation.js';
import { dayRange } from '../utils/money.js';
export async function movies(req, res) {
  res.json(await listMovies(req.query));
}
export async function movie(req, res) {
  const filter = objectId.safeParse(req.params.id).success
    ? { _id: req.params.id }
    : { slug: req.params.id };
  const item = await Movie.findOne({
    ...filter,
    status: { $ne: 'archived' },
  }).lean();
  assert(item, 404, 'Movie not found.');
  res.json({ movie: item });
}
export async function theatres(req, res) {
  const { city } = z.object({ city: z.string().max(60).optional() }).parse(req.query);
  const items = await Theatre.find({ active: true, ...(city ? { city } : {}) })
    .sort({ city: 1, name: 1 })
    .limit(100)
    .lean();
  res.json({ items });
}
export async function shows(req, res) {
  const q = z
    .object({
      movie: objectId.optional(),
      theatre: objectId.optional(),
      city: z.string().max(60).optional(),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    })
    .parse(req.query);
  const filter = { status: 'scheduled', startsAt: { $gt: new Date() } };
  if (q.movie) filter.movie = q.movie;
  if (q.theatre) filter.theatre = q.theatre;
  if (q.city || q.theatre) {
    const ids = await Theatre.find({
      active: true,
      ...(q.city ? { city: q.city } : {}),
      ...(q.theatre ? { _id: q.theatre } : {}),
    }).distinct('_id');
    filter.theatre = { $in: ids };
  }
  if (q.date) {
    const range = dayRange(q.date);
    assert(range, 400, 'Invalid date.');
    filter.startsAt = { $gte: range.start, $lt: range.end };
  }
  const items = await Show.find(filter)
    .select('-seats')
    .populate('movie', 'title poster duration certificate languages genres rating')
    .populate('theatre', 'name city address amenities')
    .sort({ startsAt: 1 })
    .limit(250)
    .lean();
  res.json({ items });
}
export async function show(req, res) {
  const item = await Show.findById(req.params.id).populate('movie').populate('theatre').lean();
  assert(item, 404, 'Show not found.');
  const { seats, basePrice, premiumPrice } = publicSeats(item);
  delete item.seats;
  res.json({ show: { ...item, seats, basePrice, premiumPrice } });
}
export async function metadata(req, res) {
  const [genres, languages, cities] = await Promise.all([
    Movie.distinct('genres', { status: { $ne: 'archived' } }),
    Movie.distinct('languages', { status: { $ne: 'archived' } }),
    Theatre.distinct('city', { active: true }),
  ]);
  res.json({
    genres: genres.sort(),
    languages: languages.sort(),
    cities: cities.sort(),
    timezone: 'Asia/Kolkata',
  });
}
