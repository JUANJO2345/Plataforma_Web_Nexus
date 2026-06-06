import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Comprobar si hay una sesión guardada en el navegador al cargar la app
    const savedUser = localStorage.getItem('net_runner_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    // Aquí hacemos el puente con la API de tu Backend
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'ACCESS_DENIED: Credenciales inválidas');

    // Si el backend responde OK, guardamos el usuario
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
    
    // Auto-login tras registrarse con éxito
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');

  const isAdmin = context.user?.rol === 'admin';
  return { ...context, isAdmin };
}