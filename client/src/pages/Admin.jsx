import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Film,
  Building2,
  CalendarDays,
  Ticket,
  Plus,
  Pencil,
  Trash2,
  ArrowUpRight,
  IndianRupee,
  Users,
  Upload,
  Check,
  RefreshCw,
  Search,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { api, money, dateLabel, timeLabel, errorMessage, todayIST } from '../lib/api';
import { useApi } from '../lib/hooks';
import { PageHeading, Spinner, ErrorState, Pagination, EmptyState } from '../components/UI';
import { BookingStatus } from './Bookings';
import Modal from '../components/Modal';
const tabs = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'movies', label: 'Movies', icon: Film },
  { key: 'theatres', label: 'Cinemas', icon: Building2 },
  { key: 'shows', label: 'Shows', icon: CalendarDays },
  { key: 'bookings', label: 'Bookings', icon: Ticket },
];
const list = (value) =>
  Array.isArray(value)
    ? value.join(', ')
    : value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
export default function Admin() {
  const [tab, setTab] = useState('overview');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const dashboard = useApi('/admin/dashboard');
  const resources = useApi(tab === 'overview' ? null : `/admin/${tab}?page=${page}&limit=12`);
  const refresh = () => {
    dashboard.reload();
    resources.reload();
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/admin/${deleting.type}/${deleting.item._id}`);
      toast.success('Record removed from active listings.');
      setDeleting(null);
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const cancel = async (booking) => {
    setDeleting({ type: 'bookings', item: booking, cancel: true });
  };
  const cancelConfirm = async () => {
    setBusy(true);
    try {
      await api.post(`/admin/bookings/${deleting.item._id}/cancel`);
      setDeleting(null);
      toast.success('Booking cancelled and refund initiated.');
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const retry = async (b) => {
    try {
      const result = await api.post(`/admin/bookings/${b._id}/refund-retry`);
      toast.info(
        result.data.booking.paymentStatus === 'refunded'
          ? 'Refunded.'
          : 'Refund retry submitted. Check the status again shortly.',
      );
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const stats = dashboard.data;
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="eyebrow">BEHIND THE SCENES</div>
        <h2>
          Cinema control<span>.</span>
        </h2>
        <nav>
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={tab === key ? 'active' : ''}
              onClick={() => {
                setTab(key);
                setPage(1);
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-note">
          <span className="live-dot" />
          Your cinema, connected.
          <p>Changes to shows and seats appear in real time.</p>
        </div>
        <Link to="/">
          Back to the cinema
          <ArrowUpRight size={15} />
        </Link>
      </aside>
      <div className="admin-content">
        <PageHeading
          eyebrow="IMOVIES ADMINISTRATION"
          title={tabs.find((t) => t.key === tab)?.label || 'Overview'}
          description="Keep the stories coming and every show running smoothly."
        >
          {tab !== 'overview' && tab !== 'bookings' && (
            <button
              className="btn btn-primary"
              onClick={() => setEditing({ type: tab, item: null })}
            >
              <Plus size={17} />
              Add {tab === 'theatres' ? 'cinema' : tab === 'shows' ? 'show' : 'movie'}
            </button>
          )}
          <button
            className="icon-button admin-refresh"
            onClick={refresh}
            aria-label="Refresh admin data"
          >
            <RefreshCw size={18} />
          </button>
        </PageHeading>
        {tab === 'overview' ? (
          dashboard.loading ? (
            <Spinner />
          ) : dashboard.error ? (
            <ErrorState message={dashboard.error} retry={dashboard.reload} />
          ) : (
            <>
              <div className="stat-grid">
                {[
                  {
                    label: 'Gross booking value',
                    value: money(stats.revenue),
                    icon: IndianRupee,
                    note: 'Paid bookings, before completed refunds',
                  },
                  {
                    label: 'Movies in catalog',
                    value: stats.movieCount,
                    icon: Film,
                    note: `${stats.upcomingShows} upcoming shows`,
                  },
                  {
                    label: 'Cinemas & moviegoers',
                    value: `${stats.theatreCount} / ${stats.userCount}`,
                    icon: Building2,
                    note: 'Active cinemas / active accounts',
                  },
                  {
                    label: 'Tickets booked',
                    value: stats.tickets,
                    icon: Ticket,
                    note: 'Seats paid for, before cancellations',
                  },
                ].map(({ label, value, icon: Icon, note }) => (
                  <article className="stat-card" key={label}>
                    <span>
                      <Icon size={21} />
                    </span>
                    <small>{label}</small>
                    <strong>{value}</strong>
                    <p>{note}</p>
                  </article>
                ))}
              </div>
              <div className="admin-overview-grid">
                <section className="admin-panel">
                  <h3>Booking activity</h3>
                  {stats.statusCounts.map((s) => (
                    <div className="status-stat" key={s._id}>
                      <BookingStatus status={s._id} />
                      <strong>{s.count}</strong>
                    </div>
                  ))}
                </section>
                <section className="admin-panel">
                  <h3>A good show starts here</h3>
                  <p>
                    Manage your catalog, create a cinema, and schedule shows without overlapping
                    screenings.
                  </p>
                  <div className="admin-quick-actions">
                    {tabs.slice(1, 4).map((t) => (
                      <button
                        key={t.key}
                        onClick={() => {
                          setTab(t.key);
                          setPage(1);
                        }}
                      >
                        <t.icon size={18} />
                        Manage {t.label.toLowerCase()}
                        <ArrowUpRight size={16} />
                      </button>
                    ))}
                  </div>
                </section>
              </div>
              <section className="admin-panel">
                <h3>Latest bookings</h3>
                <div className="table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Movie & moviegoer</th>
                        <th>Reference</th>
                        <th>Seats</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentBookings.map((b) => (
                        <tr key={b._id}>
                          <td>
                            <strong>{b.movieTitle}</strong>
                            <small>{b.user?.name}</small>
                          </td>
                          <td>
                            <Link to={`/bookings/${b._id}`}>{b.reference}</Link>
                          </td>
                          <td>{b.seats.map((s) => s.seatId).join(', ')}</td>
                          <td>{money(b.amount.total)}</td>
                          <td>
                            <BookingStatus status={b.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )
        ) : resources.loading ? (
          <Spinner />
        ) : resources.error ? (
          <ErrorState message={resources.error} retry={resources.reload} />
        ) : (
          <section className="admin-panel resource-panel">
            <div className="resource-panel-heading">
              <h3>
                {resources.data?.pagination?.total || 0} {tab === 'theatres' ? 'cinemas' : tab}
              </h3>
              <span>Server-validated. Safely managed.</span>
            </div>
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    {tab === 'movies' ? (
                      <>
                        <th>Movie</th>
                        <th>Language & format</th>
                        <th>Runtime</th>
                        <th>Listing</th>
                      </>
                    ) : tab === 'theatres' ? (
                      <>
                        <th>Cinema</th>
                        <th>City</th>
                        <th>Screens</th>
                        <th>Status</th>
                      </>
                    ) : tab === 'shows' ? (
                      <>
                        <th>Movie & cinema</th>
                        <th>Show time · IST</th>
                        <th>Screen</th>
                        <th>Status</th>
                      </>
                    ) : (
                      <>
                        <th>Booking</th>
                        <th>Moviegoer</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </>
                    )}
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {resources.data?.items.map((item) => (
                    <tr key={item._id}>
                      {tab === 'movies' ? (
                        <>
                          <td>
                            <div className="table-movie">
                              <img src={item.poster} alt="" />
                              <div>
                                <strong>{item.title}</strong>
                                <small>{item.genres.join(' · ')}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            {item.languages.join(', ')}
                            <small>{item.formats.join(' · ')}</small>
                          </td>
                          <td>{item.duration} min</td>
                          <td>
                            <span className={`listing-badge ${item.status}`}>
                              {item.status.replace('_', ' ')}
                            </span>
                          </td>
                        </>
                      ) : tab === 'theatres' ? (
                        <>
                          <td>
                            <strong>{item.name}</strong>
                            <small>{item.address}</small>
                          </td>
                          <td>{item.city}</td>
                          <td>
                            {item.screens.length} screens
                            <small>
                              {item.screens.reduce((sum, s) => sum + s.rows * s.columns, 0)} seats
                            </small>
                          </td>
                          <td>{item.active ? 'Active' : 'Inactive'}</td>
                        </>
                      ) : tab === 'shows' ? (
                        <>
                          <td>
                            <strong>{item.movie?.title}</strong>
                            <small>{item.theatre?.name}</small>
                          </td>
                          <td>
                            {dateLabel(item.startsAt)} · {timeLabel(item.startsAt)}
                            <small>
                              {item.language} · {item.format}
                            </small>
                          </td>
                          <td>
                            {item.screenName}
                            <small>From {money(item.basePrice)}</small>
                          </td>
                          <td>{item.status}</td>
                        </>
                      ) : (
                        <>
                          <td>
                            <strong>{item.movieTitle}</strong>
                            <small>
                              {item.reference} · {item.seats.map((s) => s.seatId).join(', ')}
                            </small>
                          </td>
                          <td>
                            {item.user?.name}
                            <small>{item.user?.email}</small>
                          </td>
                          <td>
                            {money(item.amount.total)}
                            <small>{item.paymentStatus}</small>
                          </td>
                          <td>
                            <BookingStatus status={item.status} />
                          </td>
                        </>
                      )}
                      <td>
                        <div className="table-actions">
                          {tab === 'bookings' ? (
                            <>
                              <Link
                                className="icon-button"
                                to={`/bookings/${item._id}`}
                                aria-label="View booking"
                              >
                                <ArrowUpRight size={17} />
                              </Link>
                              {item.status === 'confirmed' && (
                                <button
                                  className="icon-button"
                                  onClick={() => cancel(item)}
                                  aria-label="Cancel and refund booking"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                              {['refund_failed', 'refund_pending'].includes(item.paymentStatus) && (
                                <button
                                  className="icon-button"
                                  onClick={() => retry(item)}
                                  aria-label="Retry refund"
                                >
                                  <RefreshCw size={16} />
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <button
                                className="icon-button"
                                onClick={() => setEditing({ type: tab, item })}
                                aria-label={`Edit ${item.title || item.name || item.screenName}`}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                className="icon-button danger-icon"
                                onClick={() => setDeleting({ type: tab, item })}
                                aria-label={`Delete ${item.title || item.name || item.screenName}`}
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!resources.data?.items.length && (
              <EmptyState title="A blank slate" message="Add your first record to get started." />
            )}
            <Pagination value={resources.data?.pagination} onChange={setPage} />
          </section>
        )}
      </div>
      {editing && (
        <EntityEditor
          editor={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {deleting && (
        <Modal
          title={
            deleting.cancel ? 'Cancel and refund this booking?' : 'Remove from active listings?'
          }
          onClose={() => !busy && setDeleting(null)}
        >
          <p>
            {deleting.cancel
              ? `This will release the seats for ${deleting.item.movieTitle} and initiate a full refund, even within 2 hours of showtime.`
              : `“${deleting.item.title || deleting.item.name || deleting.item.movie?.title}” will be removed from active listings. Records with active bookings are protected and cannot be deleted.`}
          </p>
          <div className="modal-actions">
            <button className="btn btn-outline" disabled={busy} onClick={() => setDeleting(null)}>
              Keep it
            </button>
            <button
              className="btn btn-danger"
              disabled={busy}
              onClick={deleting.cancel ? cancelConfirm : remove}
            >
              {busy ? 'Working…' : deleting.cancel ? 'Cancel & refund' : 'Confirm removal'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function EntityEditor({ editor, onClose, onSaved }) {
  const { type, item } = editor;
  const movies = useApi('/admin/movies?limit=50');
  const theatres = useApi('/admin/theatres');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(() => {
    if (type === 'movies')
      return {
        title: item?.title || '',
        description: item?.description || '',
        poster: item?.poster || '',
        backdrop: item?.backdrop || '',
        genres: item?.genres?.join(', ') || 'Drama',
        languages: item?.languages?.join(', ') || 'English',
        duration: item?.duration || 120,
        rating: item?.rating || 8,
        certificate: item?.certificate || 'UA',
        releaseDate: item?.releaseDate?.slice(0, 10) || todayIST(),
        director: item?.director || '',
        cast: item?.cast?.join(', ') || '',
        status: item?.status || 'now_showing',
        featured: item?.featured || false,
        formats: item?.formats || ['2D'],
      };
    if (type === 'theatres')
      return {
        name: item?.name || '',
        city: item?.city || 'Mumbai',
        address: item?.address || '',
        amenities: item?.amenities?.join(', ') || 'Dolby Atmos, Food & drinks',
        longitude: item?.location?.coordinates[0] ?? 72.8777,
        latitude: item?.location?.coordinates[1] ?? 19.076,
        active: item?.active ?? true,
        screens: item?.screens.map((s) => ({
          id: String(s._id),
          name: s.name,
          rows: s.rows,
          columns: s.columns,
          aisleAfter: s.aisleAfter,
          premiumFrom: s.premiumFrom,
        })) || [
          {
            name: 'Screen 1',
            rows: 8,
            columns: 12,
            aisleAfter: 6,
            premiumFrom: 6,
          },
        ],
      };
    return {
      movie: item?.movie?._id || item?.movie || '',
      theatre: item?.theatre?._id || item?.theatre || '',
      screen: item?.screen || '',
      startsAt: item
        ? new Date(new Date(item.startsAt).getTime() + 5.5 * 3600000).toISOString().slice(0, 16)
        : `${todayIST()}T19:00`,
      basePrice: (item?.basePrice || 22000) / 100,
      premiumPrice: (item?.premiumPrice || 35000) / 100,
      format: item?.format || '2D',
      language: item?.language || 'English',
    };
  });
  const field = (name, value) => setForm((f) => ({ ...f, [name]: value }));
  const input = (name, label, props = {}) => (
    <label className="field-label">
      {label}
      <input
        className="form-control"
        value={form[name]}
        onChange={(e) => field(name, e.target.value)}
        {...props}
      />
    </label>
  );
  const theatre = theatres.data?.items.find((t) => t._id === form.theatre);
  const upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Choose an image smaller than 5 MB.');
      return;
    }
    setBusy(true);
    const body = new FormData();
    body.append('image', file);
    try {
      const result = await api.post('/admin/uploads', body);
      field('poster', result.data.url);
      toast.success('Poster uploaded.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    let payload = { ...form };
    if (type === 'movies')
      payload = {
        ...form,
        genres: list(form.genres),
        languages: list(form.languages),
        cast: list(form.cast),
        duration: Number(form.duration),
        rating: Number(form.rating),
        releaseDate: new Date(`${form.releaseDate}T00:00:00+05:30`).toISOString(),
      };
    if (type === 'theatres')
      payload = {
        ...form,
        amenities: list(form.amenities),
        screens: form.screens.map((s) => ({
          ...s,
          rows: Number(s.rows),
          columns: Number(s.columns),
          aisleAfter: Number(s.aisleAfter),
          premiumFrom: Number(s.premiumFrom),
        })),
      };
    if (type === 'shows')
      payload = {
        ...form,
        startsAt: new Date(`${form.startsAt}:00+05:30`).toISOString(),
        basePrice: Math.round(Number(form.basePrice) * 100),
        premiumPrice: Math.round(Number(form.premiumPrice) * 100),
      };
    try {
      if (item) await api.put(`/admin/${type}/${item._id}`, payload);
      else await api.post(`/admin/${type}`, payload);
      toast.success(
        `${type === 'theatres' ? 'Cinema' : type === 'movies' ? 'Movie' : 'Show'} saved.`,
      );
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      wide
      title={`${item ? 'Edit' : 'Add'} ${type === 'theatres' ? 'cinema' : type === 'movies' ? 'movie' : 'show'}`}
      onClose={() => !busy && onClose()}
    >
      <form onSubmit={submit} className="entity-form">
        {type === 'movies' && (
          <>
            <div className="form-grid">
              {input('title', 'Movie title', {
                required: true,
                maxLength: 150,
              })}
              {input('director', 'Director', { maxLength: 150 })}
            </div>
            <label className="field-label">
              Synopsis
              <textarea
                className="form-control"
                rows={3}
                minLength={10}
                maxLength={4000}
                required
                value={form.description}
                onChange={(e) => field('description', e.target.value)}
              />
            </label>
            <div className="form-grid">
              {input('genres', 'Genres (comma-separated)', { required: true })}
              {input('languages', 'Languages (comma-separated)', {
                required: true,
              })}
            </div>
            <div className="form-grid">
              {input('duration', 'Runtime (minutes)', {
                type: 'number',
                min: 1,
                max: 600,
                required: true,
              })}
              {input('rating', 'Demo rating (0–10)', {
                type: 'number',
                min: 0,
                max: 10,
                step: 0.1,
                required: true,
              })}
            </div>
            <div className="form-grid">
              <label className="field-label">
                Certificate
                <select
                  className="form-select"
                  value={form.certificate}
                  onChange={(e) => field('certificate', e.target.value)}
                >
                  <option>U</option>
                  <option>UA</option>
                  <option>A</option>
                </select>
              </label>
              {input('releaseDate', 'Release date', {
                type: 'date',
                required: true,
              })}
            </div>
            <div className="form-grid">
              <label className="field-label">
                Listing status
                <select
                  className="form-select"
                  value={form.status}
                  onChange={(e) => field('status', e.target.value)}
                >
                  <option value="now_showing">Now showing</option>
                  <option value="upcoming">Coming soon</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="field-label">
                Formats
                <select
                  className="form-select"
                  multiple
                  value={form.formats}
                  onChange={(e) =>
                    field(
                      'formats',
                      Array.from(e.target.selectedOptions).map((o) => o.value),
                    )
                  }
                >
                  <option>2D</option>
                  <option>IMAX</option>
                  <option>4DX</option>
                </select>
                <small>Ctrl / Cmd-click to select multiple.</small>
              </label>
            </div>
            {input('cast', 'Cast (comma-separated)')}
            {input('poster', 'Poster URL or uploaded image path', {
              required: true,
            })}
            <div className="poster-upload">
              <label className="btn btn-outline">
                <Upload size={16} />
                Upload poster
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={upload}
                  hidden
                />
              </label>
              {form.poster && <img src={form.poster} alt="Poster preview" />}
              <span>JPEG, PNG, or WebP · Up to 5 MB</span>
            </div>
            {input('backdrop', 'Backdrop image URL (optional)')}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => field('featured', e.target.checked)}
              />
              Feature this movie in discovery
            </label>
          </>
        )}
        {type === 'theatres' && (
          <>
            {input('name', 'Cinema name', { required: true })}
            <div className="form-grid">
              {input('city', 'City', { required: true })}
              {input('amenities', 'Amenities (comma-separated)')}
            </div>
            {input('address', 'Full address', { required: true })}
            <div className="form-grid">
              {input('longitude', 'Longitude', {
                type: 'number',
                step: 'any',
                min: -180,
                max: 180,
              })}
              {input('latitude', 'Latitude', {
                type: 'number',
                step: 'any',
                min: -90,
                max: 90,
              })}
            </div>
            <div className="screen-editor-heading">
              <h3>Screen layouts</h3>
              <button
                type="button"
                className="text-button"
                disabled={form.screens.length >= 8}
                onClick={() =>
                  field('screens', [
                    ...form.screens,
                    {
                      name: `Screen ${form.screens.length + 1}`,
                      rows: 8,
                      columns: 12,
                      aisleAfter: 6,
                      premiumFrom: 6,
                    },
                  ])
                }
              >
                <Plus size={15} />
                Add screen
              </button>
            </div>
            {form.screens.map((screen, i) => (
              <div className="screen-editor" key={screen.id || i}>
                <div className="screen-editor-top">
                  <input
                    className="form-control"
                    aria-label={`Screen ${i + 1} name`}
                    required
                    value={screen.name}
                    onChange={(e) =>
                      field(
                        'screens',
                        form.screens.map((s, j) => (j === i ? { ...s, name: e.target.value } : s)),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Remove screen"
                    disabled={form.screens.length === 1}
                    onClick={() =>
                      field(
                        'screens',
                        form.screens.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="screen-fields">
                  {[
                    ['rows', 'Rows'],
                    ['columns', 'Seats per row'],
                    ['aisleAfter', 'Aisle after seat'],
                    ['premiumFrom', 'Premium from row'],
                  ].map(([key, label]) => (
                    <label className="field-label" key={key}>
                      {label}
                      <input
                        className="form-control"
                        type="number"
                        required
                        min={key === 'rows' || key === 'columns' ? 3 : 1}
                        max={key === 'columns' ? 18 : 15}
                        value={screen[key]}
                        onChange={(e) =>
                          field(
                            'screens',
                            form.screens.map((s, j) =>
                              j === i ? { ...s, [key]: e.target.value } : s,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <p className="muted">
              Existing screen dimensions cannot change while future shows are scheduled.
            </p>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => field('active', e.target.checked)}
              />
              Cinema is active
            </label>
          </>
        )}
        {type === 'shows' && (
          <>
            <label className="field-label">
              Movie
              <select
                className="form-select"
                required
                value={form.movie}
                onChange={(e) => field('movie', e.target.value)}
              >
                <option value="">Choose a movie</option>
                {movies.data?.items
                  .filter((m) => m.status !== 'archived')
                  .map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.title}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field-label">
              Cinema
              <select
                className="form-select"
                required
                value={form.theatre}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    theatre: e.target.value,
                    screen: '',
                  }))
                }
              >
                <option value="">Choose a cinema</option>
                {theatres.data?.items
                  .filter((t) => t.active)
                  .map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} · {t.city}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field-label">
              Screen
              <select
                className="form-select"
                required
                value={form.screen}
                onChange={(e) => field('screen', e.target.value)}
              >
                <option value="">Choose a screen</option>
                {theatre?.screens.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} · {s.rows * s.columns} seats
                  </option>
                ))}
              </select>
            </label>
            {input('startsAt', 'Start time (Indian Standard Time)', {
              type: 'datetime-local',
              required: true,
            })}
            <div className="form-grid">
              {input('basePrice', 'Standard seat price (₹)', {
                type: 'number',
                min: 1,
                max: 10000,
                step: 0.01,
                required: true,
              })}
              {input('premiumPrice', 'Premium seat price (₹)', {
                type: 'number',
                min: 1,
                max: 10000,
                step: 0.01,
                required: true,
              })}
            </div>
            <div className="form-grid">
              {input('language', 'Language', { required: true })}
              <label className="field-label">
                Format
                <select
                  className="form-select"
                  value={form.format}
                  onChange={(e) => field('format', e.target.value)}
                >
                  <option>2D</option>
                  <option>IMAX</option>
                  <option>4DX</option>
                </select>
              </label>
            </div>
            <div className="alert alert-light">
              A 20-minute cleaning break is included automatically. Overlapping screenings and edits
              to shows with active bookings are prevented.
            </div>
          </>
        )}
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            <Check size={17} />
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
