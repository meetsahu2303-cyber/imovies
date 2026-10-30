import { EventEmitter } from 'node:events';
export const events = new EventEmitter();
// Call only AFTER a transaction commits. Socket delivery is best-effort; REST remains authoritative.
export const emitSeats = (showId) => events.emit('seats', String(showId));
export const emitBooking = (booking) =>
  events.emit('booking', {
    userId: String(booking.user?._id || booking.user),
    bookingId: String(booking._id),
  });
export const emitNotification = (notification) =>
  events.emit('notification', {
    userId: String(notification.user),
    notification: notification.toObject ? notification.toObject() : notification,
  });
