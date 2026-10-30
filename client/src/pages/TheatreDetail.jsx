import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { MapPin, ArrowUpRight, Film } from 'lucide-react';
import { useApi } from '../lib/hooks';
import { Spinner, ErrorState, BackLink, PageHeading, MovieCard } from '../components/UI';
import { todayIST, timeLabel, money } from '../lib/api';
export default function TheatreDetail() {
  const { id } = useParams();
  const [date, setDate] = useState(todayIST());
  const { data: theatreData } = useApi('/theatres');
  const theatre = theatreData?.items.find((t) => t._id === id);
  const { data, loading, error, reload } = useApi(`/shows?theatre=${id}&date=${date}`);
  const movies = Array.from(
    new Map((data?.items || []).map((s) => [s.movie._id, s.movie])).values(),
  );
  return (
    <div className="container page-space">
      <BackLink to="/theatres">All cinemas</BackLink>
      <PageHeading
        eyebrow={theatre?.city || 'YOUR CINEMA'}
        title={theatre?.name || 'Your cinema'}
        description={theatre?.address}
      />
      <label className="field-label date-field">
        Choose a date
        <input
          type="date"
          className="form-control"
          min={todayIST()}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} retry={reload} />
      ) : (
        <div className="theatre-program">
          {movies.map((movie) => (
            <article key={movie._id} className="theatre-program-row">
              <Link to={`/movies/${movie._id}`}>
                <img src={movie.poster} alt={movie.title} />
                <div>
                  <h3>{movie.title}</h3>
                  <p>{movie.genres.join(' · ')}</p>
                </div>
              </Link>
              <div className="showtime-buttons">
                {data.items
                  .filter((s) => s.movie._id === movie._id)
                  .map((s) => (
                    <Link className="showtime-button" key={s._id} to={`/shows/${s._id}`}>
                      <strong>{timeLabel(s.startsAt)}</strong>
                      <span>
                        {s.screenName} · {s.format}
                      </span>
                      <small>From {money(s.basePrice)}</small>
                    </Link>
                  ))}
              </div>
            </article>
          ))}
        </div>
      )}
      {!loading && !movies.length && (
        <p className="muted mt-4">No shows scheduled for this date. Try another day.</p>
      )}
    </div>
  );
}
