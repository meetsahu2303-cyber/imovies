import { z } from 'zod';
import { Movie } from '../models/Movie.js';
import { Theatre } from '../models/Theatre.js';
import { Show } from '../models/Show.js';
import { dayRange } from '../utils/money.js';
import { assert } from '../utils/errors.js';
import { pagination } from '../utils/validation.js';
export const movieQuery = pagination.extend({
  q: z.string().trim().max(100).optional(),
  genre: z.string().max(50).optional(),
  language: z.string().max(50).optional(),
  city: z.string().max(60).optional(),
  theatre: z.string().max(60).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  status: z.enum(['now_showing', 'upcoming', 'all']).default('now_showing'),
  sort: z.enum(['popular', 'release', 'title']).default('popular'),
});
export async function listMovies(query) {
  const {
    page,
    limit,
    q,
    genre,
    language,
    city,
    theatre: theatreId,
    date,
    status,
    sort,
  } = movieQuery.parse(query);
  const filter = {};
  if (status !== 'all') filter.status = status;
  if (q) filter.$text = { $search: q };
  if (genre) filter.genres = genre;
  if (language) filter.languages = language;
  if (city || theatreId || date) {
    const theatreFilter = { active: true };
    if (city) theatreFilter.city = city;
    if (theatreId) theatreFilter._id = theatreId;
    const theatres = await Theatre.find(theatreFilter).select('_id').lean();
    const showFilter = {
      theatre: { $in: theatres.map((t) => t._id) },
      status: 'scheduled',
      startsAt: { $gt: new Date() },
    };
    if (date) {
      const range = dayRange(date);
      assert(range, 400, 'Invalid date.');
      showFilter.startsAt = { $gte: range.start, $lt: range.end };
    }
    filter._id = { $in: await Show.distinct('movie', showFilter) };
  }
  const sortBy =
    sort === 'title'
      ? { title: 1 }
      : sort === 'release'
        ? { releaseDate: -1, _id: 1 }
        : { featured: -1, rating: -1, _id: 1 };
  const [items, total] = await Promise.all([
    Movie.find(filter)
      .sort(sortBy)
      .skip((page - 1) * limit)
      .limit(limit)
      .maxTimeMS(8000)
      .lean(),
    Movie.countDocuments(filter),
  ]);
  return {
    items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}
