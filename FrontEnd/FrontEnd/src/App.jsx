import React, { useState, useEffect } from 'react';
import MatchHistory from './components/MatchHistory';
import DashboardHome from './components/DashboardHome';
import UserDashboard from './components/UserDashboard';
import UserManagement from './components/UserManagement';
import AuthScreen from './components/AuthScreen';
import { AuthProvider, useAuth } from './context/AuthContext';

function DashboardContainer() {
  const { user, logout, loading, isAdmin } = useAuth();
  
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (!isAdmin && activeTab !== 'dashboard') {
      setActiveTab('dashboard');
    }
  }, [isAdmin, activeTab]);

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

  return (
    <div className="bg-background text-on-background font-body selection:bg-primary-container selection:text-on-primary-container overflow-hidden h-screen w-full relative">
      <div className="fixed inset-0 scanline-overlay opacity-[0.05]"></div>
      
      <div className="flex h-screen w-full relative z-10">
        
        {/* Barra Lateral (SideNavBar) */}
        <aside className="h-screen w-64 fixed left-0 top-0 bg-surface/80 backdrop-blur-xl border-r border-primary/30 shadow-[0_0_15px_rgba(0,220,230,0.1)] flex flex-col py-4 z-50">
          <div className="px-6 py-10">
            <h1 className="font-display text-[32px] text-primary tracking-tighter font-bold">NET_RUNNER</h1>
          </div>
          
          {/* Perfil del Operador */}
          <div className="px-6 mb-10 flex flex-col items-center">
            <div className="w-16 h-16 rounded-sm border border-primary/50 p-1 mb-2">
              <div className="w-full h-full bg-surface-container-highest flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[32px]">account_circle</span>
              </div>
            </div>
            <div className="text-center">
              <div className="font-mono-label text-primary font-bold uppercase truncate max-w-[200px]">
                {user.username.split('@')[0]}
              </div>
              <div className="font-mono-label text-on-surface-variant text-[10px] uppercase opacity-60">
                Rol: {isAdmin ? 'Admin' : 'Operador'}
              </div>
            </div>
          </div>
          
          {/* Navegación Principal */}
          <nav className="flex-1 space-y-1 px-4">
            
            {/* Dashboard */}
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 font-mono-label text-[12px] transition-all duration-200 text-left cursor-pointer ${
                activeTab === 'dashboard' 
                  ? 'text-primary font-bold border-l-4 border-primary bg-primary/10 shadow-[inset_4px_0_0_rgba(0,220,230,0.2)]' 
                  : 'text-on-surface-variant font-medium hover:bg-primary/5 hover:text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">dashboard</span> Dashboard
            </button>
            
            {isAdmin && (
              <>
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
                  <span className="material-symbols-outlined text-[20px]">group</span> User Management
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

        {/* Área de Contenido Principal (Main) */}
        <main className="ml-64 flex-1 flex flex-col h-screen hud-grid">
          
          {/* Barra Superior */}
          <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-primary/30 shadow-[0_0_20px_rgba(0,220,230,0.2)] flex justify-between items-center w-full px-6 h-16">
            <div className="flex items-center gap-8">
              <span className="font-display text-[24px] text-primary italic font-bold">NET_RUNNER_OS</span>
            </div>
            <div className="flex items-center gap-6">
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
                <span className="w-2 h-2 bg-primary animate-pulse"></span> SYSTEM_CORE_ACCESS
              </div>
              <h2 className="font-display text-[32px] text-primary uppercase font-bold">
                {activeTab === 'dashboard' && (isAdmin ? 'OVERVIEW_DASHBOARD' : 'MY_TELEMETRY')}
                {activeTab === 'history' && 'MATCH_HISTORY'}
                {activeTab === 'users' && 'OPERATOR_MANAGEMENT'}
              </h2>
            </div>

            {activeTab === 'dashboard' && (isAdmin ? <DashboardHome /> : <UserDashboard />)}
            {isAdmin && activeTab === 'history' && <MatchHistory />}
            {isAdmin && activeTab === 'users' && <UserManagement />}

          </section>
        </main>

      </div>
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