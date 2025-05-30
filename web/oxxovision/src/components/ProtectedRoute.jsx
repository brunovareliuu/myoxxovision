import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { auth, getUserData } from '../firebase';

const ProtectedRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const location = useLocation();

  useEffect(() => {
    console.log('ProtectedRoute: Verificando autenticación');
    
    // Verificar si tenemos información de usuario en state (navegación desde otra página)
    const navigationState = location.state || {};
    if (navigationState.usuario && navigationState.usuario.id) {
      console.log('ProtectedRoute: Encontrada información de usuario en estado de navegación:', 
                 navigationState.usuario.nombre || navigationState.usuario.id);
      
      // Guardar datos de sesión manualmente
      localStorage.setItem('oxxoSessionToken', 'true');
      localStorage.setItem('oxxoUserId', navigationState.usuario.id);
      
      if (navigationState.usuario.nombre) {
        localStorage.setItem('oxxoUserName', navigationState.usuario.nombre);
      }
      
      if (navigationState.usuario.esAdmin !== undefined) {
        localStorage.setItem('oxxoUserRole', navigationState.usuario.esAdmin ? 'admin' : 'usuario');
      }
      
      // Considerar al usuario como autenticado
      setAuthenticated(true);
      setLoading(false);
      return;
    }
    
    // Verificar en localStorage primero (para persistencia de sesión)
    const sessionToken = localStorage.getItem('oxxoSessionToken');
    const userId = localStorage.getItem('oxxoUserId');
    
    // Si tenemos token y userId en localStorage, considerar autenticado inmediatamente
    if (sessionToken && userId) {
      console.log('ProtectedRoute: Token encontrado en localStorage, autenticando directamente');
      setAuthenticated(true);
      setLoading(false);
      
      // Intentar verificar con Firebase de forma asíncrona sin bloquear
      setTimeout(async () => {
        try {
          // Intentar obtener datos del usuario para validar que existe
          const userData = await getUserData(userId);
          if (userData) {
            console.log('ProtectedRoute: Usuario validado en Firestore:', userData.nombre);
          } else {
            console.warn('ProtectedRoute: No se encontraron datos de usuario en Firestore, pero manteniendo sesión');
          }
        } catch (error) {
          console.warn('ProtectedRoute: Error al verificar usuario en Firestore:', error);
          // No cerrar sesión a pesar del error
        }
      }, 1000);
      
      return; // No continuar con la verificación de Firebase
    }
    
    // Solo llegar aquí si no hay token en localStorage
    const unsubscribe = auth.onAuthStateChanged((user) => {
      console.log('ProtectedRoute: Firebase Auth cambió, usuario:', user?.uid);
      
      if (user) {
        // Usuario autenticado en Firebase, guardar en localStorage
        localStorage.setItem('oxxoSessionToken', 'true');
        localStorage.setItem('oxxoUserId', user.uid);
        
        // Si no tenemos el rol, intentar obtenerlo
        if (!localStorage.getItem('oxxoUserRole')) {
          setTimeout(async () => {
            try {
              const userData = await getUserData(user.uid);
              if (userData && userData.rol) {
                localStorage.setItem('oxxoUserRole', userData.rol);
                localStorage.setItem('oxxoUserName', userData.nombre || 'Usuario');
                console.log('ProtectedRoute: Rol guardado:', userData.rol);
              }
            } catch (error) {
              console.warn('ProtectedRoute: Error al obtener rol de usuario:', error);
              // Usar rol por defecto
              localStorage.setItem('oxxoUserRole', 'usuario');
            }
          }, 500);
        }
        
        setAuthenticated(true);
      } else {
        // No hay usuario en Firebase y tampoco token en localStorage
        console.log('ProtectedRoute: No hay sesión activa, redirigiendo a login');
        localStorage.removeItem('oxxoSessionToken');
        localStorage.removeItem('oxxoUserId');
        setAuthenticated(false);
      }
      
      setLoading(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [location]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Cargando...</p>
      </div>
    );
  }

  if (!authenticated) {
    console.log('ProtectedRoute: Redirigiendo a login por falta de autenticación');
    // Guardar la ubicación actual para redirigir después del inicio de sesión
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
};

export default ProtectedRoute;
