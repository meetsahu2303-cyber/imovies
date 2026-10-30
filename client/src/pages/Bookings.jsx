import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, MapPin, Ticket, Plus, Popcorn } from 'lucide-react';
import { useApi } from '../lib/hooks';
import { useSocket } from '../lib/socket';
import { dateLabel, timeLabel, money } from '../lib/api';
import { PageHeading, Spinner, ErrorState, EmptyState, Pagination } from '../components/UI';
export function BookingStatus({ status }) {
  return (
    <span className={`booking-status status-${status}`}>
      {status === 'confirmed'
        ? 'Confirmed'
        : status === 'pending'
          ? 'Awaiting payment'
          : status === 'cancelled'
            ? 'Cancelled'
            : 'Expired'}
    </span>
  );
}
export default function Bookings() {
  const [scope, setScope] = useState('upcoming');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi(`/bookings?scope=${scope}&page=${page}&limit=8`);
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    socket.on('booking:updated', reload);
    return () => socket.off('booking:updated', reload);
  }, [socket, reload]);
  return (
    <div className="container page-space bookings-page">
      <PageHeading
        eyebrow="YOUR TICKET TO A GOOD TIME"
        title="Plans worth looking forward to."
        description="All your movie nights, in one place. We’ll keep the details handy."
      >
        <Link to="/movies" className="btn btn-primary">
          <Plus size={17} />
          Book another movie
        </Link>
      </PageHeading>
      <div className="booking-tabs pill-tabs">
        {[
          ['upcoming', 'Upcoming'],
          ['past', 'Past & cancelled'],
          ['all', 'All bookings'],
        ].map(([key, label]) => (
          <button
            key={key}
            className={scope === key ? 'active' : ''}
            onClick={() => {
              setScope(key);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} retry={reload} />
      ) : !data?.items.length ? (
        <EmptyState
          title={scope === 'upcoming' ? 'Your next movie night is waiting' : 'No bookings here yet'}
          message="A great story, your favorite people, and the perfect seats. Let’s make a plan."
        >
          <Link to="/movies" className="btn btn-primary">
            Explore movies
            <ArrowUpRight size={17} />
          </Link>
        </EmptyState>
      ) : (
        <div className="booking-list">
          {data.items.map((b) => (
            <article className="booking-card" key={b._id}>
              <img src={b.poster} alt={`${b.movieTitle} poster`} />
              <div className="booking-card-info">
                <div className="booking-card-top">
                  <BookingStatus status={b.status} />
                  <span>{b.reference}</span>
                </div>
                <h2>{b.movieTitle}</h2>
                <p>
                  <MapPin size={15} />
                  {b.theatreName} · {b.screenName}
                </p>
                <div className="booking-card-details">
                  <span>
                    <CalendarDays size={15} />
                    {dateLabel(b.startsAt, {
                      year: 'numeric',
                      weekday: 'short',
                    })}
                  </span>
                  <span>{timeLabel(b.startsAt)}</span>
                  <span>
                    <Ticket size={15} />
                    {b.seats.map((s) => s.seatId).join(', ')}
                  </span>
                </div>
              </div>
              <div className="booking-card-action">
                <strong>{money(b.amount.total)}</strong>
                <span>
                  {b.seats.length} {b.seats.length === 1 ? 'ticket' : 'tickets'}
                </span>
                <Link
                  to={b.status === 'pending' ? `/checkout/${b._id}` : `/bookings/${b._id}`}
                  className="btn btn-outline"
                >
                  {b.status === 'pending' ? 'Finish booking' : 'View ticket'}
                  <ArrowUpRight size={16} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
      <Pagination value={data?.pagination} onChange={setPage} />
    </div>
  );
}
