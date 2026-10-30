import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { MapPin, ArrowUpRight, Film, Accessibility, Coffee, Volume2 } from 'lucide-react';
import { useApi } from '../lib/hooks';
import { PageHeading, Spinner, ErrorState, EmptyState } from '../components/UI';
export default function Theatres() {
  const city = useSelector((s) => s.ui.city);
  const { data, loading, error, reload } = useApi(`/theatres?city=${encodeURIComponent(city)}`);
  return (
    <div className="container page-space">
      <PageHeading
        eyebrow="YOUR CITY. YOUR CINEMA."
        title={`Find your happy place in ${city}.`}
        description="Thoughtful spaces. Immersive sound. The kind of cinema you’ll want to come back to."
      />
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} retry={reload} />
      ) : !data?.items.length ? (
        <EmptyState
          title="No cinemas in this city yet"
          message="Choose another city from the navigation bar."
        />
      ) : (
        <div className="cinema-grid">
          {data.items.map((t, i) => (
            <article className="cinema-card" key={t._id}>
              <div className={`cinema-card-art cinema-art-${i % 3}`}>
                <span className="cinema-art-label">IMOVIES CINEMAS</span>
                <Film size={62} strokeWidth={1} />
                <div>
                  <span>{t.city.toUpperCase()}</span>
                  <h3>{t.name.replace('IMovies ', '')}</h3>
                </div>
                <span className="cinema-screen-count">{t.screens.length} screens</span>
              </div>
              <div className="cinema-card-body">
                <h3>{t.name}</h3>
                <p>
                  <MapPin size={16} />
                  {t.address}
                </p>
                <div className="amenities">
                  {t.amenities.map((a) => (
                    <span key={a}>{a}</span>
                  ))}
                </div>
                <Link to={`/theatres/${t._id}`} className="btn btn-outline w-100">
                  Explore cinema
                  <ArrowUpRight size={17} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
