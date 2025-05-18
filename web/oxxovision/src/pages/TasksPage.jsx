import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  obtenerTienda,
  obtenerEmpleadosTienda
} from '../firebase';
import { getAuth } from 'firebase/auth';
import SolicitudesFotos from '../components/SolicitudesFotos';
import Sidebar from '../components/Sidebar';
import './TasksPage.css';

const PlanogramasPage = () => {
  const { tiendaId } = useParams();
  const navigate = useNavigate();
  const [tienda, setTienda] = useState(null);
  const [empleados, setEmpleados] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(localStorage.getItem('oxxoUserRole') || 'usuario');

  // Función para cargar datos
  const cargarDatos = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Obtener datos de la tienda
      const tiendaData = await obtenerTienda(tiendaId);
      if (!tiendaData) {
        throw new Error('No se encontró la tienda');
      }
      setTienda(tiendaData);
      
      // Cargar empleados
      const empleadosData = await obtenerEmpleadosTienda(tiendaId);
      setEmpleados(empleadosData);
      
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setError('Error al cargar datos: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar datos de la tienda y verificar permisos
  useEffect(() => {
    // Intentar obtener usuario actual de Firebase Auth
    const auth = getAuth();
    const firebaseUser = auth.currentUser;
    
    // Crear objeto de usuario aunque no haya sesión en Firebase
    const userObj = firebaseUser ? {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      nombre: firebaseUser.displayName || localStorage.getItem('oxxoUserName')
    } : {
      // Usar datos de localStorage como fallback
      uid: localStorage.getItem('oxxoUserId') || 'unknown_user',
      email: 'usuario@oxxo.com',
      nombre: localStorage.getItem('oxxoUserName') || 'Usuario'
    };
    
    // Siempre debería haber un objeto de usuario, incluso si no hay sesión
    console.log('Usuario actual:', userObj);
    setCurrentUser(userObj);
    
    // También asegurar que tenemos el rol
    const storedRole = localStorage.getItem('oxxoUserRole');
    if (storedRole) {
      setUserRole(storedRole);
      console.log('Rol del usuario:', storedRole);
    }
    
    cargarDatos();
  }, [tiendaId]);

  // Verificar si el usuario tiene permisos para acceder
  useEffect(() => {
    if (!isLoading && currentUser && tienda) {
      // Depuración para ver qué valores están presentes
      console.log('Verificando permisos para:', currentUser.uid);
      console.log('Rol del usuario:', userRole);
      console.log('Datos de tienda:', tienda);
      
      // Roles que siempre tienen acceso a todas las tiendas
      const rolesPrivilegiados = ['admin', 'supervisor'];
      const isPrivilegedRole = rolesPrivilegiados.includes(userRole);
      console.log('¿Tiene rol privilegiado?', isPrivilegedRole);
      
      // Verificar si es gerente de forma segura
      let isGerente = false;
      if (tienda.gerente) {
        isGerente = tienda.gerente.id === currentUser.uid || tienda.creadoPor === currentUser.uid;
        console.log('Es gerente:', isGerente);
      }
      
      // Verificar si es empleado de forma más segura
      let isEmpleado = false;
      if (tienda.empleados && Array.isArray(tienda.empleados)) {
        isEmpleado = tienda.empleados.some(emp => emp && emp.id === currentUser.uid);
        console.log('Es empleado:', isEmpleado);
      }
      
      // Si la tienda no tiene empleados configurados, permitir a cualquier usuario con credenciales
      const hasAccess = isPrivilegedRole || isGerente || isEmpleado || !tienda.empleados || tienda.empleados.length === 0;
      console.log('¿Tiene acceso?', hasAccess);
      
      if (!hasAccess) {
        console.log('Redirigiendo por falta de permisos');
        // Redirigir si no tiene permisos
        navigate('/dashboard');
      }
    }
  }, [currentUser, tienda, isLoading, navigate, userRole]);

  // Renderizar pantalla de carga
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Cargando datos...</p>
      </div>
    );
  }

  // Renderizar mensaje de error
  if (error) {
    return (
      <div className="error-container">
        <span className="material-icons">error</span>
        <h3>Error</h3>
        <p>{error}</p>
        <button onClick={() => navigate('/dashboard')}>Volver al Dashboard</button>
      </div>
    );
  }

  // Verificar si el usuario es admin o gerente de la tienda
  const esAdmin = ['admin', 'supervisor'].includes(userRole) || 
                (tienda?.gerente && tienda.gerente.id === currentUser?.uid);

  return (
    <div className="layout-container">
      {/* Sidebar */}
      <Sidebar userData={{ 
        nombre: localStorage.getItem('oxxoUserName'),
        rol: userRole
      }} />
      
      <div className="main-content">
        {/* Encabezado */}
        <div className="content-header">
          <h1>Fotos de Planogramas</h1>
          <div className="store-info">
            <h2>{tienda?.nombre || 'Tienda'}</h2>
            <div className="store-details">
              <span className="store-code">{tienda?.codigoTienda}</span>
              <span className="store-address">{tienda?.direccion?.calle}, {tienda?.direccion?.ciudad}</span>
            </div>
          </div>
        </div>
        
        <div className="dashboard-content">
          {/* Contenido principal */}
          <SolicitudesFotos 
            tiendaId={tiendaId}
            esAdmin={esAdmin}
            usuarioActual={currentUser}
          />
        </div>
      </div>
    </div>
  );
};

export default PlanogramasPage;