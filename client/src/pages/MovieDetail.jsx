import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Star,
  MapPin,
  ChevronRight,
  Film,
  Languages,
  Ticket,
} from 'lucide-react';
import { useApi } from '../lib/hooks';
import { dateLabel, timeLabel, runtime, money, upcomingDates, todayIST } from '../lib/api';
import { BackLink, Spinner, ErrorState, EmptyState } from '../components/UI';
export default function MovieDetail() {
  const { id } = useParams();
  const city = useSelector((s) => s.ui.city);
  const [params] = useSearchParams();
  const [date, setDate] = useState(params.get('date') || todayIST());
  const [language, setLanguage] = useState('');
  const { data, loading, error, reload } = useApi(`/movies/${id}`);
  const movie = data?.movie;
  const {
    data: showData,
    loading: showsLoading,
    error: showsError,
    reload: reloadShows,
  } = useApi(`/shows?movie=${movie?._id}&city=${encodeURIComponent(city)}&date=${date}`, !movie);
  useEffect(() => {
    setLanguage('');
  }, [movie?._id]);
  if (loading) return <Spinner />;
  if (error)
    return (
      <div className="container page-space">
        <ErrorState message={error} retry={reload} />
      </div>
    );
  if (!movie) return null;
  const grouped = (showData?.items || [])
    .filter((s) => !language || s.language === language)
    .reduce((all, s) => {
      const key = s.theatre._id;
      (all[key] ||= { theatre: s.theatre, shows: [] }).shows.push(s);
      return all;
    }, {});
  return (
    <>
      <section className="movie-detail-hero">
        <div
          className="detail-backdrop"
          style={{ backgroundImage: `url(${movie.backdrop || movie.poster})` }}
        />
        <div className="container detail-hero-inner">
          <img className="detail-poster" src={movie.poster} alt={`${movie.title} poster`} />
          <div className="detail-copy">
            <BackLink to="/movies">All movies</BackLink>
            <div className="eyebrow">
              {movie.status === 'upcoming'
                ? 'COMING TO THE BIG SCREEN'
                : 'YOUR BIG-SCREEN EXPERIENCE'}
            </div>
            <h1>{movie.title}</h1>
            <div className="detail-metadata">
              <span className="rating-pill">
                <Star size={15} fill="currentColor" />
                {movie.rating.toFixed(1)}
                <small>/10</small>
              </span>
              <span>{movie.certificate}</span>
              <span>
                <Clock3 size={15} />
                {runtime(movie.duration)}
              </span>
              <span>
                <Languages size={15} />
                {movie.languages.join(', ')}
              </span>
            </div>
            <div className="detail-genres">
              {movie.genres.map((g) => (
                <Link to={`/movies?genre=${g}`} key={g}>
                  {g}
                </Link>
              ))}
            </div>
            <p>{movie.description}</p>
            <div className="detail-director">
              <span>Directed by</span>
              <strong>{movie.director}</strong>
            </div>
          </div>
        </div>
      </section>
      <div className="container detail-content">
        <section id="showtimes" className="showtimes-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">LET’S MAKE PLANS</div>
              <h2>Find your perfect show</h2>
              <p>
                <MapPin size={14} />
                {city} · All times are Indian Standard Time
              </p>
            </div>
            {movie.languages.length > 1 && (
              <select
                className="form-select language-select"
                aria-label="Show language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="">All languages</option>
                {movie.languages.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            )}
          </div>
          <div className="date-strip">
            {upcomingDates().map((d, i) => {
              const value = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Kolkata',
              }).format(d);
              return (
                <button
                  key={value}
                  className={value === date ? 'active' : ''}
                  onClick={() => setDate(value)}
                >
                  <span>
                    {i === 0
                      ? 'Today'
                      : i === 1
                        ? 'Tomorrow'
                        : dateLabel(d, {
                            weekday: 'short',
                            day: undefined,
                            month: undefined,
                          })}
                  </span>
                  <strong>{dateLabel(d, { month: undefined })}</strong>
                  <small>{dateLabel(d, { month: 'short', day: undefined })}</small>
                </button>
              );
            })}
          </div>
          {showsLoading ? (
            <Spinner label="Finding the best shows…" />
          ) : showsError ? (
            <ErrorState message={showsError} retry={reloadShows} />
          ) : !Object.keys(grouped).length ? (
            <EmptyState
              title={
                movie.status === 'upcoming'
                  ? 'The wait is almost worth it'
                  : 'No shows for this selection'
              }
              message={
                movie.status === 'upcoming'
                  ? 'This film is coming soon. Check another date or explore films showing now.'
                  : `Try another date or change your city. There’s always another great story.`
              }
            >
              <Link to="/movies" className="btn btn-outline">
                Explore other movies
              </Link>
            </EmptyState>
          ) : (
            <div className="theatre-show-list">
              {Object.values(grouped).map(({ theatre, shows }) => (
                <article className="theatre-show-card" key={theatre._id}>
                  <div className="theatre-show-name">
                    <span className="theatre-icon">
                      <Film size={22} />
                    </span>
                    <div>
                      <h3>{theatre.name}</h3>
                      <p>{theatre.address}</p>
                      <div className="amenities">
                        {theatre.amenities.slice(0, 3).map((a) => (
                          <span key={a}>{a}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="showtime-buttons">
                    {shows.map((show) => (
                      <Link to={`/shows/${show._id}`} className="showtime-button" key={show._id}>
                        <strong>{timeLabel(show.startsAt)}</strong>
                        <span>
                          {show.format} · {show.language}
                        </span>
                        <small>From {money(show.basePrice)}</small>
                      </Link>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="cast-section">
          <div className="eyebrow">THE PEOPLE BEHIND THE STORY</div>
          <h2>Meet the cast</h2>
          <div className="cast-list">
            {movie.cast.map((name, i) => (
              <div className="cast-person" key={name}>
                <span
                  style={{
                    '--cast-color': ['#e6ded9', '#dee5e2', '#e5e0ec'][i % 3],
                  }}
                >
                  {name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <strong>{name}</strong>
                <small>Actor</small>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
