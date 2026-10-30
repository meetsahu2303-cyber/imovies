import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Spinner } from './UI';
export default function ProtectedRoute({ admin = false }) {
  const { user, ready } = useSelector((s) => s.auth);
  const location = useLocation();
  if (!ready) return <Spinner />;
  if (!user)
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}
