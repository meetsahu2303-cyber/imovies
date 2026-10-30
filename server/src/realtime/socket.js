import { Server } from 'socket.io';
import { corsOptions } from '../middleware/security.js';
import { socketAuth } from '../middleware/auth.js';
import { Show, publicSeats } from '../models/Show.js';
import { Session } from '../models/User.js';
import { events } from './events.js';
import { logger } from '../utils/logger.js';
export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: corsOptions,
    maxHttpBufferSize: 16384,
    pingTimeout: 20000,
  });
  socketAuth(io);
  const sendSeats = async (id) => {
    try {
      const show = await Show.findById(id).lean();
      if (show)
        io.to(`show:${id}`).emit('seats:updated', {
          showId: id,
          ...publicSeats(show),
          status: show.status,
        });
    } catch (error) {
      logger.error({ err: error }, 'Seat broadcast failed');
    }
  };
  events.on('seats', sendSeats);
  events.on('booking', (data) => io.to(`user:${data.userId}`).emit('booking:updated', data));
  events.on('notification', (data) =>
    io.to(`user:${data.userId}`).emit('notification:new', data.notification),
  );
  io.on('connection', (socket) => {
    if (socket.data.userId) {
      socket.join(`user:${socket.data.userId}`);
      if (socket.data.role === 'admin') socket.join('admin');
    }
    let windowStart = Date.now(),
      messages = 0;
    const subscribe = (payload, ack) => {
      if (Date.now() - windowStart > 10000) {
        windowStart = Date.now();
        messages = 0;
      }
      if (++messages > 30)
        return typeof ack === 'function' && ack({ error: 'Too many subscriptions.' });
      const id = typeof payload === 'string' ? payload : payload?.showId;
      if (typeof id !== 'string' || !/^[a-f0-9]{24}$/.test(id))
        return typeof ack === 'function' && ack({ error: 'Invalid show ID.' });
      socket.join(`show:${id}`);
      Show.findById(id)
        .lean()
        .then((show) => {
          if (show && typeof ack === 'function')
            ack({ showId: id, ...publicSeats(show), status: show.status });
        })
        .catch(() => {});
    };
    socket.on('show:subscribe', subscribe);
    socket.on('show:unsubscribe', (id) => {
      if (typeof id === 'string') socket.leave(`show:${id}`);
    });
    const sessionCheck = setInterval(async () => {
      if (!socket.data.userId) return;
      if (
        socket.data.exp * 1000 < Date.now() ||
        !(await Session.exists({
          _id: socket.data.sessionId,
          expiresAt: { $gt: new Date() },
        }))
      ) {
        socket.leave(`user:${socket.data.userId}`);
        socket.leave('admin');
        socket.data.userId = null;
        socket.emit('session:expired');
      }
    }, 30000);
    socket.on('disconnect', () => clearInterval(sessionCheck));
  });
  return io;
}
