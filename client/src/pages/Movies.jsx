import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X, CalendarDays } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useApi, useDebounce } from '../lib/hooks';
import {
  MovieCard,
  MovieSkeletons,
  PageHeading,
  ErrorState,
  EmptyState,
  Pagination,
} from '../components/UI';
import { todayIST } from '../lib/api';
export default function Movies() {
  const [params, setParams] = useSearchParams();
  const city = useSelector((s) => s.ui.city);
  const q = params.get('q') || '';
  const debouncedQ = useDebounce(q);
  const tab = params.get('tab') || 'now_showing';
  const genre = params.get('genre') || '';
  const language = params.get('language') || '';
  const date = params.get('date') || '';
  const theatre = params.get('theatre') || '';
  const sort = params.get('sort') || 'popular';
  const page = Number(params.get('page') || 1);
  const { data: meta } = useApi('/metadata');
  const { data: theatres } = useApi(`/theatres?city=${encodeURIComponent(city)}`);
  const query = new URLSearchParams({
    status: tab,
    sort,
    page: String(page),
    limit: '12',
    ...(debouncedQ ? { q: debouncedQ } : {}),
    ...(genre ? { genre } : {}),
    ...(language ? { language } : {}),
    ...(date ? { date, city } : {}),
    ...(theatre ? { theatre } : {}),
  });
  const { data, loading, error, reload } = useApi(`/movies?${query}`);
  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  const hasFilters = q || genre || language || date || theatre;
  return (
    <div className="container page-space">
      <PageHeading
        eyebrow="A WORLD OF STORIES"
        title={tab === 'upcoming' ? 'Good things are coming.' : 'Find your next favorite.'}
        description={
          tab === 'upcoming'
            ? 'Get a first look at the films worth making plans for.'
            : 'Big blockbusters, quiet gems, and everything in between.'
        }
      />
      <div className="catalog-search">
        <Search size={21} />
        <input
          aria-label="Search movies"
          placeholder="Search movies, directors, and stories…"
          value={q}
          onChange={(e) => update('q', e.target.value)}
        />
        {q && (
          <button className="icon-button" onClick={() => update('q', '')} aria-label="Clear search">
            <X size={18} />
          </button>
        )}
        <span className="search-key">SEARCH</span>
      </div>
      <div className="catalog-layout">
        <aside className="filter-panel">
          <div className="filter-heading">
            <SlidersHorizontal size={17} />
            <strong>Make it your kind of movie</strong>
          </div>
          <label className="field-label">
            Genre
            <select
              className="form-select"
              value={genre}
              onChange={(e) => update('genre', e.target.value)}
            >
              <option value="">All genres</option>
              {meta?.genres.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Language
            <select
              className="form-select"
              value={language}
              onChange={(e) => update('language', e.target.value)}
            >
              <option value="">All languages</option>
              {meta?.languages.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Cinema in {city}
            <select
              className="form-select"
              value={theatre}
              onChange={(e) => update('theatre', e.target.value)}
            >
              <option value="">All cinemas</option>
              {theatres?.items.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Show date
            <input
              className="form-control"
              type="date"
              min={todayIST()}
              value={date}
              onChange={(e) => update('date', e.target.value)}
            />
          </label>
          <p className="filter-note">
            Change your city in the navigation bar to explore cinemas near you.
          </p>
          {hasFilters && (
            <button className="text-button red-text" onClick={() => setParams({ tab })}>
              <X size={15} />
              Clear filters
            </button>
          )}
        </aside>
        <div className="catalog-results">
          <div className="catalog-toolbar">
            <div className="pill-tabs">
              <button
                className={tab === 'now_showing' ? 'active' : ''}
                onClick={() => update('tab', 'now_showing')}
              >
                Now showing
              </button>
              <button
                className={tab === 'upcoming' ? 'active' : ''}
                onClick={() => update('tab', 'upcoming')}
              >
                Coming soon
              </button>
            </div>
            <div className="result-sort">
              <span>{data?.pagination?.total ?? '…'} films</span>
              <select
                aria-label="Sort movies"
                value={sort}
                onChange={(e) => update('sort', e.target.value)}
              >
                <option value="popular">Top rated</option>
                <option value="release">Latest release</option>
                <option value="title">Title A–Z</option>
              </select>
            </div>
          </div>
          {hasFilters && (
            <div className="active-filters">
              {[
                ['q', q],
                ['genre', genre],
                ['language', language],
                ['date', date],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <button key={k} onClick={() => update(k, '')}>
                    {v}
                    <X size={12} />
                  </button>
                ))}
            </div>
          )}
          <div className="movie-grid catalog-grid">
            {loading ? (
              <MovieSkeletons count={6} />
            ) : error ? (
              <div className="grid-full">
                <ErrorState message={error} retry={reload} />
              </div>
            ) : (
              data?.items.map((m, i) => <MovieCard key={m._id} movie={m} index={i} />)
            )}
          </div>
          {!loading && !error && !data?.items.length && (
            <EmptyState
              title="No matching movies"
              message="Try a different genre, date, or cinema. Your next favorite is out there."
            />
          )}
          <Pagination value={data?.pagination} onChange={(p) => update('page', String(p))} />
        </div>
      </div>
    </div>
  );
}
