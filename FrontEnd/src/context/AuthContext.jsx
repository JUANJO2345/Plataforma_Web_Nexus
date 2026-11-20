import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AuthContext } from './AuthStore';

const STORAGE_KEY = 'net_runner_user';

function obtenerUsuarioGuardado() {
  try {
    const savedUser = localStorage.getItem(STORAGE_KEY);
    if (!savedUser) return null;
    const parsed = JSON.parse(savedUser);
    if (!parsed || typeof parsed !== 'object' || !parsed.token) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(obtenerUsuarioGuardado);
  const [loading, setLoading] = useState(() => Boolean(obtenerUsuarioGuardado()?.token));
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    userRef.current = null;
    setUser(null);
  }, []);

  const actualizarToken = useCallback((nuevoToken, datosExtra = {}) => {
    if (!nuevoToken) return null;
    const actual = userRef.current || obtenerUsuarioGuardado() || {};
    const actualizado = {
      ...actual,
      ...datosExtra,
      token: nuevoToken,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actualizado));
    userRef.current = actualizado;
    setUser(actualizado);
    return actualizado;
  }, []);

  const authFetch = useCallback(async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    const currentUser = userRef.current;
    if (currentUser?.token) {
      headers['Authorization'] = `Bearer ${currentUser.token}`;
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 && userRef.current) {
      logout();
    }
    return res;
  }, [logout]);

  const login = useCallback(async (username, password) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'ACCESS_DENIED: Credenciales inválidas');

    const normalized = {
      ...data,
      username: data.username || data.correo || username,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    userRef.current = normalized;
    setUser(normalized);
    return normalized;
  }, []);

  const register = useCallback(async (username, password) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'REGISTRATION_FAILED: Error en el registro');

    const normalized = {
      ...data,
      username: data.username || data.correo || username,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    userRef.current = normalized;
    setUser(normalized);
    return normalized;
  }, []);

  useEffect(() => {
    const stored = userRef.current || obtenerUsuarioGuardado();
    if (!stored?.token) return undefined;

    let cancelled = false;
    const controller = new AbortController();

    const validarSesion = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${stored.token}` },
          signal: controller.signal,
        });

        if (cancelled) return;

        if (res.status === 401 || res.status === 403) {
          logout();
          return;
        }

        if (res.ok) {
          const profile = await res.json();
          if (cancelled) return;
          const nextUser = {
            ...stored,
            id: profile.id,
            nombre: profile.nombre,
            correo: profile.correo,
            username: profile.username || profile.correo || stored.username,
            rol: profile.rol,
            token: stored.token,
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
          userRef.current = nextUser;
          setUser(nextUser);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('No se pudo verificar la sesión con /api/auth/me:', err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    validarSesion();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [logout]);

  const contextValue = useMemo(
    () => ({ user, login, register, logout, loading, authFetch, actualizarToken }),
    [user, login, register, logout, loading, authFetch, actualizarToken]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
