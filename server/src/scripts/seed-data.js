import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Movie } from '../models/Movie.js';
import { Theatre, Seat } from '../models/Theatre.js';
import { Show } from '../models/Show.js';
import { Booking, Payment } from '../models/Booking.js';
import { Notification } from '../models/Notification.js';
import { seatLayout } from '../utils/validation.js';
import { quoteSeats, dayRange } from '../utils/money.js';
import { logger } from '../utils/logger.js';
const movies = [
  {
    title: 'Interstellar',
    slug: 'interstellar',
    genres: ['Sci-Fi', 'Adventure', 'Drama'],
    languages: ['English', 'Hindi'],
    duration: 169,
    rating: 9.4,
    certificate: 'UA',
    director: 'Christopher Nolan',
    cast: ['Matthew McConaughey', 'Anne Hathaway', 'Jessica Chastain'],
    featured: true,
    formats: ['2D', 'IMAX'],
    description:
      'A team of explorers travels beyond this galaxy to discover whether mankind has a future among the stars. Christopher Nolan’s breathtaking odyssey explores the enduring bonds of love, the courage of discovery, and the extraordinary places time can take us.',
    poster: '/posters/interstellar.jpg',
    backdrop: '/posters/interstellar-space.jpg',
  },
  {
    title: 'Dune: Part Two',
    slug: 'dune-part-two',
    genres: ['Sci-Fi', 'Adventure', 'Action'],
    languages: ['English', 'Hindi'],
    duration: 166,
    rating: 8.8,
    certificate: 'UA',
    director: 'Denis Villeneuve',
    cast: ['Timothée Chalamet', 'Zendaya', 'Rebecca Ferguson'],
    featured: true,
    formats: ['2D', 'IMAX'],
    description:
      'Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family. Facing a choice between the love of his life and the fate of the universe, he must prevent a terrible future only he can foresee.',
    poster: '/posters/dune.jpg',
    backdrop: '',
  },
  {
    title: 'Inception',
    slug: 'inception',
    genres: ['Sci-Fi', 'Thriller', 'Action'],
    languages: ['English', 'Hindi'],
    duration: 148,
    rating: 9.0,
    certificate: 'UA',
    director: 'Christopher Nolan',
    cast: ['Leonardo DiCaprio', 'Joseph Gordon-Levitt', 'Elliot Page'],
    formats: ['2D', 'IMAX'],
    description:
      'A skilled thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O. A mind-bending journey through layers of dreams, memory, and the architecture of the impossible.',
    poster: '/posters/inception.jpg',
    backdrop: '/posters/inception-city.jpg',
  },
  {
    title: 'Oppenheimer',
    slug: 'oppenheimer',
    genres: ['Drama', 'History', 'Thriller'],
    languages: ['English', 'Hindi'],
    duration: 180,
    rating: 8.9,
    certificate: 'A',
    director: 'Christopher Nolan',
    cast: ['Cillian Murphy', 'Emily Blunt', 'Robert Downey Jr.'],
    formats: ['2D', 'IMAX'],
    description:
      'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb. An epic portrait of a brilliant, complicated man and the world-changing consequences of a single discovery.',
    poster: '/posters/oppenheimer.jpg',
  },
  {
    title: 'Spider-Man: Across the Spider-Verse',
    slug: 'across-the-spider-verse',
    genres: ['Animation', 'Action', 'Adventure'],
    languages: ['English', 'Hindi'],
    duration: 140,
    rating: 8.7,
    certificate: 'U',
    director: 'Joaquim Dos Santos',
    cast: ['Shameik Moore', 'Hailee Steinfeld', 'Oscar Isaac'],
    formats: ['2D', '4DX'],
    description:
      'Miles Morales catapults across the multiverse, where he encounters a team of Spider-People charged with protecting its very existence. When the heroes clash on how to handle a new threat, Miles must redefine what it means to be a hero.',
    poster: '/posters/spiderverse.jpg',
  },
  {
    title: 'The Batman',
    slug: 'the-batman',
    genres: ['Action', 'Crime', 'Drama'],
    languages: ['English', 'Hindi'],
    duration: 176,
    rating: 8.2,
    certificate: 'UA',
    director: 'Matt Reeves',
    cast: ['Robert Pattinson', 'Zoë Kravitz', 'Paul Dano'],
    formats: ['2D', 'IMAX'],
    description:
      'When a sadistic serial killer begins murdering key political figures in Gotham, Batman is forced to investigate the city’s hidden corruption and question his family’s involvement. A dark, atmospheric detective story in the heart of a rain-soaked city.',
    poster: '/posters/batman.jpg',
  },
  {
    title: 'Everything Everywhere All at Once',
    slug: 'everything-everywhere',
    genres: ['Sci-Fi', 'Comedy', 'Adventure'],
    languages: ['English'],
    duration: 139,
    rating: 8.5,
    certificate: 'A',
    director: 'Daniel Kwan & Daniel Scheinert',
    cast: ['Michelle Yeoh', 'Ke Huy Quan', 'Stephanie Hsu'],
    formats: ['2D'],
    description:
      'An exhausted Chinese American woman is swept up in an insane adventure, in which she alone can save existence by exploring other universes and connecting with the lives she could have led.',
    poster: '/posters/everything.jpg',
    status: 'upcoming',
  },
  {
    title: 'The Grand Budapest Hotel',
    slug: 'grand-budapest-hotel',
    genres: ['Comedy', 'Adventure', 'Drama'],
    languages: ['English'],
    duration: 100,
    rating: 8.6,
    certificate: 'UA',
    director: 'Wes Anderson',
    cast: ['Ralph Fiennes', 'Tony Revolori', 'Saoirse Ronan'],
    formats: ['2D'],
    description:
      'A legendary concierge and his trusted lobby boy become unlikely friends amid the theft of a priceless painting and the battle for an enormous family fortune. A whimsical adventure, beautifully told.',
    poster: '/posters/budapest.jpg',
    status: 'upcoming',
  },
];
const theatres = [
  {
    name: 'IMovies Phoenix Palladium',
    slug: 'phoenix-palladium-mumbai',
    city: 'Mumbai',
    address: '462 Senapati Bapat Marg, Lower Parel, Mumbai',
    coordinates: [72.8258, 18.9944],
    screens: ['IMAX Signature', 'Screen 2', 'Screen 3'],
  },
  {
    name: 'IMovies Andheri',
    slug: 'imovies-andheri-mumbai',
    city: 'Mumbai',
    address: 'Infinity Mall, New Link Road, Andheri West, Mumbai',
    coordinates: [72.8327, 19.1413],
    screens: ['Dolby Cinema', 'Screen 2'],
  },
  {
    name: 'IMovies Select Citywalk',
    slug: 'select-citywalk-delhi',
    city: 'New Delhi',
    address: 'District Centre, Saket, New Delhi',
    coordinates: [77.2195, 28.5285],
    screens: ['IMAX Signature', 'Screen 2'],
  },
  {
    name: 'IMovies Phoenix Marketcity',
    slug: 'phoenix-marketcity-bengaluru',
    city: 'Bengaluru',
    address: 'Whitefield Main Road, Mahadevapura, Bengaluru',
    coordinates: [77.6965, 12.9962],
    screens: ['Screen 1', 'Screen 2'],
  },
];
export async function seedDatabase() {
  if (await User.exists({})) {
    logger.info(
      'Database already contains users; seed skipped. No passwords or bookings were reset.',
    );
    return;
  }
  if (process.env.NODE_ENV === 'production')
    throw new Error('Demo seed is forbidden in production.');
  const adminPass = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
  const userPass = process.env.SEED_USER_PASSWORD || 'Movie@12345';
  const [adminHash, userHash] = await Promise.all([
    bcrypt.hash(adminPass, 12),
    bcrypt.hash(userPass, 12),
  ]);
  const [admin, user] = await User.create([
    {
      name: 'Cinema Admin',
      email: process.env.SEED_ADMIN_EMAIL || 'admin@imovies.local',
      passwordHash: adminHash,
      role: 'admin',
    },
    {
      name: 'Alex Morgan',
      email: process.env.SEED_USER_EMAIL || 'alex@imovies.local',
      passwordHash: userHash,
      role: 'user',
    },
  ]);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
  }).format(new Date());
  const createdMovies = await Movie.create(
    movies.map((m, i) => ({
      ...m,
      releaseDate: new Date(
        Date.now() + (m.status === 'upcoming' ? (7 + i) * 86400000 : -(14 + i) * 86400000),
      ),
      status: m.status || 'now_showing',
    })),
  );
  const createdTheatres = [];
  for (const t of theatres) {
    const theatre = await Theatre.create({
      name: t.name,
      slug: t.slug,
      city: t.city,
      address: t.address,
      location: { type: 'Point', coordinates: t.coordinates },
      screens: t.screens.map((name, i) => ({
        name,
        rows: 8,
        columns: 12,
        aisleAfter: 6,
        premiumFrom: i === 0 ? 5 : 6,
      })),
    });
    for (const screen of theatre.screens)
      await Seat.insertMany(
        seatLayout(screen).map((s) => ({
          ...s,
          theatre: theatre._id,
          screen: screen._id,
        })),
      );
    createdTheatres.push(theatre);
  }
  const allShows = [];
  for (let day = 0; day < 6; day++) {
    const date = new Date(+dayRange(today).start + day * 86400000);
    const businessDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
    }).format(date);
    for (let ti = 0; ti < createdTheatres.length; ti++) {
      const theatre = createdTheatres[ti];
      for (let si = 0; si < theatre.screens.length; si++) {
        const screen = theatre.screens[si];
        for (let slot = 0; slot < 3; slot++) {
          const movie = createdMovies[(day + ti + si + slot) % 6];
          const hour = [10, 14, 19][slot] + (si % 2);
          const startsAt = new Date(
            +dayRange(businessDate).start + hour * 3600000 + (si * 15 + ti * 5) * 60000,
          );
          if (startsAt.getTime() < Date.now() + 30 * 60000) continue;
          const format =
            movie.formats.includes('IMAX') && screen.name.includes('IMAX') ? 'IMAX' : '2D';
          allShows.push({
            movie: movie._id,
            theatre: theatre._id,
            screen: screen._id,
            screenName: screen.name,
            startsAt,
            endsAt: new Date(+startsAt + (movie.duration + 20) * 60000),
            basePrice: 22000 + ti * 1000,
            premiumPrice: 35000 + ti * 1000,
            format,
            language: movie.languages[0],
            seats: seatLayout(screen).map((s) => ({
              ...s,
              status: 'available',
            })),
          });
        }
      }
    }
  }
  const shows = await Show.insertMany(allShows);
  // Two real, consistent demo tickets (never random booked seats without a booking).
  for (let i = 0; i < 2; i++) {
    const show = shows.find(
      (s) =>
        String(s.movie) === String(createdMovies[i]._id) &&
        s.startsAt.getTime() > Date.now() + 86400000,
    );
    if (!show) continue;
    const movie = createdMovies[i],
      theatre = createdTheatres.find((t) => String(t._id) === String(show.theatre));
    const chosen = show.seats.filter((s) => ['E6', 'E7'].includes(s.seatId));
    const booking = await Booking.create({
      reference: `IM-DEMO000${i + 1}`,
      user: user._id,
      show: show._id,
      movieTitle: movie.title,
      poster: movie.poster,
      theatreName: theatre.name,
      city: theatre.city,
      screenName: show.screenName,
      startsAt: show.startsAt,
      seats: chosen.map((s) => ({ seatId: s.seatId, tier: s.tier })),
      amount: quoteSeats(chosen, show),
      status: 'confirmed',
      paymentStatus: 'paid',
      holdId: `seed-${i}`,
      expiresAt: show.startsAt,
      confirmedAt: new Date(),
      idempotencyKey: `seed-booking-${i}`,
    });
    await Payment.create({
      booking: booking._id,
      user: user._id,
      provider: 'demo',
      providerRef: `demo_seed_${i}`,
      amount: booking.amount.total,
      status: 'succeeded',
    });
    await Show.updateOne(
      { _id: show._id },
      {
        $set: {
          'seats.$[s].status': 'booked',
          'seats.$[s].booking': booking._id,
        },
      },
      { arrayFilters: [{ 's.seatId': { $in: ['E6', 'E7'] } }] },
    );
    await Notification.create({
      user: user._id,
      title: 'Your tickets are confirmed!',
      message: `${movie.title} · E6, E7 · ${booking.reference}`,
      booking: booking._id,
    });
  }
  logger.info(
    {
      movies: createdMovies.length,
      theatres: createdTheatres.length,
      shows: shows.length,
    },
    'Demo cinema seeded',
  );
  return { admin, user };
}
