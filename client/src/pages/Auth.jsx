import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowRight, Clapperboard, Eye, EyeOff, ShieldCheck, Ticket } from 'lucide-react';
import { signIn, signUp, clearAuthError } from '../store';
import { Brand } from '../components/Layout';
import { useApi } from '../lib/hooks';
export default function Auth({ register = false }) {
  const { data: config } = useApi('/config');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, busy, error } = useSelector((s) => s.auth);
  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
    city: 'Mumbai',
  });
  const [showPassword, setShowPassword] = useState(false);
  const from = location.state?.from || '/';
  useEffect(() => {
    dispatch(clearAuthError());
  }, [register, dispatch]);
  useEffect(() => {
    if (user)
      navigate(from.startsWith('/') && !from.startsWith('//') ? from : '/', {
        replace: true,
      });
  }, [user, navigate, from]);
  const submit = async (e) => {
    e.preventDefault();
    dispatch(
      register ? signUp(values) : signIn({ email: values.email, password: values.password }),
    );
  };
  const field = (key, value) => setValues((v) => ({ ...v, [key]: value }));
  const demo = (role) =>
    setValues((v) => ({
      ...v,
      email: role === 'admin' ? 'admin@imovies.local' : 'alex@imovies.local',
      password: role === 'admin' ? 'Admin@12345' : 'Movie@12345',
    }));
  return (
    <div className="auth-page">
      <div className="auth-story">
        <img
          src="/posters/interstellar-space.jpg"
          alt="A spacecraft beside the glowing Gargantua black hole"
        />
        <div className="auth-story-shade" />
        <div className="auth-story-content">
          <Brand light />
          <div>
            <div className="eyebrow">THERE’S ALWAYS A GOOD STORY AHEAD</div>
            <h1>
              Your next
              <br />
              big-screen
              <br />
              <em>moment awaits.</em>
            </h1>
            <p>
              The films you love. The seats you want.
              <br />
              All in one place.
            </p>
          </div>
          <span>
            <Ticket size={18} />
            Less hassle. More movie magic.
          </span>
        </div>
      </div>
      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-symbol">
            <Clapperboard size={27} />
          </div>
          <div className="eyebrow">{register ? 'JOIN THE AUDIENCE' : 'WELCOME BACK'}</div>
          <h1>{register ? 'Let’s make it a movie.' : 'Good to see you again.'}</h1>
          <p>
            {register
              ? 'Create your account. Your next great watch is waiting.'
              : 'Sign in to book your seats and pick up where you left off.'}
          </p>
          <form onSubmit={submit}>
            {register && (
              <label className="field-label">
                Your name
                <input
                  className="form-control"
                  autoComplete="name"
                  placeholder="Alex Morgan"
                  required
                  minLength={2}
                  maxLength={80}
                  value={values.name}
                  onChange={(e) => field('name', e.target.value)}
                />
              </label>
            )}
            <label className="field-label">
              Email address
              <input
                className="form-control"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                value={values.email}
                onChange={(e) => field('email', e.target.value)}
              />
            </label>
            <label className="field-label">
              Password
              <div className="password-field">
                <input
                  className="form-control"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={register ? 'new-password' : 'current-password'}
                  placeholder={register ? 'At least 10 characters' : 'Enter your password'}
                  required
                  minLength={register ? 10 : 1}
                  maxLength={72}
                  value={values.password}
                  onChange={(e) => field('password', e.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {register && (
              <>
                <p className="password-hint">Use uppercase and lowercase letters, and a number.</p>
                <label className="field-label">
                  Your city
                  <select
                    className="form-select"
                    value={values.city}
                    onChange={(e) => field('city', e.target.value)}
                  >
                    <option>Mumbai</option>
                    <option>New Delhi</option>
                    <option>Bengaluru</option>
                  </select>
                </label>
              </>
            )}
            {error && (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            )}
            <button className="btn btn-primary w-100 auth-submit" disabled={busy}>
              {busy ? 'One moment…' : register ? 'Create my account' : 'Sign in'}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="auth-switch">
            {register ? 'Already part of the audience?' : 'New to IMovies?'}{' '}
            <Link to={register ? '/login' : '/register'} state={{ from }}>
              {register ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
          {config?.demoAccounts && (
            <div className="demo-credentials">
              <strong>
                <ShieldCheck size={16} />
                Just exploring? Try a demo account.
              </strong>
              <p>Fill in the credentials, then select sign in. No real payments.</p>
              <div>
                <button onClick={() => demo('user')}>
                  Moviegoer demo
                  <ArrowRight size={14} />
                </button>
                <button onClick={() => demo('admin')}>
                  Admin demo
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
          <span className="auth-security">
            <ShieldCheck size={14} />
            Your session is protected with secure, HTTP-only cookies.
          </span>
        </div>
      </div>
    </div>
  );
}
