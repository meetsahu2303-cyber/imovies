import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { ShieldCheck, UserRound, Save } from 'lucide-react';
import { toast } from 'react-toastify';
import { api, errorMessage } from '../lib/api';
import { fetchMe } from '../store';
import { PageHeading } from '../components/UI';
export default function Account() {
  const { user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const [name, setName] = useState(user.name);
  const [city, setCity] = useState(user.city);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch('/auth/me', { name, city });
      await dispatch(fetchMe());
      toast.success('Your profile is up to date.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="container page-space">
      <PageHeading
        eyebrow="YOUR LITTLE CORNER OF THE CINEMA"
        title="Hello, movie person."
        description="Keep your details up to date for a smoother booking experience."
      />
      <div className="account-card">
        <div className="account-avatar">
          <UserRound size={35} />
        </div>
        <form onSubmit={save}>
          <label className="field-label">
            Full name
            <input
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
            />
          </label>
          <label className="field-label">
            Email address
            <input className="form-control" value={user.email} disabled />
            <small>Your email is linked to your bookings and can’t be changed here.</small>
          </label>
          <label className="field-label">
            Preferred city
            <select className="form-select" value={city} onChange={(e) => setCity(e.target.value)}>
              <option>Mumbai</option>
              <option>New Delhi</option>
              <option>Bengaluru</option>
            </select>
          </label>
          <div className="account-role">
            <ShieldCheck size={17} />
            {user.role === 'admin' ? 'Cinema administrator' : 'Moviegoer account'}
          </div>
          <button className="btn btn-primary" disabled={busy}>
            <Save size={17} />
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
