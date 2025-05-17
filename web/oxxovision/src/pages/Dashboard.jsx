import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, logoutUser, getUserData } from '../firebase';
import Sidebar from '../components/Sidebar';
import MisTiendas from '../components/MisTiendas';
import './Dashboard.css';

const Dashboard = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Simplificado - solo cargar datos una vez al iniciar
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setLoading(true);
        
        // Usar la información de Firebase directamente si está disponible
        const user = auth.currentUser;
        
        // Si no hay usuario autenticado, obtener del localStorage
        if (!user) {
          console.log('No hay usuario autenticado en Firebase, verificando localStorage');
          
          // Si tampoco hay sesión en localStorage, vamos al login
          const sessionToken = localStorage.getItem('oxxoSessionToken');
          if (!sessionToken) {
            console.log('No hay sesión en localStorage, redirigiendo a login');
            navigate('/login');
            return;
          }
          
          // Hay sesión en localStorage, continuamos con los datos en localStorage
          console.log('Usando datos de sesión del localStorage');
          
          // Intentar cargar los datos del usuario de localStorage
          const userRole = localStorage.getItem('oxxoUserRole') || 'usuario';
          const userName = localStorage.getItem('oxxoUserName') || 'Usuario';
          const userId = localStorage.getItem('oxxoUserId');
          
          if (userId) {
            // Configurar datos básicos del localStorage
            setUserData({
              uid: userId,
              nombre: userName,
              rol: userRole
            });
          }
        } else {
          // Cargar datos del usuario desde Firestore si hay usuario autenticado
          const userDataFromDB = await getUserData(user.uid);
          if (userDataFromDB) {
            setUserData(userDataFromDB);
            
            // Actualizar localStorage para mantener la sesión
            localStorage.setItem('oxxoSessionToken', 'true');
            localStorage.setItem('oxxoUserId', user.uid);
            localStorage.setItem('oxxoUserRole', userDataFromDB.rol || 'usuario');
            localStorage.setItem('oxxoUserName', userDataFromDB.nombre || 'Usuario');
          } else {
            // Si no hay datos, usar los datos mínimos del usuario de Firebase
            setUserData({
              uid: user.uid,
              email: user.email,
              nombre: user.displayName || 'Usuario',
              rol: 'usuario'
            });
          }
        }
      } catch (err) {
        console.error('Error al cargar datos del usuario:', err);
        setError('Error al cargar los datos del usuario');
      } finally {
        setLoading(false);
      }
    };
    
    loadUserData();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const navigateToRegistroTienda = () => {
    navigate('/registro-tienda');
  };

  const navigateToBusquedaTienda = () => {
    navigate('/busqueda-tienda');
  };

  const navigateToPlanogramas = () => {
    // Pendiente implementar página de planogramas
    console.log('Navegar a planogramas');
    // navigate('/planogramas');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button onClick={handleLogout}>Volver a Iniciar Sesión</button>
      </div>
    );
  }

  // Obtener nombre y rol del usuario
  const userName = userData?.nombre || localStorage.getItem('oxxoUserName') || 'Usuario';
  const userRole = userData?.rol || localStorage.getItem('oxxoUserRole') || 'usuario';
  
  // Verificar si el usuario puede administrar tiendas (admin o gerente)
  const canManageStores = userRole === 'admin' || userRole === 'gerente';

  return (
    <div className="layout-container">
      <Sidebar userData={userData} />
      
      <div className="main-content">
        <header className="content-header">
          <h1>Panel de Control</h1>
          <div className="header-actions">
            <span className="user-header-info">
              {userName} ({userRole})
            </span>
            <button className="logout-button" onClick={handleLogout}>
              <span className="material-icons">logout</span>
              Cerrar Sesión
            </button>
          </div>
        </header>
        
        <div className="dashboard-content">
          <div className="welcome-section">
            <h2>Bienvenido/a, {userName}</h2>
            <p>Sistema de Gestión de Planogramas para tiendas OXXO.</p>
            
            {canManageStores && (
              <div className="main-action-buttons">
                <button className="main-action-button" onClick={navigateToRegistroTienda}>
                  <span className="material-icons">add_business</span>
                  Registrar Nueva Tienda
                </button>
                <button className="main-action-button search-button" onClick={navigateToBusquedaTienda}>
                  <span className="material-icons">search</span>
                  Buscar Tienda
                </button>
              </div>
            )}
          </div>
          
          {/* Sección de Mis Tiendas */}
          <MisTiendas />
          
          <div className="quick-actions">
            <h3>Acciones Rápidas</h3>
            <div className="actions-grid">
              {canManageStores && (
                <div className="action-card highlight" onClick={navigateToRegistroTienda}>
                  <span className="material-icons">store</span>
                  <h4>Registrar Tienda</h4>
                  <p>Dar de alta una nueva tienda OXXO en el sistema</p>
                </div>
              )}
              <div className="action-card highlight" onClick={navigateToBusquedaTienda}>
                <span className="material-icons">store_search</span>
                <h4>Buscar Tienda</h4>
                <p>Buscar y consultar información de tiendas por código</p>
              </div>
              <div className="action-card highlight" onClick={navigateToPlanogramas}>
                <span className="material-icons">dashboard_customize</span>
                <h4>Planogramas</h4>
                <p>Gestionar planogramas de tiendas</p>
              </div>
            </div>
          </div>
          
          {userRole === 'admin' && (
            <div className="admin-section">
              <h3>Administración del Sistema</h3>
              <div className="admin-cards">
                <div className="admin-card">
                  <span className="material-icons">admin_panel_settings</span>
                  <h4>Configuración</h4>
                  <p>Gestionar configuración del sistema</p>
                </div>
                <div className="admin-card">
                  <span className="material-icons">security</span>
                  <h4>Permisos</h4>
                  <p>Administrar roles y permisos</p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Floating action button for quick store registration */}
        {canManageStores && (
          <div className="floating-action-button" onClick={navigateToRegistroTienda}>
            <span className="material-icons">add_business</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard; 