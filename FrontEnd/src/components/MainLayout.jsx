import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthStore';

export default function MainLayout() {
  const { user, logout, isAdmin, isProfesor, isEstudiante } = useAuth();
  const location = useLocation();

  const getTabLabel = () => {
    const path = location.pathname;
    if (path.startsWith('/estudiante')) return 'ESTUDIANTE_DASHBOARD';
    if (path.startsWith('/profesor')) return 'PROFESOR_DASHBOARD';
    if (path.startsWith('/historial')) return 'MATCH_HISTORY';
    if (path.startsWith('/usuarios')) return 'GESTION_DE_USUARIOS';
    if (path.startsWith('/grupos')) return 'GESTION_DE_GRUPOS';
    if (path.startsWith('/dashboard')) return 'OVERVIEW_DASHBOARD';
    return 'DASHBOARD';
  };

  const roleLabel = isAdmin ? 'Administrador' : isProfesor ? 'Profesor' : 'Estudiante';

  const navLinkClass = (color = 'primary') => ({ isActive }) => {
    const base = 'w-full flex items-center gap-3 px-4 py-3 font-mono-label text-[12px] transition-all duration-200 text-left cursor-pointer ';
    if (color === 'orange') {
      return base + (isActive
        ? 'text-orange-400 font-bold border-l-4 border-orange-400 bg-orange-400/10 shadow-[inset_4px_0_0_rgba(251,146,60,0.2)]'
        : 'text-on-surface-variant font-medium hover:bg-orange-400/5 hover:text-orange-400');
    }
    if (color === 'secondary') {
      return base + (isActive
        ? 'text-secondary font-bold border-l-4 border-secondary bg-secondary/10 shadow-[inset_4px_0_0_rgba(166,226,46,0.2)]'
        : 'text-on-surface-variant font-medium hover:bg-secondary/5 hover:text-secondary');
    }
    return base + (isActive
      ? 'text-primary font-bold border-l-4 border-primary bg-primary/10 shadow-[inset_4px_0_0_rgba(0,220,230,0.2)]'
      : 'text-on-surface-variant font-medium hover:bg-primary/5 hover:text-primary');
  };

  return (
    <div className="bg-background text-on-background font-body selection:bg-primary-container selection:text-on-primary-container overflow-hidden h-screen w-full relative">
      <div className="fixed inset-0 scanline-overlay opacity-[0.05]"></div>

      <div className="flex h-screen w-full relative z-10">
        {/* Barra Lateral (SideNavBar) */}
        <aside className="h-screen w-64 fixed left-0 top-0 bg-surface/80 backdrop-blur-xl border-r border-primary/30 shadow-[0_0_15px_rgba(0,220,230,0.1)] flex flex-col py-4 z-50">
          <div className="px-6 py-10">
            <h1 className="font-display text-[32px] text-primary tracking-tighter font-bold">NET_RUNNER</h1>
          </div>

          {/* Perfil del Usuario */}
          <div className="px-6 mb-8 flex flex-col items-center">
            <div className="w-16 h-16 rounded-sm border border-primary/50 p-1 mb-2">
              <div className="w-full h-full bg-surface-container-highest flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[32px]">
                  {isAdmin ? 'admin_panel_settings' : isProfesor ? 'school' : 'account_circle'}
                </span>
              </div>
            </div>
            <div className="text-center">
              <div className="font-mono-label text-primary font-bold uppercase truncate max-w-[200px]">
                {user?.username ? user.username.split('@')[0] : 'OPERATOR'}
              </div>
              <div className="font-mono-label text-on-surface-variant text-[10px] uppercase opacity-80 mt-1">
                <span className={`px-2 py-0.5 border ${
                  isAdmin
                    ? 'border-secondary text-secondary'
                    : isProfesor
                    ? 'border-orange-400 text-orange-400'
                    : 'border-primary text-primary'
                }`}>
                  Rol: {roleLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Navegación Principal según Rol */}
          <nav className="flex-1 space-y-1 px-4">
            {/* VISTA ESTUDIANTE */}
            {isEstudiante && (
              <NavLink
                to="/estudiante"
                className={navLinkClass('primary')}
              >
                <span className="material-symbols-outlined text-[20px]">groups</span> Mis Grupos y Partidas
              </NavLink>
            )}

            {/* VISTA PROFESOR */}
            {isProfesor && (
              <NavLink
                to="/profesor"
                className={navLinkClass('orange')}
              >
                <span className="material-symbols-outlined text-[20px]">school</span> Grupos & Estudiantes
              </NavLink>
            )}

            {/* VISTA ADMINISTRADOR */}
            {isAdmin && (
              <>
                <NavLink
                  to="/dashboard"
                  className={navLinkClass('primary')}
                >
                  <span className="material-symbols-outlined text-[20px]">dashboard</span> Overview Dashboard
                </NavLink>

                <NavLink
                  to="/historial"
                  className={navLinkClass('primary')}
                >
                  <span className="material-symbols-outlined text-[20px]">history</span> Match History
                </NavLink>

                <NavLink
                  to="/usuarios"
                  className={navLinkClass('primary')}
                >
                  <span className="material-symbols-outlined text-[20px]">manage_accounts</span> User Management
                </NavLink>

                <NavLink
                  to="/grupos"
                  className={navLinkClass('secondary')}
                >
                  <span className="material-symbols-outlined text-[20px]">group_add</span> Gestión de Grupos
                </NavLink>
              </>
            )}
          </nav>

          {isAdmin && (
            <div className="px-6 py-6">
              <NavLink
                to="/historial"
                className="block w-full py-4 bg-primary text-on-primary font-mono-label font-bold uppercase tracking-widest text-[12px] hover:shadow-[0_0_20px_rgba(0,220,230,0.6)] transition-all active:scale-95 duration-100 cursor-pointer text-center"
              >
                NEW_MATCH
              </NavLink>
            </div>
          )}
        </aside>

        {/* Área de Contenido Principal */}
        <main className="ml-64 flex-1 flex flex-col h-screen hud-grid">
          {/* Barra Superior */}
          <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-primary/30 shadow-[0_0_20px_rgba(0,220,230,0.2)] flex justify-between items-center w-full px-6 h-16">
            <div className="flex items-center gap-8">
              <span className="font-display text-[24px] text-primary italic font-bold">NET_RUNNER_OS</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={logout}
                className="font-mono-label text-[12px] uppercase text-on-secondary-fixed-variant border border-on-secondary-fixed-variant px-4 py-1 hover:bg-on-secondary-fixed-variant hover:text-white transition-all cursor-pointer"
              >
                Logout
              </button>
            </div>
          </header>

          {/* Canvas Desplazable con Outlet */}
          <section className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            <div className="mb-2">
              <div className="font-mono-label text-primary text-[14px] mb-1 flex items-center gap-2">
                <span className="w-2 h-2 bg-primary animate-pulse"></span> SYSTEM_CORE_ACCESS :: {roleLabel.toUpperCase()}
              </div>
              <h2 className="font-display text-[32px] text-primary uppercase font-bold">
                {getTabLabel()}
              </h2>
            </div>

            {/* Contenido dinámico de la ruta activa */}
            <Outlet />
          </section>
        </main>
      </div>
    </div>
  );
}
