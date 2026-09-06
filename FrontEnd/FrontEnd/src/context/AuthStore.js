import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');

  const userRol = context.user?.rol || 'estudiante';
  const isAdmin = userRol === 'admin';
  const isProfesor = userRol === 'profesor';
  const isEstudiante = userRol === 'estudiante' || userRol === 'user';
  return { ...context, isAdmin, isProfesor, isEstudiante, userRol };
}
