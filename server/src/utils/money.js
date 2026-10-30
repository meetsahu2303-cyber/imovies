export const BOOKING_FEE_PER_SEAT = 2500; // INR 25.00; all amounts are integer paise.
export const MAX_SEATS = 8;
export function quoteSeats(seats, show) {
  const subtotal = seats.reduce(
    (sum, seat) => sum + (seat.tier === 'premium' ? show.premiumPrice : show.basePrice),
    0,
  );
  const fee = seats.length * BOOKING_FEE_PER_SEAT;
  return { subtotal, fee, total: subtotal + fee, currency: 'INR' };
}
export function dayRange(date, timezone = 'Asia/Kolkata') {
  // Cinema business dates use IST. Compute the offset from an actual instant, not the host timezone.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const nominal = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(+nominal) || nominal.toISOString().slice(0, 10) !== date) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(nominal);
  const [h, m] = parts.split(':').map(Number);
  const start = new Date(+nominal - (h * 60 + m) * 60000);
  return { start, end: new Date(+start + 86400000) };
}
