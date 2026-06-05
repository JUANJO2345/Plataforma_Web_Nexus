import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthScreen() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-background flex items-center justify-center p-4 hud-grid relative">
      <div className="fixed inset-0 scanline-overlay opacity-[0.05]"></div>

      <div className="w-full max-w-md border border-primary/40 bg-surface-container-low/80 backdrop-blur-xl p-8 relative shadow-[0_0_30px_rgba(0,220,230,0.15)]">
        {/* Detalle decorativo de esquina */}
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary"></div>
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary"></div>

        <div className="mb-8 text-center">
          <h2 className="font-display text-[28px] text-primary font-bold tracking-tight">
            {isLogin ? 'INITIALIZE_AUTH' : 'CREATE_NEW_OPERATOR'}
          </h2>
          <p className="font-mono-label text-[10px] text-on-surface-variant/60 uppercase mt-1">
            {isLogin ? 'Identificación requerida para el enlace' : 'Registrar nueva firma en la red'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 border border-error/40 bg-error-container/10 font-mono-label text-[11px] text-on-error flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">terminal</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block font-mono-label text-[11px] text-primary uppercase mb-2">User_Name</label>
            <input 
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-surface-container border border-primary/30 px-4 py-3 font-mono-label text-[13px] text-on-surface focus:outline-none focus:border-primary focus:shadow-[0_0_10px_rgba(0,220,230,0.2)] transition-all"
              placeholder="Escriba su operador..."
            />
          </div>

          <div>
            <label className="block font-mono-label text-[11px] text-primary uppercase mb-2">Access_Key</label>
            <input 
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-container border border-primary/30 px-4 py-3 font-mono-label text-[13px] text-on-surface focus:outline-none focus:border-primary focus:shadow-[0_0_10px_rgba(0,220,230,0.2)] transition-all"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-primary text-on-primary font-mono-label font-bold uppercase tracking-widest text-[12px] hover:shadow-[0_0_20px_rgba(0,220,230,0.5)] transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'EXECUTING...' : isLogin ? 'CONNECT_TO_NET' : 'REGISTER_NODE'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(null); }}
            className="font-mono-label text-[11px] text-secondary hover:underline bg-transparent border-none cursor-pointer"
          >
            {isLogin ? '>> Solicitar credenciales de Operador' : '>> Ya tengo un nodo de acceso asignado'}
          </button>
        </div>
      </div>
    </div>
  );
}