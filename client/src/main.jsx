import React, { useEffect, Component } from 'react';
import ReactDOM from 'react-dom/client';
import { Provider, useDispatch } from 'react-redux';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/outfit';
import 'bootstrap/dist/css/bootstrap-grid.min.css';
import 'bootstrap/dist/css/bootstrap-utilities.min.css';
import 'react-toastify/dist/ReactToastify.css';
import './styles.css';
import { store, fetchMe, expireSession } from './store';
import { SocketProvider } from './lib/socket';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Movies from './pages/Movies';
import MovieDetail from './pages/MovieDetail';
import Theatres from './pages/Theatres';
import TheatreDetail from './pages/TheatreDetail';
import Auth from './pages/Auth';
import SeatSelection from './pages/SeatSelection';
import Checkout from './pages/Checkout';
import Bookings from './pages/Bookings';
import BookingDetail from './pages/BookingDetail';
import Account from './pages/Account';
import Admin from './pages/Admin';
import Help from './pages/Help';
class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="empty-state">
        <h1>A brief intermission.</h1>
        <p>Something unexpected happened. Reload the page to get back to the story.</p>
        <button className="btn btn-primary" onClick={() => window.location.assign('/')}>
          Back to IMovies
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function SessionBootstrap() {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(fetchMe());
    const expired = () => dispatch(expireSession());
    window.addEventListener('imovies:session-expired', expired);
    return () => window.removeEventListener('imovies:session-expired', expired);
  }, [dispatch]);
  return null;
}
function TitleManager() {
  const { pathname } = useLocation();
  useEffect(() => {
    const title = pathname.startsWith('/admin')
      ? 'Cinema control'
      : pathname.startsWith('/bookings')
        ? 'My movie nights'
        : pathname.startsWith('/movies/')
          ? 'Your next big-screen experience'
          : pathname.startsWith('/theatres')
            ? 'Our cinemas'
            : 'Your next big screen moment';
    document.title = `${title} — IMovies`;
  }, [pathname]);
  return null;
}
function App() {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <BrowserRouter>
          <SocketProvider>
            <SessionBootstrap />
            <TitleManager />
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="movies" element={<Movies />} />
                <Route path="movies/:id" element={<MovieDetail />} />
                <Route path="theatres" element={<Theatres />} />
                <Route path="theatres/:id" element={<TheatreDetail />} />
                <Route path="shows/:id" element={<SeatSelection />} />
                <Route path="login" element={<Auth />} />
                <Route path="register" element={<Auth register />} />
                <Route path="help" element={<Help />} />
                <Route element={<ProtectedRoute />}>
                  <Route path="checkout/:id" element={<Checkout />} />
                  <Route path="bookings" element={<Bookings />} />
                  <Route path="bookings/:id" element={<BookingDetail />} />
                  <Route path="account" element={<Account />} />
                </Route>
                <Route element={<ProtectedRoute admin />}>
                  <Route path="admin" element={<Admin />} />
                </Route>
                <Route
                  path="*"
                  element={
                    <div className="container page-space">
                      <div className="empty-state">
                        <div className="eyebrow">404 · SCENE NOT FOUND</div>
                        <h1>This scene didn’t make the cut.</h1>
                        <p>Let’s get you back to a better story.</p>
                        <Link to="/" className="btn btn-primary">
                          Back to the movies
                        </Link>
                      </div>
                    </div>
                  }
                />
              </Route>
            </Routes>
            <ToastContainer
              position="bottom-right"
              autoClose={4000}
              newestOnTop
              closeOnClick
              pauseOnFocusLoss={false}
              theme="light"
            />
          </SocketProvider>
        </BrowserRouter>
      </Provider>
    </ErrorBoundary>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
