import { useState } from 'react';
import { AuthContext } from './AuthStore';

function obtenerUsuarioGuardado() {
  try {
    const savedUser = localStorage.getItem('net_runner_user');
    return savedUser ? JSON.parse(savedUser) : null;
  } catch {
    localStorage.removeItem('net_runner_user');
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(obtenerUsuarioGuardado);
  const loading = false;

  const login = async (username, password) => {
    // Puente con la API del backend.
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'ACCESS_DENIED: Credenciales inválidas');

    localStorage.setItem('net_runner_user', JSON.stringify(data));
    setUser(data);
    return data;
  };

  const register = async (username, password) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'REGISTRATION_FAILED: Error en el registro');

    // Auto-login tras registrarse con éxito.
    localStorage.setItem('net_runner_user', JSON.stringify(data));
    setUser(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('net_runner_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
