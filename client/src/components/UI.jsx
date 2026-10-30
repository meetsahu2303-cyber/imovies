import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Film, LoaderCircle, Star, Ticket, ArrowLeft } from 'lucide-react';
import { runtime } from '../lib/api';
export function Spinner({ label = 'Loading your cinema…' }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={28} />
      <span>{label}</span>
    </div>
  );
}
export function ErrorState({ message, retry }) {
  return (
    <div className="empty-state">
      <AlertCircle size={32} />
      <h3>A little intermission</h3>
      <p>{message || 'Something went wrong.'}</p>
      {retry && (
        <button className="btn btn-dark" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function EmptyState({ title = 'Nothing here just yet', message, children }) {
  return (
    <div className="empty-state">
      <Ticket size={36} strokeWidth={1.4} />
      <h3>{title}</h3>
      <p>{message}</p>
      {children}
    </div>
  );
}
export function PageHeading({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function BackLink({ to = '/', children = 'Back to movies' }) {
  return (
    <Link className="back-link" to={to}>
      <ArrowLeft size={16} />
      {children}
    </Link>
  );
}
export function MovieCard({ movie, index = 0 }) {
  return (
    <article className="movie-card" style={{ '--card-delay': `${Math.min(index, 7) * 45}ms` }}>
      <Link
        to={`/movies/${movie.slug || movie._id}`}
        className="poster-link"
        aria-label={`View ${movie.title}`}
      >
        <img src={movie.poster} alt={`${movie.title} poster`} loading="lazy" />
        <span className="poster-rating">
          <Star size={12} fill="currentColor" />
          {movie.rating?.toFixed(1)}
          <span>/ 10</span>
        </span>
        <span className="poster-format">
          {movie.formats?.includes('IMAX') ? 'IMAX & 2D' : movie.formats?.join(' · ')}
        </span>
        <span className="poster-hover">
          {movie.status === 'upcoming' ? 'Explore movie' : 'Book your experience'}
          <ArrowRight size={18} />
        </span>
      </Link>
      <div className="movie-card-body">
        <Link to={`/movies/${movie.slug || movie._id}`}>
          <h3>{movie.title}</h3>
        </Link>
        <p>{movie.genres?.slice(0, 3).join(' · ')}</p>
        <div className="movie-card-meta">
          <span>{movie.languages?.[0]}</span>
          <span className="meta-dot" />
          <span>{runtime(movie.duration)}</span>
          <span className="certificate">{movie.certificate}</span>
        </div>
      </div>
    </article>
  );
}
export function MovieSkeletons({ count = 4 }) {
  return Array.from({ length: count }, (_, i) => (
    <div className="movie-skeleton skeleton" key={i}>
      <div />
      <span />
      <small />
    </div>
  ));
}
export function Pagination({ value, onChange }) {
  if (!value || value.pages <= 1) return null;
  return (
    <nav className="pagination-bar" aria-label="Pagination">
      <button
        className="btn btn-outline"
        disabled={value.page <= 1}
        onClick={() => onChange(value.page - 1)}
      >
        Previous
      </button>
      <span>
        Page <strong>{value.page}</strong> of {value.pages}
      </span>
      <button
        className="btn btn-outline"
        disabled={value.page >= value.pages}
        onClick={() => onChange(value.page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
export function Steps({ current = 1 }) {
  return (
    <div className="booking-steps" aria-label={`Step ${current} of 3`}>
      {['Select seats', 'Payment', 'Your tickets'].map((label, i) => (
        <div
          key={label}
          className={current === i + 1 ? 'active' : current > i + 1 ? 'complete' : ''}
        >
          <span>{i + 1}</span>
          {label}
          {i < 2 && <i />}
        </div>
      ))}
    </div>
  );
}
