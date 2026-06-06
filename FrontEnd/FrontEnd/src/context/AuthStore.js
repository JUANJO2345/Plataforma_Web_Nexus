import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');

  const isAdmin = context.user?.rol === 'admin';
  return { ...context, isAdmin };
}
