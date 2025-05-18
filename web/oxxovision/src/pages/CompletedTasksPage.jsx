import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  obtenerTienda, 
  obtenerTareasCompletadas
} from '../firebase';
import { getAuth } from 'firebase/auth';
import TaskDetailViewer from '../components/TaskDetailViewer';
import Sidebar from '../components/Sidebar';
import './TasksPage.css'; // Reusing existing styles

const CompletedTasksPage = () => {
  const { tiendaId } = useParams();
  const navigate = useNavigate();
  const [tienda, setTienda] = useState(null);
  const [tareasCompletadas, setTareasCompletadas] = useState([]);
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
      
      // Cargar tareas completadas
      const tareasCompletadasData = await obtenerTareasCompletadas(tiendaId);
      setTareasCompletadas(tareasCompletadasData);
      
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
      email: firebaseUser.email
    } : {
      // Usar datos de localStorage como fallback
      uid: localStorage.getItem('oxxoUserId') || 'unknown_user',
      email: 'usuario@oxxo.com' // Email genérico como fallback
    };
    
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
      console.log('Verificando permisos para:', currentUser.uid);
      console.log('Rol del usuario:', userRole);
      
      // Roles que siempre tienen acceso a todas las tiendas
      const rolesPrivilegiados = ['admin', 'supervisor'];
      const isPrivilegedRole = rolesPrivilegiados.includes(userRole);
      
      // Verificar si es gerente
      let isGerente = false;
      if (tienda.gerente) {
        isGerente = tienda.gerente.id === currentUser.uid || tienda.creadoPor === currentUser.uid;
      }
      
      // Verificar si es empleado
      let isEmpleado = false;
      if (tienda.empleados && Array.isArray(tienda.empleados)) {
        isEmpleado = tienda.empleados.some(emp => emp && emp.id === currentUser.uid);
      }
      
      // Si la tienda no tiene empleados configurados, permitir a cualquier usuario con credenciales
      const hasAccess = isPrivilegedRole || isGerente || isEmpleado || !tienda.empleados || tienda.empleados.length === 0;
      
      if (!hasAccess) {
        console.log('Redirigiendo por falta de permisos');
        navigate('/dashboard');
      }
    }
  }, [currentUser, tienda, isLoading, navigate, userRole]);

  // Recargar datos periódicamente para detectar cambios
  useEffect(() => {
    // Establecer un intervalo para refrescar datos cada 5 minutos
    const intervalo = setInterval(() => {
      cargarDatos();
    }, 300000); // 5 minutos en milisegundos
    
    // Limpiar el intervalo cuando el componente se desmonte
    return () => clearInterval(intervalo);
  }, [tiendaId]);

  // Renderizar pantalla de carga
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Cargando datos de tareas completadas...</p>
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
          <h1>Historial de Tareas Completadas</h1>
          <div className="store-info">
            <h2>{tienda?.nombre || 'Tienda'}</h2>
            <div className="store-details">
              <span className="store-code">{tienda?.codigoTienda}</span>
              <span className="store-address">{tienda?.direccion?.calle}, {tienda?.direccion?.ciudad}</span>
            </div>
          </div>
          
          <div className="tasks-actions">
            <button 
              className="back-button"
              onClick={() => navigate(`/tienda/${tiendaId}/tareas`)}
            >
              <span className="material-icons">arrow_back</span>
              Volver a Tareas
            </button>
          </div>
        </div>
        
        <div className="dashboard-content">
          {/* Visualizador de tareas completadas */}
          <TaskDetailViewer 
            tasks={tareasCompletadas}
            tiendaId={tiendaId}
          />
        </div>
      </div>
    </div>
  );
};

export default CompletedTasksPage; 