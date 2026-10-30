import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  CreditCard,
  ShieldCheck,
  Clock3,
  Check,
  X,
  ArrowRight,
  Popcorn,
  Ticket,
  Info,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useApi, useCountdown } from '../lib/hooks';
import { api, money, dateLabel, timeLabel, errorMessage } from '../lib/api';
import { Spinner, ErrorState, Steps } from '../components/UI';
import { useSocket } from '../lib/socket';
export default function Checkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data, loading, error, reload } = useApi(`/bookings/${id}`);
  const booking = data?.booking;
  const [busy, setBusy] = useState(false);
  const timer = useCountdown(booking?.expiresAt);
  const socket = useSocket();
  const stripe = booking && data?.payments?.some((p) => p.provider === 'stripe');
  useEffect(() => {
    if (!stripe || booking?.status !== 'pending') return;
    const interval = setInterval(reload, 4000);
    return () => clearInterval(interval);
  }, [stripe, booking?.status, reload]);
  useEffect(() => {
    if (!socket) return;
    const update = (event) => {
      if (event.bookingId === id) reload();
    };
    socket.on('booking:updated', update);
    return () => socket.off('booking:updated', update);
  }, [socket, id, reload]);
  useEffect(() => {
    if (booking?.status === 'confirmed') navigate(`/bookings/${id}?celebrate=1`, { replace: true });
  }, [booking?.status, id, navigate]);
  useEffect(() => {
    if (params.get('cancelled'))
      toast.info('Checkout cancelled. Your seats are still held until the timer expires.');
  }, []);
  if (loading && !data) return <Spinner />;
  if (error)
    return (
      <div className="container page-space">
        <ErrorState message={error} retry={reload} />
      </div>
    );
  if (!booking) return null;
  if (['expired', 'cancelled'].includes(booking.status))
    return (
      <div className="container page-space">
        <div className="empty-state">
          <Clock3 size={40} />
          <h1>
            {booking.status === 'expired' ? 'This hold has ended.' : 'This booking was cancelled.'}
          </h1>
          <p>No seats are being held. You can start a fresh booking anytime.</p>
          <Link className="btn btn-primary" to={`/movies`}>
            Find another show
            <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    );
  const startCheckout = async () => {
    setBusy(true);
    try {
      const checkout = (await api.post(`/bookings/${id}/checkout`)).data;
      if (checkout.mode === 'confirmed') navigate(`/bookings/${checkout.bookingId}`);
      else if (checkout.url) window.location.assign(checkout.url);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const pay = async (outcome) => {
    setBusy(true);
    try {
      const payment = data.payments.find((p) => p.status === 'pending');
      if (!payment) throw new Error('No pending payment. Refresh and try again.');
      const result = (await api.post(`/payments/${payment._id}/demo`, { outcome })).data;
      if (outcome === 'success') {
        toast.success('It’s a movie night! Your tickets are confirmed.');
        navigate(`/bookings/${result.booking._id}?celebrate=1`);
      } else {
        toast.warn('Demo payment declined. Your seats are still held — you can try again.');
        reload();
      }
    } catch (e) {
      toast.error(errorMessage(e));
      reload();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="container page-space checkout-page">
      <Steps current={2} />
      <div className="page-heading">
        <div>
          <div className="eyebrow">ONE STEP CLOSER TO THE MAGIC</div>
          <h1>Make it official.</h1>
          <p>Review your plans, then settle in. We’ll take care of the tickets.</p>
        </div>
        <div className={`checkout-countdown ${timer.expired ? 'urgent' : ''}`}>
          <Clock3 size={20} />
          <div>
            <span>{timer.expired ? 'Reservation expired' : 'Your seats are held for'}</span>
            <strong>{timer.label}</strong>
          </div>
        </div>
      </div>
      <div className="checkout-layout">
        <section className="payment-panel">
          <div className="payment-panel-title">
            <CreditCard size={23} />
            <h2>{stripe ? 'Secure payment with Stripe' : 'A worry-free demo checkout'}</h2>
          </div>
          {stripe ? (
            <>
              <p>
                Continue to Stripe’s hosted checkout to complete your payment. Card details never
                pass through IMovies.
              </p>
              <div className="payment-info">
                <ShieldCheck size={25} />
                <span>
                  Your tickets are confirmed only after a verified Stripe payment webhook.
                </span>
              </div>
              <button
                className="btn btn-primary"
                disabled={busy || timer.expired}
                onClick={startCheckout}
              >
                {busy ? 'Opening checkout…' : 'Continue to Stripe'}
                <ArrowRight size={17} />
              </button>
            </>
          ) : (
            <>
              <div className="demo-payment-notice">
                <Info size={20} />
                <div>
                  <strong>No real money. No card details.</strong>
                  <p>
                    This sandbox lets you test the entire booking flow. Choose an outcome below to
                    simulate your payment.
                  </p>
                </div>
              </div>
              <div className="demo-card">
                <div>
                  <span>IMOVIES DEMO CARD</span>
                  <CreditCard size={28} />
                </div>
                <strong>•••• &nbsp; •••• &nbsp; •••• &nbsp; 4242</strong>
                <div>
                  <span>MOVIE NIGHT EXPLORER</span>
                  <span>ANY FUTURE DATE</span>
                </div>
                <span className="demo-card-watermark">DEMO</span>
              </div>
              <h3>Choose a payment outcome</h3>
              <p className="muted">
                A declined payment won’t charge you or immediately release your seats.
              </p>
              <div className="payment-outcomes">
                <button
                  className="btn btn-primary"
                  disabled={busy || timer.expired}
                  onClick={() => pay('success')}
                >
                  <Check size={18} />
                  {busy ? 'Processing…' : `Simulate success · ${money(booking.amount.total)}`}
                </button>
                <button
                  className="btn btn-outline"
                  disabled={busy || timer.expired}
                  onClick={() => pay('failure')}
                >
                  <X size={17} />
                  Simulate a declined payment
                </button>
              </div>
            </>
          )}
          <div className="checkout-policy">
            <ShieldCheck size={17} />
            <p>
              Cancel up to 2 hours before your show for a refund.{' '}
              {stripe
                ? 'Stripe refunds are processed asynchronously.'
                : 'Demo refunds are recorded instantly.'}{' '}
              All prices include the listed convenience fee.
            </p>
          </div>
        </section>
        <aside className="booking-summary checkout-summary">
          <div className="summary-title">
            <Popcorn size={24} />
            <h2>The plan</h2>
          </div>
          <div className="summary-movie">
            <img src={booking.poster} alt="" />
            <div>
              <h3>{booking.movieTitle}</h3>
              <p>{booking.screenName}</p>
            </div>
          </div>
          <p className="checkout-cinema">{booking.theatreName}</p>
          <div className="checkout-date">
            <strong>
              {dateLabel(booking.startsAt, {
                weekday: 'long',
                year: 'numeric',
              })}
            </strong>
            <span>{timeLabel(booking.startsAt)} · IST</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-row">
            <span>Seats</span>
            <strong>{booking.seats.map((s) => s.seatId).join(', ')}</strong>
          </div>
          <div className="summary-row muted">
            <span>Tickets ({booking.seats.length})</span>
            <span>{money(booking.amount.subtotal)}</span>
          </div>
          <div className="summary-row muted">
            <span>Convenience fee</span>
            <span>{money(booking.amount.fee)}</span>
          </div>
          <div className="summary-total">
            <span>Total</span>
            <strong>{money(booking.amount.total)}</strong>
          </div>
          <p className="summary-security">
            <ShieldCheck size={14} />
            No hidden extras. Just the good stuff.
          </p>
        </aside>
      </div>
      {timer.expired && (
        <Link to={`/movies`} className="btn btn-outline mt-4">
          Choose a new show
        </Link>
      )}
    </div>
  );
}
