import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, getUserData, obtenerTiendas } from '../firebase';
import Sidebar from '../components/Sidebar';
import './BusquedaTienda.css';

const BusquedaTienda = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tiendas, setTiendas] = useState([]);
  const [codigoBusqueda, setCodigoBusqueda] = useState('');
  const [tiendaEncontrada, setTiendaEncontrada] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

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
        
        // Cargar todas las tiendas
        const tiendasData = await obtenerTiendas();
        setTiendas(tiendasData);
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
          <h1>Búsqueda de Tienda OXXO</h1>
        </header>
        
        <div className="busqueda-tienda-content">
          <div className="search-container">
            <div className="search-form-container">
              <h2>Buscar Tienda por Código</h2>
              <p className="search-instructions">
                Ingresa el código de la tienda en formato XXX-XXX-XXX para consultar sus detalles.
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
                    <button className="view-details-button">
                      <span className="material-icons">visibility</span>
                      Ver Detalles Completos
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {!tiendaEncontrada && !error && (
              <div className="search-placeholder">
                <span className="material-icons placeholder-icon">store_search</span>
                <p>Ingresa un código de tienda para ver sus detalles.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusquedaTienda; 