import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MatchHistory from './components/MatchHistory';
import DashboardHome from './components/DashboardHome';
import UserManagement from './components/UserManagement';
import GroupManagement from './components/GroupManagement';
import ProfesorDashboard from './components/ProfesorDashboard';
import EstudianteDashboard from './components/EstudianteDashboard';
import AuthScreen from './components/AuthScreen';
import MainLayout from './components/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthStore';

function RoleRedirect() {
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

  if (isAdmin) return <Navigate to="/dashboard" replace />;
  if (isProfesor) return <Navigate to="/profesor" replace />;
  return <Navigate to="/estudiante" replace />;
}

function PublicAuthRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center font-mono-label text-primary tracking-widest">
        &gt;&gt; SYNCHRONIZING_CORE_SYSTEMS...
      </div>
    );
  }

  if (user) {
    return <RoleRedirect />;
  }

  return <AuthScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Ruta Pública */}
          <Route path="/login" element={<PublicAuthRoute />} />

          {/* Rutas Protegidas en MainLayout */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            {/* Vistas de Administrador */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <DashboardHome />
                </ProtectedRoute>
              }
            />
            <Route
              path="/historial"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <MatchHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/usuarios"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <UserManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/grupos"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <GroupManagement />
                </ProtectedRoute>
              }
            />

            {/* Vista de Profesor */}
            <Route
              path="/profesor"
              element={
                <ProtectedRoute allowedRoles={['profesor', 'admin']}>
                  <ProfesorDashboard />
                </ProtectedRoute>
              }
            />

            {/* Vista de Estudiante */}
            <Route
              path="/estudiante"
              element={
                <ProtectedRoute allowedRoles={['estudiante', 'user', 'admin']}>
                  <EstudianteDashboard />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Redirección por defecto */}
          <Route path="/" element={<RoleRedirect />} />
          <Route path="*" element={<RoleRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
