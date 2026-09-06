import { useState } from 'react';
import MatchHistory from './components/MatchHistory';
import DashboardHome from './components/DashboardHome';
import UserManagement from './components/UserManagement';
import GroupManagement from './components/GroupManagement';
import ProfesorDashboard from './components/ProfesorDashboard';
import EstudianteDashboard from './components/EstudianteDashboard';
import QueryLookupModal from './components/QueryLookupModal';
import AuthScreen from './components/AuthScreen';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthStore';

function DashboardContainer() {
  const { user, logout, loading, isAdmin, isProfesor, isEstudiante } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLookupOpen, setIsLookupOpen] = useState(false);

  if (loading) {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center font-mono-label text-primary tracking-widest">
        &gt;&gt; SYNCHRONIZING_CORE_SYSTEMS...
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const getTabLabel = () => {
    if (isEstudiante) return 'ESTUDIANTE_DASHBOARD';
    if (isProfesor) return 'PROFESOR_DASHBOARD';
    if (activeTab === 'dashboard') return 'OVERVIEW_DASHBOARD';
    if (activeTab === 'history') return 'MATCH_HISTORY';
    if (activeTab === 'users') return 'GESTION_DE_USUARIOS';
    if (activeTab === 'groups') return 'GESTION_DE_GRUPOS';
    return 'DASHBOARD';
  };

  const roleLabel = isAdmin ? 'Administrador' : isProfesor ? 'Profesor' : 'Estudiante';

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
                {user.username.split('@')[0]}
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
              <button
                onClick={() => setActiveTab('estudiante_grupos')}
                className="w-full flex items-center gap-3 px-4 py-3 font-mono-label text-[12px] text-primary font-bold border-l-4 border-primary bg-primary/10 cursor-pointer shadow-[inset_4px_0_0_rgba(0,220,230,0.2)]"
              >
                <span className="material-symbols-outlined text-[20px]">groups</span> Mis Grupos y Partidas
              </button>
            )}

            {/* VISTA PROFESOR */}
            {isProfesor && (
              <button
                onClick={() => setActiveTab('profesor_grupos')}
                className="w-full flex items-center gap-3 px-4 py-3 font-mono-label text-[12px] text-orange-400 font-bold border-l-4 border-orange-400 bg-orange-400/10 cursor-pointer shadow-[inset_4px_0_0_rgba(251,146,60,0.2)]"
              >
                <span className="material-symbols-outlined text-[20px]">school</span> Grupos & Estudiantes
              </button>
            )}

            {/* VISTA ADMINISTRADOR */}
            {isAdmin && (
              <>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`w-full flex items-center gap-3 px-4 py-3 font-mono-label text-[12px] transition-all duration-200 text-left cursor-pointer ${
                    activeTab === 'dashboard'
                      ? 'text-primary font-bold border-l-4 border-primary bg-primary/10 shadow-[inset_4px_0_0_rgba(0,220,230,0.2)]'
                      : 'text-on-surface-variant font-medium hover:bg-primary/5 hover:text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">dashboard</span> Overview Dashboard
                </button>

                <button
                  onClick={() => setActiveTab('history')}
                  className={`w-full flex items-center gap-3 px-4 py-3 font-mono-label text-[12px] transition-all duration-200 text-left cursor-pointer ${
                    activeTab === 'history'
                      ? 'text-primary font-bold border-l-4 border-primary bg-primary/10 shadow-[inset_4px_0_0_rgba(0,220,230,0.2)]'
                      : 'text-on-surface-variant font-medium hover:bg-primary/5 hover:text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">history</span> Match History
                </button>

                <button
                  onClick={() => setActiveTab('users')}
                  className={`w-full flex items-center gap-3 px-4 py-3 font-mono-label text-[12px] transition-all duration-200 text-left cursor-pointer ${
                    activeTab === 'users'
                      ? 'text-primary font-bold border-l-4 border-primary bg-primary/10 shadow-[inset_4px_0_0_rgba(0,220,230,0.2)]'
                      : 'text-on-surface-variant font-medium hover:bg-primary/5 hover:text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">manage_accounts</span> User Management
                </button>

                <button
                  onClick={() => setActiveTab('groups')}
                  className={`w-full flex items-center gap-3 px-4 py-3 font-mono-label text-[12px] transition-all duration-200 text-left cursor-pointer ${
                    activeTab === 'groups'
                      ? 'text-secondary font-bold border-l-4 border-secondary bg-secondary/10 shadow-[inset_4px_0_0_rgba(166,226,46,0.2)]'
                      : 'text-on-surface-variant font-medium hover:bg-secondary/5 hover:text-secondary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">group_add</span> Gestión de Grupos
                </button>
              </>
            )}
          </nav>

          {isAdmin && (
            <div className="px-6 py-6">
              <button
                onClick={() => setActiveTab('history')}
                className="w-full py-4 bg-primary text-on-primary font-mono-label font-bold uppercase tracking-widest text-[12px] hover:shadow-[0_0_20px_rgba(0,220,230,0.6)] transition-all active:scale-95 duration-100 cursor-pointer text-center"
              >
                NEW_MATCH
              </button>
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
                onClick={() => setIsLookupOpen(true)}
                className="flex items-center gap-2 font-mono-label text-[12px] uppercase text-primary border border-primary/40 px-3 py-1 hover:bg-primary hover:text-black transition-all cursor-pointer shadow-[0_0_10px_rgba(0,220,230,0.2)]"
              >
                <span className="material-symbols-outlined text-[16px]">search</span>
                Consulta Rápida
              </button>

              <button
                onClick={logout}
                className="font-mono-label text-[12px] uppercase text-on-secondary-fixed-variant border border-on-secondary-fixed-variant px-4 py-1 hover:bg-on-secondary-fixed-variant hover:text-white transition-all cursor-pointer"
              >
                Logout
              </button>
            </div>
          </header>

          {/* Canvas Desplazable */}
          <section className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            <div className="mb-2">
              <div className="font-mono-label text-primary text-[14px] mb-1 flex items-center gap-2">
                <span className="w-2 h-2 bg-primary animate-pulse"></span> SYSTEM_CORE_ACCESS :: {roleLabel.toUpperCase()}
              </div>
              <h2 className="font-display text-[32px] text-primary uppercase font-bold">
                {getTabLabel()}
              </h2>
            </div>

            {/* RENDERIZADO CONDICIONAL SEGÚN EL ROL */}
            {isEstudiante && <EstudianteDashboard />}

            {isProfesor && <ProfesorDashboard />}

            {isAdmin && (
              <>
                {activeTab === 'dashboard' && <DashboardHome />}
                {activeTab === 'history' && <MatchHistory />}
                {activeTab === 'users' && <UserManagement />}
                {activeTab === 'groups' && <GroupManagement />}
              </>
            )}
          </section>
        </main>
      </div>

      {/* Modal de Consulta Rápida */}
      <QueryLookupModal isOpen={isLookupOpen} onClose={() => setIsLookupOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DashboardContainer />
    </AuthProvider>
  );
}
