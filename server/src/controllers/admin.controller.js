import mongoose from 'mongoose';
import { z } from 'zod';
import { Movie } from '../models/Movie.js';
import { Theatre, Seat } from '../models/Theatre.js';
import { Show } from '../models/Show.js';
import { Booking, Payment } from '../models/Booking.js';
import { User } from '../models/User.js';
import { AppError, assert } from '../utils/errors.js';
import { objectId, pagination, screenSchema, seatLayout } from '../utils/validation.js';
import { emitSeats } from '../realtime/events.js';
import { cancelBooking, processRefund } from '../services/booking.service.js';
const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const safeImage = z
  .string()
  .max(2000)
  .refine(
    (v) => /^https:\/\//.test(v) || /^\/(posters|uploads)\/[a-zA-Z0-9._\/-]+$/.test(v),
    'Use an HTTPS image URL or an uploaded image.',
  );
export const movieSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().min(10).max(4000),
  poster: safeImage,
  backdrop: z.union([safeImage, z.literal('')]).default(''),
  genres: z.array(z.string().trim().min(1).max(40)).min(1).max(10),
  languages: z.array(z.string().trim().min(1).max(40)).min(1).max(10),
  duration: z.coerce.number().int().min(1).max(600),
  rating: z.coerce.number().min(0).max(10),
  certificate: z.enum(['U', 'UA', 'A']).default('UA'),
  releaseDate: z.string().datetime({ offset: true }),
  director: z.string().trim().max(150).default(''),
  cast: z.array(z.string().trim().max(100)).max(30).default([]),
  status: z.enum(['now_showing', 'upcoming', 'archived']).default('now_showing'),
  featured: z.boolean().default(false),
  formats: z
    .array(z.enum(['2D', 'IMAX', '4DX']))
    .min(1)
    .default(['2D']),
});
export const theatreSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    city: z.string().trim().min(2).max(60),
    address: z.string().trim().min(5).max(300),
    amenities: z.array(z.string().trim().max(60)).max(15).default([]),
    longitude: z.coerce.number().min(-180).max(180).default(72.8777),
    latitude: z.coerce.number().min(-90).max(90).default(19.076),
    screens: z
      .array(screenSchema.extend({ id: objectId.optional() }))
      .min(1)
      .max(8),
    active: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    value.screens.forEach((screen, i) => {
      if (screen.aisleAfter >= screen.columns || screen.premiumFrom > screen.rows)
        ctx.addIssue({
          code: 'custom',
          path: ['screens', i],
          message: 'Aisle must be inside the screen; premium row must be within the layout.',
        });
    });
    if (new Set(value.screens.map((s) => s.name.toLowerCase())).size !== value.screens.length)
      ctx.addIssue({
        code: 'custom',
        path: ['screens'],
        message: 'Screen names must be unique.',
      });
  });
