import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Armchair,
  ArrowRight,
  Clock3,
  Info,
  MapPin,
  ShieldCheck,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useApi, useCountdown } from '../lib/hooks';
import { api, dateLabel, errorMessage, money, timeLabel } from '../lib/api';
import { useSeatUpdates } from '../lib/socket';
import { BackLink, Spinner, ErrorState, Steps } from '../components/UI';
export default function SeatSelection() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useSelector((s) => s.auth.user);
  const { data, loading, error, reload, setData } = useApi(`/shows/${id}`);
  const show = data?.show;
  const [selected, setSelected] = useState([]);
  const [hold, setHold] = useState(null);
  const [busy, setBusy] = useState(false);
  const reservingRef = useRef(false);
  const holdRef = useRef(null);
  const bookedRef = useRef(false);
  const keyRef = useRef(crypto.randomUUID());
  const receiveSeats = useCallback(
    (update) => {
      setData((old) =>
        old
          ? {
              ...old,
              show: { ...old.show, seats: update.seats, status: update.status },
            }
          : old,
      );
      setSelected((old) =>
        old.filter((seatId) => {
          const seat = update.seats.find((s) => s.seatId === seatId);
          return (
            seat?.status === 'available' ||
            (seat?.status === 'held' && (holdRef.current || reservingRef.current))
          );
        }),
      );
    },
    [setData],
  );
  const connected = useSeatUpdates(id, receiveSeats);
  const timer = useCountdown(hold?.expiresAt);
  useEffect(() => {
    if (hold && timer.expired && !busy) {
      setHold(null);
      holdRef.current = null;
      setSelected([]);
      toast.warn('Your seat hold expired. Please choose your seats again.');
      reload();
    }
  }, [timer.expired, hold, busy, reload]);
  useEffect(
    () => () => {
      if (holdRef.current && !bookedRef.current)
        api
          .delete(`/shows/${id}/holds`, {
            data: { holdId: holdRef.current.holdId },
          })
          .catch(() => {});
    },
    [id],
  );
  useEffect(() => {
    if (!show || hold || bookedRef.current) return;
    try {
      const draft = JSON.parse(sessionStorage.getItem('imovies-seat-draft'));
      if (draft?.showId === id) {
        setSelected(
          draft.selected.filter((seatId) =>
            show.seats.some((s) => s.seatId === seatId && s.status === 'available'),
          ),
        );
        sessionStorage.removeItem('imovies-seat-draft');
      }
    } catch {}
  }, [show?._id, loading]);
  if (loading) return <Spinner label="Preparing your seat map…" />;
  if (error)
    return (
      <div className="container page-space">
        <ErrorState message={error} retry={reload} />
      </div>
    );
  if (!show) return null;
  const rows = Array.from(new Set(show.seats.map((s) => s.row)));
  const columns = Math.max(...show.seats.map((s) => s.number));
  const aisle =
    show.theatre.screens.find((s) => String(s._id) === String(show.screen))?.aisleAfter || 6;
  const chosen = show.seats.filter((s) => selected.includes(s.seatId));
  const subtotal = chosen.reduce(
    (total, s) => total + (s.tier === 'premium' ? show.premiumPrice : show.basePrice),
    0,
  );
  const fee = chosen.length * 2500;
  const open = show.status === 'scheduled' && new Date(show.startsAt) > new Date();
  const toggleSeat = (seat) => {
    if (busy || hold || !open) return;
    if (seat.status !== 'available') return;
    if (selected.includes(seat.seatId)) setSelected(selected.filter((s) => s !== seat.seatId));
    else if (selected.length < 8) setSelected([...selected, seat.seatId]);
    else toast.info('You can book up to 8 seats in one booking.');
  };
  const reserve = async () => {
    if (!selected.length) return;
    if (!user) {
      sessionStorage.setItem('imovies-seat-draft', JSON.stringify({ showId: id, selected }));
      navigate('/login', { state: { from: `/shows/${id}` } });
      return;
    }
    setBusy(true);
    reservingRef.current = true;
    try {
      const result = (await api.post(`/shows/${id}/holds`, { seatIds: selected })).data;
      holdRef.current = result;
      setHold(result);
    } catch (e) {
      toast.error(errorMessage(e));
      reload();
      setSelected([]);
    } finally {
      reservingRef.current = false;
      setBusy(false);
    }
  };
  const confirmSeats = async () => {
    setBusy(true);
    try {
      const { data: result } = await api.post('/bookings', {
        showId: id,
        holdId: hold.holdId,
        idempotencyKey: keyRef.current,
      });
      bookedRef.current = true;
      navigate(`/checkout/${result.booking._id}`);
    } catch (e) {
      toast.error(errorMessage(e));
      if (e.response?.data?.error?.code === 'HOLD_EXPIRED') {
        setHold(null);
        holdRef.current = null;
        reload();
      }
    } finally {
      setBusy(false);
    }
  };
  const release = async () => {
    setBusy(true);
    try {
      await api.delete(`/shows/${id}/holds`, { data: { holdId: hold.holdId } });
      holdRef.current = null;
      setHold(null);
      setSelected([]);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="container page-space seat-page">
      <BackLink to={`/movies/${show.movie.slug}`}>Back to showtimes</BackLink>
      <Steps current={1} />
      <div className="seat-heading">
        <div>
          <h1>{show.movie.title}</h1>
          <p>
            <MapPin size={15} />
            {show.theatre.name}
            <span>·</span>
            {show.screenName}
            <span>·</span>
            {show.format}
          </p>
        </div>
        <div className="seat-show-time">
          <strong>{timeLabel(show.startsAt)}</strong>
          <span>{dateLabel(show.startsAt, { weekday: 'short', year: 'numeric' })}</span>
        </div>
      </div>
      {!open && (
        <div className="alert alert-warning">
          This show is no longer open for booking. Please choose another show.
        </div>
      )}
      <div className="seat-layout">
        <section className="seat-map-panel">
          <div className="seat-map-top">
            <h2>Find your favorite spot</h2>
            <span className={`live-indicator ${connected ? '' : 'offline'}`}>
              {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
              {connected ? 'Live availability' : 'Reconnecting…'}
            </span>
          </div>
          <p className="seat-scroll-hint">Swipe the seat map to see every seat →</p>
          <div className="seat-map-scroll" tabIndex={0} aria-label="Scrollable auditorium seat map">
            <div className="seat-map" style={{ '--columns': columns }}>
              <div className="screen-illustration">
                <svg viewBox="0 0 500 35" aria-hidden="true">
                  <path d="M10 28 Q250 -5 490 28" />
                  <path d="M10 28 L35 35 H465 L490 28" />
                </svg>
                <span>THE SCREEN IS THIS WAY</span>
              </div>
              {rows.map((row) => (
                <div className="seat-row" key={row}>
                  <span className="row-label">{row}</span>
                  <div
                    className="row-seats"
                    style={{
                      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                    }}
                  >
                    {show.seats
                      .filter((s) => s.row === row)
                      .sort((a, b) => a.number - b.number)
                      .map((seat) => (
                        <button
                          key={seat.seatId}
                          className={`seat ${seat.status} ${seat.tier} ${selected.includes(seat.seatId) ? 'selected' : ''}`}
                          style={{
                            gridColumn: seat.number + (seat.number > aisle ? 1 : 0),
                          }}
                          disabled={seat.status !== 'available' || !!hold || busy || !open}
                          onClick={() => toggleSeat(seat)}
                          aria-label={`${seat.seatId}, ${seat.tier}, ${seat.status === 'available' ? money(seat.tier === 'premium' ? show.premiumPrice : show.basePrice) : seat.status}`}
                          aria-pressed={selected.includes(seat.seatId)}
                          title={`${seat.seatId} · ${seat.tier} · ${seat.status}`}
                        >
                          <Armchair size={23} strokeWidth={1.6} />
                          <span>{seat.number}</span>
                        </button>
                      ))}
                  </div>
                  <span className="row-label">{row}</span>
                </div>
              ))}
              <div className="screen-direction">All eyes this way. The story starts here.</div>
            </div>
          </div>
          <div className="seat-legend">
            <span>
              <Armchair size={18} />
              Available
            </span>
            <span>
              <Armchair size={18} className="legend-selected" />
              Selected
            </span>
            <span>
              <Armchair size={18} className="legend-booked" />
              Unavailable
            </span>
            <span>
              <i className="premium-dot" />
              Premium row
            </span>
          </div>
          <div className="seat-tip">
            <Info size={17} />
            <p>
              Select up to 8 seats. We’ll hold your selection for 5 minutes while you continue to
              checkout.
            </p>
          </div>
        </section>
        <aside className="booking-summary">
          <div className="summary-title">
            <TicketIcon />
            <h2>Your movie night</h2>
          </div>
          <div className="summary-movie">
            <img src={show.movie.poster} alt="" />
            <div>
              <h3>{show.movie.title}</h3>
              <p>
                {show.language} · {show.format}
              </p>
              <span>
                {show.movie.certificate} · {show.movie.duration} min
              </span>
            </div>
          </div>
          <div className="summary-divider" />
          <div className="summary-row">
            <span>Seats</span>
            <strong>{selected.length ? `${selected.length} selected` : 'Pick your seats'}</strong>
          </div>
          <div className="selected-seat-tags">
            {chosen.length ? (
              chosen.map((s) => <span key={s.seatId}>{s.seatId}</span>)
            ) : (
              <p>Your perfect spot is waiting.</p>
            )}
          </div>
          {chosen.map((s) => (
            <div className="summary-row muted" key={s.seatId}>
              <span>
                {s.seatId} · {s.tier === 'premium' ? 'Premium' : 'Standard'}
              </span>
              <span>{money(s.tier === 'premium' ? show.premiumPrice : show.basePrice)}</span>
            </div>
          ))}
          <div className="summary-row muted">
            <span>
              Convenience fee <small>(₹25 / seat)</small>
            </span>
            <span>{money(fee)}</span>
          </div>
          <div className="summary-total">
            <span>Total amount</span>
            <strong>{money(subtotal + fee)}</strong>
          </div>
          {hold && (
            <div className={`hold-timer ${timer.remaining < 60 ? 'urgent' : ''}`}>
              <Clock3 size={17} />
              <span>
                Seats held for <strong>{timer.label}</strong>
              </span>
              <button
                className="icon-button"
                aria-label="Release seat hold"
                onClick={release}
                disabled={busy}
              >
                <X size={15} />
              </button>
            </div>
          )}
          <button
            className="btn btn-primary w-100"
            disabled={
              (!selected.length && !hold?.seats?.length) ||
              busy ||
              !open ||
              (timer.expired && !!hold)
            }
            onClick={hold ? confirmSeats : reserve}
          >
            {busy
              ? 'One moment…'
              : hold
                ? 'Continue to payment'
                : user
                  ? 'Reserve my seats'
                  : 'Sign in to continue'}
            <ArrowRight size={17} />
          </button>
          <p className="summary-security">
            <ShieldCheck size={14} />
            Prices checked securely on the server
          </p>
        </aside>
      </div>
    </div>
  );
}
function TicketIcon() {
  return <Armchair size={22} />;
}
