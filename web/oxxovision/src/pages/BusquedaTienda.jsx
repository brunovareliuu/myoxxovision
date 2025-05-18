import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, getUserData, obtenerTiendasGerente } from '../firebase';
import Sidebar from '../components/Sidebar';
import './BusquedaTienda.css';

const BusquedaTienda = ({ redirectPath }) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tiendas, setTiendas] = useState([]);
  const [codigoBusqueda, setCodigoBusqueda] = useState('');
  const [tiendaEncontrada, setTiendaEncontrada] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Determinar el título y mensaje según el modo
  const isTareasMode = redirectPath === '/tareas';
  const isFotosMode = redirectPath === '/fotos-planogramas';
  
  let pageTitle = 'Búsqueda de Mis Tiendas OXXO';
  let instructions = 'Busca entre las tiendas que has creado.';
  
  if (isTareasMode) {
    pageTitle = 'Seleccionar Mi Tienda para Tareas';
    instructions = 'Selecciona una de tus tiendas para gestionar sus tareas y actividades.';
  } else if (isFotosMode) {
    pageTitle = 'Seleccionar Tienda para Fotos de Planogramas';
    instructions = 'Selecciona una tienda para gestionar solicitudes de fotos de planogramas.';
  }

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          navigate('/login');
          return;
        }
        
        const data = await getUserData(user.uid);
        setUserData(data);
        
        // Cargar solo las tiendas creadas por el usuario actual
        const userId = user.uid || localStorage.getItem('oxxoUserId');
        const tiendasData = await obtenerTiendasGerente(userId);
        
        // Validar que los datos sean correctos
        const tiendasValidadas = tiendasData.filter(tienda => {
          // Verificar que la tienda tenga los campos mínimos necesarios
          if (!tienda || !tienda.nombre || !tienda.codigoTienda) {
            console.warn("Tienda con datos incompletos:", tienda);
            return false;
          }
          return true;
        });
        
        setTiendas(tiendasValidadas);
      } catch (error) {
        console.error('Error al obtener datos:', error);
        setError('Error al cargar los datos. Por favor, intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [navigate]);

  const handleBusqueda = (e) => {
    e.preventDefault();
    setError('');
    setTiendaEncontrada(null);
    
    if (!codigoBusqueda.trim()) {
      setError('Por favor, ingresa un código de tienda para buscar.');
      return;
    }
    
    // Buscar la tienda por su código
    const tienda = tiendas.find(t => 
      t.codigoTienda.toLowerCase() === codigoBusqueda.toLowerCase()
    );
    
    if (tienda) {
      setTiendaEncontrada(tienda);
    } else {
      setError('No se encontró ninguna tienda con el código proporcionado.');
    }
  };

  // Manejar la navegación a detalles de tienda
  const navigateToTiendaDetails = (tiendaId) => {
    if (redirectPath) {
      // Si hay una ruta de redirección, usarla
      navigate(`${redirectPath}/${tiendaId}`);
    } else {
      // Ruta de detalles por defecto
      navigate(`/tienda/${tiendaId}`);
    }
  };

  // Obtener icono adecuado según el modo
  const getActionIcon = () => {
    if (isTareasMode) return 'assignment';
    if (isFotosMode) return 'photo_camera';
    return 'visibility';
  };

  // Obtener texto de acción según el modo
  const getActionText = () => {
    if (isTareasMode) return 'Gestionar Tareas';
    if (isFotosMode) return 'Gestionar Fotos';
    return 'Ver Detalles';
  };

  if (loading) {
    return (
      <div className="loading-container">
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="layout-container">
      <Sidebar userData={userData} />
      
      <div className="main-content">
        <header className="content-header">
          <h1>{pageTitle}</h1>
        </header>
        
        <div className="busqueda-tienda-content">
          <div className="search-container">
            <div className="search-form-container">
              <h2>Buscar Entre Mis Tiendas</h2>
              <p className="search-instructions">
                {instructions}
              </p>
              
              {error && <p className="error-message">{error}</p>}
              
              <form onSubmit={handleBusqueda} className="search-form">
                <div className="search-input-container">
                  <input
                    type="text"
                    value={codigoBusqueda}
                    onChange={(e) => setCodigoBusqueda(e.target.value)}
                    placeholder="Ej: ABC-123-XYZ"
                    className="search-input"
                  />
                  <button type="submit" className="search-button">
                    <span className="material-icons">search</span>
                    Buscar
                  </button>
                </div>
              </form>
            </div>
            
            {tiendaEncontrada && (
              <div className="tienda-details">
                <h3>Información de la Tienda</h3>
                <div className="tienda-card">
                  <div className="tienda-header">
                    <span className="tienda-codigo">{tiendaEncontrada.codigoTienda}</span>
                    <span className={`tienda-status ${tiendaEncontrada.activo ? 'active' : 'inactive'}`}>
                      {tiendaEncontrada.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  
                  <h4 className="tienda-nombre">{tiendaEncontrada.nombre}</h4>
                  
                  <div className="tienda-info">
                    <div className="info-row">
                      <span className="info-label">Dirección:</span>
                      <span className="info-value">{tiendaEncontrada.direccion}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Ciudad:</span>
                      <span className="info-value">{tiendaEncontrada.ciudad}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Estado:</span>
                      <span className="info-value">{tiendaEncontrada.estado}</span>
                    </div>
                    {tiendaEncontrada.codigoPostal && (
                      <div className="info-row">
                        <span className="info-label">C.P.:</span>
                        <span className="info-value">{tiendaEncontrada.codigoPostal}</span>
                      </div>
                    )}
                    {tiendaEncontrada.telefono && (
                      <div className="info-row">
                        <span className="info-label">Teléfono:</span>
                        <span className="info-value">{tiendaEncontrada.telefono}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="tienda-actions">
                    <button 
                      className="view-details-button"
                      onClick={() => navigateToTiendaDetails(tiendaEncontrada.id)}
                    >
                      <span className="material-icons">{getActionIcon()}</span>
                      {getActionText()}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {!tiendaEncontrada && !error && (
              <div className="search-placeholder">
                <span className="material-icons placeholder-icon">
                  {isFotosMode ? 'photo_camera' : (isTareasMode ? 'assignment' : 'store_search')}
                </span>
                <p>{isFotosMode 
                  ? 'Busca una tienda para gestionar sus fotos de planogramas.' 
                  : (isTareasMode 
                    ? 'Busca una tienda para gestionar sus tareas.' 
                    : 'Ingresa un código de tienda para ver sus detalles.')}
                </p>
              </div>
            )}
          </div>
          
          {/* Lista de tiendas del usuario */}
          <div className="tiendas-recientes">
            <h3>Mis Tiendas OXXO</h3>
            <div className="tiendas-grid">
              {tiendas.length > 0 ? (
                tiendas.map((tienda) => (
                  <div 
                    key={tienda.id} 
                    className="tienda-card-small"
                    onClick={() => navigateToTiendaDetails(tienda.id)}
                  >
                    <div className="tienda-card-header">
                      <span className="tienda-codigo-small">{tienda.codigoTienda}</span>
                    </div>
                    <h4 className="tienda-nombre-small">{tienda.nombre}</h4>
                    <p className="tienda-direccion-small">
                      {tienda.direccion?.calle || tienda.direccion}, {tienda.direccion?.ciudad || tienda.ciudad}
                    </p>
                    <div className="tienda-card-action">
                      <span className="material-icons">{getActionIcon()}</span>
                      {getActionText()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-tiendas">
                  <p>No has creado ninguna tienda todavía.</p>
                  <button 
                    className="action-button" 
                    onClick={() => navigate('/registro-tienda')}
                  >
                    <span className="material-icons">add_business</span>
                    Registrar Nueva Tienda
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusquedaTienda; 