export const showSchema = z.object({
  movie: objectId,
  theatre: objectId,
  screen: objectId,
  startsAt: z.string().datetime({ offset: true }),
  basePrice: z.coerce.number().int().min(100).max(1000000),
  premiumPrice: z.coerce.number().int().min(100).max(1000000),
  format: z.enum(['2D', 'IMAX', '4DX']),
  language: z.string().trim().min(1).max(40),
});
const replaceMovie = async (req, res) => {
  const data = movieSchema.partial().parse(req.body);
  if (data.title && !req.body.slug) data.slug = `${slugify(data.title)}-${Date.now().toString(36)}`;
  const item = req.params.id
    ? await Movie.findByIdAndUpdate(req.params.id, data, {
        new: true,
        runValidators: true,
      })
    : await Movie.create({
        ...data,
        slug: `${slugify(data.title)}-${Date.now().toString(36)}`,
      });
  assert(item, 404, 'Movie not found.');
  res.status(req.params.id ? 200 : 201).json({ movie: item });
};
export const saveMovie = replaceMovie;
export async function deleteMovie(req, res) {
  const hasBookings = await Show.exists({
    movie: req.params.id,
    status: 'scheduled',
    startsAt: { $gt: new Date() },
    'seats.status': { $in: ['held', 'booked'] },
  });
  assert(!hasBookings, 409, 'This movie has active shows or bookings. Archive it instead.');
  const movie = await Movie.findByIdAndUpdate(req.params.id, { status: 'archived' }, { new: true });
  assert(movie, 404, 'Movie not found.');
  await Show.updateMany(
    { movie: movie._id, status: 'scheduled', 'seats.status': 'available' },
    { status: 'cancelled' },
  );
  res.json({ ok: true });
}
function theatreData(body) {
  const { longitude, latitude, screens, ...data } = body;
  return {
    ...data,
    slug: `${slugify(body.name)}-${slugify(body.city)}`,
    location: { type: 'Point', coordinates: [longitude, latitude] },
    screens: screens.map((s) => ({
      ...(s.id ? { _id: s.id } : {}),
      name: s.name,
      rows: s.rows,
      columns: s.columns,
      aisleAfter: s.aisleAfter,
      premiumFrom: s.premiumFrom,
    })),
  };
}
async function syncSeats(theatre, session) {
  for (const screen of theatre.screens) {
    await Seat.bulkWrite(
      seatLayout(screen).map((s) => ({
        updateOne: {
          filter: {
            theatre: theatre._id,
            screen: screen._id,
            seatId: s.seatId,
          },
          update: { $set: { ...s, active: true } },
          upsert: true,
        },
      })),
      { session },
    );
  }
}
export async function listTheatres(req, res) {
  res.json({
    items: await Theatre.find().sort({ city: 1, name: 1 }).limit(100).lean(),
  });
}
export async function saveTheatre(req, res) {
  const data = theatreData(theatreSchema.parse(req.body));
  const session = await mongoose.startSession();
  let theatre;
  try {
    await session.withTransaction(async () => {
      if (req.params.id) {
        const old = await Theatre.findById(req.params.id).session(session);
        assert(old, 404, 'Theatre not found.');
        for (const screen of old.screens) {
          const next = data.screens.find((s) => String(s._id) === String(screen._id));
          const changed =
            !next ||
            ['rows', 'columns', 'premiumFrom', 'aisleAfter'].some(
              (key) => next[key] !== screen[key],
            );
          if (changed) {
            const used = await Show.exists({
              theatre: old._id,
              screen: screen._id,
              startsAt: { $gt: new Date() },
              status: 'scheduled',
            }).session(session);
            assert(
              !used,
              409,
              `Cannot remove or resize ${screen.name} while it has scheduled shows.`,
            );
          }
        }
        theatre = await Theatre.findByIdAndUpdate(req.params.id, data, {
          new: true,
          runValidators: true,
          session,
        });
      } else theatre = (await Theatre.create([data], { session }))[0];
      await syncSeats(theatre, session);
    });
  } finally {
    await session.endSession();
  }
  res.status(req.params.id ? 200 : 201).json({ theatre });
}
export async function deleteTheatre(req, res) {
  const used = await Show.exists({
    theatre: req.params.id,
    status: 'scheduled',
    startsAt: { $gt: new Date() },
  });
  assert(!used, 409, 'Cancel future shows before deactivating this theatre.');
  const item = await Theatre.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
  assert(item, 404, 'Theatre not found.');
  res.json({ ok: true });
}
async function validateShow(data, excludeId, session) {
  const [movie, theatre] = await Promise.all([
    Movie.findById(data.movie),
    Theatre.findById(data.theatre),
  ]);
  assert(movie && movie.status !== 'archived', 400, 'Choose an active movie.');
  assert(theatre?.active, 400, 'Choose an active theatre.');
  const screen = theatre.screens.id(data.screen);
  assert(screen?.active, 400, 'Screen not found.');
  assert(
    movie.languages.includes(data.language) && movie.formats.includes(data.format),
    400,
    'Language and format must be offered by this movie.',
  );
  const startsAt = new Date(data.startsAt),
    endsAt = new Date(+startsAt + (movie.duration + 20) * 60000);
  assert(+startsAt > Date.now(), 400, 'Shows must start in the future.');
  const overlap = await Show.findOne({
    _id: { $ne: excludeId || new mongoose.Types.ObjectId() },
    theatre: data.theatre,
    screen: data.screen,
    status: 'scheduled',
    startsAt: { $lt: endsAt },
    endsAt: { $gt: startsAt },
  }).session(session);
  assert(!overlap, 409, 'This screen is already scheduled. Include a 20-minute cleaning break.');
  return { movie, theatre, screen, startsAt, endsAt };
}
export async function saveShow(req, res) {
  const data = showSchema.parse(req.body);
  // Serialize schedule edits for one physical screen, including the initial insert.
  const session = await mongoose.startSession();
  let show;
  try {
    await session.withTransaction(async () => {
      const lockTheatre = await Theatre.findByIdAndUpdate(
        data.theatre,
        { $inc: { scheduleVersion: 1 } },
        { new: true, session },
      );
      assert(lockTheatre, 404, 'Theatre not found.');
      const { movie, screen, startsAt, endsAt } = await validateShow(data, req.params.id, session);
      const fields = { ...data, startsAt, endsAt, screenName: screen.name };
      if (req.params.id) {
        const old = await Show.findById(req.params.id).session(session);
        assert(old, 404, 'Show not found.');
        const hasBookings = await Booking.exists({
          show: old._id,
          status: { $in: ['confirmed', 'pending'] },
        }).session(session);
        assert(
          !hasBookings,
          409,
          'Shows with active bookings cannot be edited. Cancel it after refunding bookings.',
        );
        assert(
          old.seats.every((s) => s.status === 'available'),
          409,
          'Release active holds before editing.',
        );
        show = await Show.findByIdAndUpdate(
          req.params.id,
          {
            ...fields,
            seats: seatLayout(screen).map((s) => ({
              ...s,
              status: 'available',
            })),
          },
          { new: true, runValidators: true, session },
        );
      } else
        show = (
          await Show.create(
            [
              {
                ...fields,
                seats: seatLayout(screen).map((s) => ({
                  ...s,
                  status: 'available',
                })),
              },
            ],
            { session },
          )
        )[0];
    });
  } finally {
    await session.endSession();
  }
  emitSeats(show._id);
  res.status(req.params.id ? 200 : 201).json({ show });
}
export async function listShows(req, res) {
  const { page, limit } = pagination.parse(req.query);
  const filter = {};
  const [items, total] = await Promise.all([
    Show.find(filter)
      .select('-seats')
      .populate('movie', 'title')
      .populate('theatre', 'name city')
      .sort({ startsAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Show.countDocuments(filter),
  ]);
  res.json({
    items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
export async function deleteShow(req, res) {
  const session = await mongoose.startSession();
  let show;
  try {
    await session.withTransaction(async () => {
      const candidate = await Show.findById(req.params.id).session(session);
      assert(candidate, 404, 'Show not found.');
      await Theatre.findByIdAndUpdate(
        candidate.theatre,
        { $inc: { scheduleVersion: 1 } },
        { session },
      );
      show = await Show.findById(req.params.id).session(session);
      const booked = await Booking.exists({
        show: show._id,
        status: { $in: ['confirmed', 'pending'] },
      }).session(session);
      assert(!booked, 409, 'Cancel and refund active bookings first.');
      show.status = 'cancelled';
      await show.save({ session });
    });
  } finally {
    await session.endSession();
  }
  emitSeats(show._id);
  res.json({ ok: true });
}
export async function listBookings(req, res) {
  const { page, limit, status } = pagination
    .extend({
      status: z.enum(['pending', 'confirmed', 'cancelled', 'expired']).optional(),
    })
    .parse(req.query);
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    Booking.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Booking.countDocuments(filter),
  ]);
  res.json({
    items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
export async function adminCancel(req, res) {
  res.json({
    booking: await cancelBooking(req.params.id, req.user, { admin: true }),
  });
}
export async function retryRefund(req, res) {
  const booking = await Booking.findById(req.params.id);
  assert(booking, 404, 'Booking not found.');
  assert(
    ['refund_failed', 'refund_pending'].includes(booking.paymentStatus),
    409,
    'This booking has no refund to retry.',
  );
  await Booking.updateOne({ _id: booking._id }, { paymentStatus: 'refund_pending' });
  await processRefund(booking._id);
  res.json({ booking: await Booking.findById(booking._id) });
}
export async function dashboard(req, res) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [
    movieCount,
    theatreCount,
    userCount,
    upcomingShows,
    recentBookings,
    revenue,
    statusCounts,
  ] = await Promise.all([
    Movie.countDocuments({ status: { $ne: 'archived' } }),
    Theatre.countDocuments({ active: true }),
    User.countDocuments({ active: true }),
    Show.countDocuments({ status: 'scheduled', startsAt: { $gt: new Date() } }),
    Booking.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(6).lean(),
    Booking.aggregate([
      {
        $match: {
          paymentStatus: { $in: ['paid', 'refund_pending', 'refund_failed'] },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount.total' },
          count: { $sum: { $size: '$seats' } },
        },
      },
    ]),
    Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  res.json({
    movieCount,
    theatreCount,
    userCount,
    upcomingShows,
    revenue: revenue[0]?.total || 0,
    tickets: revenue[0]?.count || 0,
    recentBookings,
    statusCounts,
  });
}
