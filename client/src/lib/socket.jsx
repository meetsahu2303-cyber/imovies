import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useSelector } from 'react-redux';
const SocketContext = createContext(null);
export function SocketProvider({ children }) {
  const user = useSelector((s) => s.auth.user);
  const [socket, setSocket] = useState(null);
  useEffect(() => {
    const instance = io({
      withCredentials: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    setSocket(instance);
    return () => {
      instance.disconnect();
    };
  }, [user?.id]);
  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
export const useSocket = () => useContext(SocketContext);
export function useSeatUpdates(showId, onUpdate) {
  const socket = useSocket();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!socket || !showId) return;
    const update = (data) => {
      if (data.showId === showId) onUpdate(data);
    };
    const subscribe = () => {
      setConnected(true);
      socket.emit('show:subscribe', { showId });
    };
    const disconnect = () => setConnected(false);
    socket.on('connect', subscribe);
    socket.on('disconnect', disconnect);
    socket.on('seats:updated', update);
    if (socket.connected) subscribe();
    return () => {
      socket.emit('show:unsubscribe', showId);
      socket.off('connect', subscribe);
      socket.off('disconnect', disconnect);
      socket.off('seats:updated', update);
    };
  }, [socket, showId, onUpdate]);
  return connected;
}
