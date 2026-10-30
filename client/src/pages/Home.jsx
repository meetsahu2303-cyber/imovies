import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Play,
  Star,
  Ticket,
  Sparkles,
  MapPin,
  ShieldCheck,
  Zap,
  Search,
} from 'lucide-react';
import { useApi } from '../lib/hooks';
import { dateLabel, runtime } from '../lib/api';
import { MovieCard, MovieSkeletons, ErrorState } from '../components/UI';
const slides = [
  {
    slug: 'interstellar',
    image: '/posters/interstellar-space.jpg',
    eyebrow: 'BACK ON THE BIG SCREEN',
    title: (
      <>
        Some stories
        <br />
        are bigger than
        <br />
        <em>our world.</em>
      </>
    ),
    name: 'Interstellar',
    description:
      'Beyond the stars. Beyond time. Experience Christopher Nolan’s masterpiece the way it was meant to be seen.',
    position: 'center 48%',
  },
  {
    slug: 'inception',
    image: '/posters/inception-city.jpg',
    eyebrow: 'ONE MORE DREAM',
    title: (
      <>
        Your mind is
        <br />
        the scene of
        <br />
        <em>the crime.</em>
      </>
    ),
    name: 'Inception',
    description:
      'A world within a world. Lose yourself in a cinematic puzzle that stays with you long after the credits.',
    position: 'center 50%',
  },
  {
    slug: 'dune-part-two',
    image: '/posters/dune.jpg',
    eyebrow: 'THE CINEMATIC EVENT',
    title: (
      <>
        Destiny is
        <br />
        written in
        <br />
        <em>the sand.</em>
      </>
    ),
    name: 'Dune: Part Two',
    description:
      'Return to Arrakis. An unforgettable journey of power, prophecy, and possibility — on the biggest screen.',
    position: 'right 30%',
  },
];
export default function Home() {
  const [slide, setSlide] = useState(0);
  const [tab, setTab] = useState('now_showing');
  const [genre, setGenre] = useState('');
  const city = useSelector((s) => s.ui.city);
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi(
    `/movies?status=${tab}&limit=8${genre ? `&genre=${encodeURIComponent(genre)}` : ''}`,
  );
  const { data: meta } = useApi('/metadata');
  const current = slides[slide];
  return (
    <>
      <section className={`hero hero-slide-${slide}`} aria-label="Featured movies">
        <img
          key={current.image}
          className="hero-image"
          src={current.image}
          alt=""
          style={{ objectPosition: current.position }}
        />
        <div className="hero-shade" />
        <div className="container hero-inner">
          <div className="hero-copy" key={slide}>
            <div className="hero-eyebrow">
              <span />
              {current.eyebrow}
            </div>
            <h1>{current.title}</h1>
            <p>{current.description}</p>
            <div className="hero-movie-meta">
              <strong>{current.name}</strong>
              <span className="meta-dot" />
              <span>
                <Star size={14} fill="currentColor" />
                {slide === 0 ? '9.4' : slide === 1 ? '9.0' : '8.8'}
              </span>
              <span className="meta-dot" />
              <span>IMAX</span>
              <span className="meta-dot" />
              <span>English</span>
            </div>
            <div className="hero-buttons">
              <Link to={`/movies/${current.slug}`} className="btn btn-primary btn-lg">
                <Ticket size={18} />
                Book tickets
                <ArrowUpRight size={18} />
              </Link>
              <Link to={`/movies/${current.slug}`} className="hero-detail-link">
                Explore the film
                <ArrowRight size={17} />
              </Link>
            </div>
          </div>
          <div className="hero-bottom">
            <div className="hero-caption">
              <span className="caption-line" />
              THE MAGIC IS IN THE EXPERIENCE
            </div>
            <div className="hero-controls">
              <span className="slide-count">
                0{slide + 1}
                <small> / 03</small>
              </span>
              <button
                aria-label="Previous featured movie"
                onClick={() => setSlide((slide + 2) % 3)}
              >
                <ChevronLeft size={18} />
              </button>
              <button aria-label="Next featured movie" onClick={() => setSlide((slide + 1) % 3)}>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>
      <div className="experience-bar">
        <div className="container">
          <span>
            <Zap size={17} />
            <strong>Less waiting. More watching.</strong>
            <span>Instant ticket confirmation</span>
          </span>
          <span>
            <Ticket size={17} />
            <strong>Your seat, your way</strong>
            <span>Pick the perfect spot</span>
          </span>
          <span>
            <ShieldCheck size={17} />
            <strong>Book with confidence</strong>
            <span>Secure checkout</span>
          </span>
        </div>
      </div>
      <section className="container discover-section" id="discover">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              <span className="red-line" />
              THE BIG SCREEN IS CALLING
            </div>
            <h2>
              Make a night of it<span className="red-text">.</span>
            </h2>
            <p>Find a film. Pick your people. We’ll save you a seat.</p>
          </div>
          <Link to="/movies" className="section-link">
            View all movies
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="discovery-toolbar">
          <div className="pill-tabs" role="tablist" aria-label="Movie release status">
            <button
              role="tab"
              aria-selected={tab === 'now_showing'}
              className={tab === 'now_showing' ? 'active' : ''}
              onClick={() => setTab('now_showing')}
            >
              <span className="live-dot" />
              Now showing
            </button>
            <button
              role="tab"
              aria-selected={tab === 'upcoming'}
              className={tab === 'upcoming' ? 'active' : ''}
              onClick={() => setTab('upcoming')}
            >
              Coming soon
              <Sparkles size={14} />
            </button>
          </div>
          <div className="genre-chips" aria-label="Filter by genre">
            <button className={!genre ? 'active' : ''} onClick={() => setGenre('')}>
              All genres
            </button>
            {(meta?.genres || [])
              .filter((g) => ['Action', 'Sci-Fi', 'Drama', 'Comedy', 'Animation'].includes(g))
              .map((g) => (
                <button className={genre === g ? 'active' : ''} key={g} onClick={() => setGenre(g)}>
                  {g}
                </button>
              ))}
          </div>
        </div>
        <div className="movie-grid">
          {loading ? (
            <MovieSkeletons count={4} />
          ) : error ? (
            <div className="grid-full">
              <ErrorState message={error} retry={reload} />
            </div>
          ) : (
            data?.items?.map((m, i) => <MovieCard key={m._id} movie={m} index={i} />)
          )}
        </div>
        {!loading && !data?.items?.length && (
          <div className="empty-state">
            <h3>No films in this selection</h3>
            <p>Try another genre, or see what’s coming soon.</p>
            <button
              className="btn btn-outline"
              onClick={() => {
                setGenre('');
                setTab('now_showing');
              }}
            >
              Show all movies
            </button>
          </div>
        )}
      </section>
      <section className="container experience-section">
        <div className="experience-card">
          <div className="experience-copy">
            <div className="eyebrow">DON’T JUST WATCH. FEEL IT.</div>
            <h2>
              Every seat.
              <br />A front-row feeling.
            </h2>
            <p>
              The hush before the opening scene. The sound that surrounds you. Some things are
              better away from the everyday.
            </p>
            <Link to="/theatres" className="btn btn-light">
              Find your cinema
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="cinema-art" aria-hidden="true">
            <div className="cinema-art-glow" />
            <div className="art-screen">
              <ClapperIcon />
              <span>
                THE BIG SCREEN.
                <br />
                <strong>THE BIG FEELINGS.</strong>
              </span>
            </div>
            <div className="art-seats">
              {Array.from({ length: 4 }, (_, row) => (
                <div key={row} style={{ '--row': row }}>
                  {Array.from({ length: 9 }, (_, col) => (
                    <i key={col} className={row === 2 && col === 4 ? 'best-seat' : ''} />
                  ))}
                </div>
              ))}
            </div>
            <span className="art-caption">
              <span />
              THE BEST SEAT IS THE ONE YOU CHOOSE
            </span>
          </div>
        </div>
      </section>
      <section className="container quick-search-section">
        <div>
          <div className="eyebrow">YOUR NEXT PLAN, SORTED</div>
          <h2>What are you in the mood for?</h2>
        </div>
        <div className="mood-links">
          {['Something thrilling', 'A little laughter', 'An epic adventure'].map((m, i) => (
            <button
              key={m}
              onClick={() => navigate(`/movies?genre=${['Thriller', 'Comedy', 'Adventure'][i]}`)}
            >
              {m}
              <ArrowUpRight size={18} />
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
function ClapperIcon() {
  return <Play size={27} strokeWidth={1.2} />;
}
