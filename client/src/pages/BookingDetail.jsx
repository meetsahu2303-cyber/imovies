import { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Check,
  CalendarDays,
  Clock3,
  MapPin,
  Armchair,
  Download,
  Printer,
  ArrowRight,
  ShieldCheck,
  Popcorn,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useApi } from '../lib/hooks';
import { api, dateLabel, timeLabel, money, errorMessage } from '../lib/api';
import { Spinner, ErrorState, BackLink, Steps } from '../components/UI';
import { BookingStatus } from './Bookings';
import Modal from '../components/Modal';
export default function BookingDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { data, loading, error, reload } = useApi(`/bookings/${id}`);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (params.get('checkout') === 'returned' && data?.booking.status === 'pending') {
      const timer = setInterval(reload, 3000);
      return () => clearInterval(timer);
    }
  }, [data?.booking.status, reload]);
  if (loading) return <Spinner />;
  if (error)
    return (
      <div className="container page-space">
        <ErrorState message={error} retry={reload} />
      </div>
    );
  const b = data.booking;
  const canCancel = b.status === 'confirmed' && new Date(b.startsAt) - Date.now() >= 2 * 3600000;
  const cancel = async () => {
    setBusy(true);
    try {
      await api.post(`/bookings/${id}/cancel`);
      setCancelOpen(false);
      reload();
      toast.success('Booking cancelled. Your seats have been released.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const download = () => {
    const content = `IMOVIES — MOVIE TICKET\n\n${b.reference}\n${b.movieTitle}\n${b.theatreName}\n${b.screenName}\n${dateLabel(b.startsAt, { year: 'numeric', weekday: 'long' })} at ${timeLabel(b.startsAt)} IST\nSeats: ${b.seats.map((s) => s.seatId).join(', ')}\nTotal: ${money(b.amount.total)}\nStatus: ${b.status}\n\nPresent the QR code in your online ticket at the cinema.\nThis is a demo ticket, not valid for real admission.`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${b.reference}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="container page-space ticket-page">
      <BackLink to="/bookings">My bookings</BackLink>
      {b.status === 'confirmed' && <Steps current={3} />}
      <div className="ticket-page-heading">
        {b.status === 'confirmed' ? (
          <>
            <span className="success-icon">
              <Check size={28} />
            </span>
            <div className="eyebrow">YOU’RE GOING TO THE MOVIES</div>
            <h1>It’s a movie night.</h1>
            <p>Your seats are saved. All that’s left is to enjoy the story.</p>
          </>
        ) : (
          <>
            <h1>Your booking details</h1>
            <BookingStatus status={b.status} />
          </>
        )}
      </div>
      {b.status === 'pending' && (
        <div className="alert alert-warning">
          Your payment isn’t complete yet.{' '}
          <Link to={`/checkout/${b._id}`}>Finish your booking →</Link>
        </div>
      )}
      <article className="ticket-card">
        <div className="ticket-card-main">
          <div
            className="ticket-movie-banner"
            style={{
              backgroundImage: `linear-gradient(90deg,rgba(12,15,20,.85),rgba(12,15,20,.2)),url(${b.poster})`,
            }}
          >
            <span>IMOVIES PRESENTS</span>
            <h2>{b.movieTitle}</h2>
            <p>
              {b.screenName} · {b.seats.length} {b.seats.length === 1 ? 'ticket' : 'tickets'}
            </p>
          </div>
          <div className="ticket-information">
            <div>
              <span>
                <MapPin size={16} />
                YOUR CINEMA
              </span>
              <strong>{b.theatreName}</strong>
              <small>{b.city}</small>
            </div>
            <div>
              <span>
                <CalendarDays size={16} />
                DATE & TIME
              </span>
              <strong>{dateLabel(b.startsAt, { weekday: 'short', year: 'numeric' })}</strong>
              <small>{timeLabel(b.startsAt)} · Indian Standard Time</small>
            </div>
            <div>
              <span>
                <Armchair size={16} />
                YOUR SEATS
              </span>
              <strong className="ticket-seat-list">
                {b.seats.map((s) => s.seatId).join(' · ')}
              </strong>
              <small>{b.screenName}</small>
            </div>
            <div>
              <span>TOTAL PAID</span>
              <strong>{money(b.amount.total)}</strong>
              <small>
                {b.paymentStatus === 'refunded'
                  ? 'Refund recorded'
                  : b.paymentStatus === 'refund_pending'
                    ? 'Refund processing'
                    : b.paymentStatus === 'refund_failed'
                      ? 'Refund needs attention — contact cinema'
                      : 'Including convenience fee'}
              </small>
            </div>
          </div>
        </div>
        <aside className="ticket-qr-panel">
          <BookingStatus status={b.status} />
          <div className="qr-container">
            {b.status === 'confirmed' ? (
              <QRCodeSVG
                value={`IMOVIES:${b.reference}:${b._id}`}
                size={160}
                marginSize={1}
                level="M"
              />
            ) : (
              <Popcorn size={85} strokeWidth={1} />
            )}
          </div>
          <strong>{b.reference}</strong>
          <p>
            {b.status === 'confirmed'
              ? 'A little code for a big night.'
              : 'This ticket is not valid for entry.'}
          </p>
          <small>Demo ticket · Not valid for real admission</small>
        </aside>
      </article>
      <div className="ticket-actions">
        <button className="btn btn-outline" onClick={download}>
          <Download size={17} />
          Save ticket details
        </button>
        {b.status === 'confirmed' && (
          <button className="btn btn-outline" onClick={() => window.print()}>
            <Printer size={17} />
            Print ticket
          </button>
        )}
        {canCancel && (
          <button className="text-button cancel-booking-button" onClick={() => setCancelOpen(true)}>
            Cancel booking
          </button>
        )}
        <Link to="/movies" className="ticket-next-link">
          Find your next movie
          <ArrowRight size={16} />
        </Link>
      </div>
      <div className="ticket-help">
        <ShieldCheck size={20} />
        <p>
          <strong>A little change of plans?</strong> You can cancel up to 2 hours before the show.
          Your refund will be recorded automatically.
        </p>
      </div>
      {cancelOpen && (
        <Modal title="Cancel this movie night?" onClose={() => !busy && setCancelOpen(false)}>
          <p>
            You’re about to cancel <strong>{b.movieTitle}</strong>, seats{' '}
            {b.seats.map((s) => s.seatId).join(', ')}. Your seats will be released for other
            moviegoers.
          </p>
          <div className="refund-quote">
            <span>Refund amount</span>
            <strong>{money(b.amount.total)}</strong>
          </div>
          <p className="muted">
            This action cannot be undone. Demo refunds are simulated; Stripe refunds may take
            several business days.
          </p>
          <div className="modal-actions">
            <button
              className="btn btn-outline"
              disabled={busy}
              onClick={() => setCancelOpen(false)}
            >
              Keep my tickets
            </button>
            <button className="btn btn-danger" disabled={busy} onClick={cancel}>
              {busy ? 'Cancelling…' : 'Yes, cancel booking'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
