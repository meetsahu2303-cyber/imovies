import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  Bell,
  ChevronDown,
  Clapperboard,
  MapPin,
  Search,
  Menu,
  X,
  Ticket,
  LayoutDashboard,
  LogOut,
  UserRound,
  ArrowUpRight,
  CheckCheck,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { api, errorMessage } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useSocket } from '../lib/socket';
import { setCity, setNotificationCount, signOut } from '../store';
export function Brand({ light = false }) {
  return (
    <Link to="/" className={`brand ${light ? 'brand-light' : ''}`} aria-label="IMovies home">
      <span className="brand-icon">
        <Clapperboard size={23} strokeWidth={1.8} />
      </span>
      <span>
        imovies<span className="brand-period">.</span>
      </span>
    </Link>
  );
}
export default function Layout() {
  const { user } = useSelector((s) => s.auth);
  const city = useSelector((s) => s.ui.city);
  const dispatch = useDispatch();
  const { data: meta } = useApi('/metadata');
  const { data: config } = useApi('/config');
  const { data: notes, reload } = useApi('/notifications', !user);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const socket = useSocket();
  const noteRef = useRef();
  const profileRef = useRef();
  useEffect(() => {
    setMobileOpen(false);
    setNotesOpen(false);
    setProfileOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);
  useEffect(() => {
    if (notes) dispatch(setNotificationCount(notes.unread));
  }, [notes, dispatch]);
  useEffect(() => {
    if (!socket) return;
    const onNote = () => {
      reload();
      toast.info('You have a new cinema update.', { toastId: 'cinema-update' });
    };
    const onExpired = () => {
      api
        .get('/auth/me')
        .then(() => socket.disconnect().connect())
        .catch(() => {});
    };
    socket.on('notification:new', onNote);
    socket.on('session:expired', onExpired);
    return () => {
      socket.off('notification:new', onNote);
      socket.off('session:expired', onExpired);
    };
  }, [socket, reload]);
  useEffect(() => {
    const outside = (event) => {
      if (!noteRef.current?.contains(event.target)) setNotesOpen(false);
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false);
    };
    const escape = (e) => {
      if (e.key === 'Escape') {
        setNotesOpen(false);
        setProfileOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  const logout = async () => {
    try {
      await dispatch(signOut()).unwrap();
      navigate('/');
      toast.success('You’re signed out. See you at the movies!');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const readAll = async () => {
    try {
      await api.post('/notifications/read');
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <nav className={`main-nav ${mobileOpen ? 'is-open' : ''}`} aria-label="Main navigation">
            <NavLink to="/" end>
              Discover
            </NavLink>
            <NavLink to="/movies">Movies</NavLink>
            <NavLink to="/theatres">Cinemas</NavLink>
            <NavLink to="/bookings">My bookings</NavLink>
          </nav>
          <div className="header-actions">
            <label className="city-picker">
              <MapPin size={16} />
              <select
                aria-label="Choose your city"
                value={city}
                onChange={(e) => dispatch(setCity(e.target.value))}
              >
                {Array.from(
                  new Set([city, ...(meta?.cities || ['Mumbai', 'New Delhi', 'Bengaluru'])]),
                ).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={13} />
            </label>
            <Link to="/movies" className="icon-button header-search" aria-label="Search movies">
              <Search size={20} />
            </Link>
            {user && (
              <div className="popover-anchor" ref={noteRef}>
                <button
                  className="icon-button notification-button"
                  aria-label="Notifications"
                  aria-expanded={notesOpen}
                  onClick={() => {
                    setNotesOpen(!notesOpen);
                    setProfileOpen(false);
                  }}
                >
                  <Bell size={20} />
                  {notes?.unread > 0 && <span className="notification-dot" />}
                </button>
                {notesOpen && (
                  <div className="header-popover notifications-popover">
                    <div className="popover-heading">
                      <strong>Your updates</strong>
                      <button
                        className="text-button"
                        onClick={readAll}
                        aria-label="Mark all notifications read"
                      >
                        <CheckCheck size={17} />
                        Read all
                      </button>
                    </div>
                    {notes?.items?.length ? (
                      notes.items.slice(0, 5).map((n) => (
                        <Link
                          key={n._id}
                          to={`/bookings/${n.booking}`}
                          className={`notification-item ${!n.read ? 'unread' : ''}`}
                        >
                          <strong>{n.title}</strong>
                          <p>{n.message}</p>
                        </Link>
                      ))
                    ) : (
                      <p className="popover-empty">
                        You’re all caught up. Your booking updates will appear here.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            {user ? (
              <div className="popover-anchor" ref={profileRef}>
                <button
                  className="profile-button"
                  onClick={() => {
                    setProfileOpen(!profileOpen);
                    setNotesOpen(false);
                  }}
                  aria-expanded={profileOpen}
                  aria-label="Account menu"
                >
                  <span>{user.name.charAt(0).toUpperCase()}</span>
                  <ChevronDown size={13} />
                </button>
                {profileOpen && (
                  <div className="header-popover profile-popover">
                    <div className="profile-info">
                      <strong>{user.name}</strong>
                      <small>{user.email}</small>
                    </div>
                    <Link to="/account">
                      <UserRound size={16} />
                      My account
                    </Link>
                    <Link to="/bookings">
                      <Ticket size={16} />
                      My bookings
                    </Link>
                    {user.role === 'admin' && (
                      <Link to="/admin">
                        <LayoutDashboard size={16} />
                        Admin console
                      </Link>
                    )}
                    <button onClick={logout}>
                      <LogOut size={16} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link className="btn btn-dark sign-in-button" to="/login">
                Sign in
                <ArrowUpRight size={15} />
              </Link>
            )}
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>
      {config?.demo && (
        <div className="demo-strip">
          <ShieldCheck size={12} />
          <span>Explore freely. This is a demo cinema — no real payments.</span>
        </div>
      )}
      <main id="main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container">
          <div className="footer-main">
            <div>
              <Brand light />
              <p>
                Great stories. Better seats.
                <br />
                Your next big-screen moment starts here.
              </p>
            </div>
            <div className="footer-links">
              <div>
                <strong>Explore</strong>
                <Link to="/movies">Now showing</Link>
                <Link to="/movies?tab=upcoming">Coming soon</Link>
                <Link to="/theatres">Our cinemas</Link>
              </div>
              <div>
                <strong>Your cinema</strong>
                <Link to="/bookings">My bookings</Link>
                <Link to="/account">My account</Link>
                <Link to="/help">Booking guide</Link>
              </div>
            </div>
            <div className="footer-note">
              <Ticket size={23} />
              <span>
                A little escape.
                <br />
                <strong>A whole lot of cinema.</strong>
              </span>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} IMovies. Made for the love of film.</span>
            <span>Demo project · Movie artwork belongs to its respective owners.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
