import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthStore';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading, isAdmin, isProfesor } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center font-mono-label text-primary tracking-widest">
        &gt;&gt; SYNCHRONIZING_CORE_SYSTEMS...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const rol = user.rol || 'estudiante';
    const rolPermitido = allowedRoles.includes(rol) || (allowedRoles.includes('estudiante') && rol === 'user');

    if (!rolPermitido) {
      if (isAdmin) return <Navigate to="/dashboard" replace />;
      if (isProfesor) return <Navigate to="/profesor" replace />;
      return <Navigate to="/estudiante" replace />;
    }
  }

  return children;
}
