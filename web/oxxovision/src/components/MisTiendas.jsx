import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { obtenerTiendasGerente, auth } from '../firebase';
import './MisTiendas.css';

const MisTiendas = () => {
  const [tiendas, setTiendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const cargarTiendas = async () => {
      try {
        setLoading(true);
        
        // Obtener ID del usuario actual
        const userId = auth.currentUser?.uid || localStorage.getItem('oxxoUserId');
        
        if (!userId) {
          console.error("No se pudo identificar al usuario");
          setError("No se pudo identificar al usuario");
          setLoading(false);
          return;
        }
        
        console.log("Cargando tiendas para el usuario:", userId);
        
        // Cargar las tiendas del gerente
        const tiendasData = await obtenerTiendasGerente(userId);
        console.log("Tiendas obtenidas:", tiendasData.length);
        
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
      } catch (err) {
        console.error("Error detallado al cargar tiendas:", err);
        setError("Error al cargar las tiendas. Intentalo de nuevo.");
      } finally {
        setLoading(false);
      }
    };
    
    cargarTiendas();
  }, []);

  const handleVerDetalle = (tiendaId) => {
    // Navegar a la página de detalle de tienda (pendiente de implementar)
    // navigate(`/tienda/${tiendaId}`);
    console.log(`Ver detalle de tienda: ${tiendaId}`);
  };

  if (loading) {
    return (
      <div className="mis-tiendas-container loading">
        <p>Cargando tiendas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mis-tiendas-container error">
        <p className="error-message">{error}</p>
        <button 
          className="action-button" 
          onClick={() => window.location.reload()}
        >
          <span className="material-icons">refresh</span>
          Intentar de nuevo
        </button>
      </div>
    );
  }

  if (tiendas.length === 0) {
    return (
      <div className="mis-tiendas-container empty">
        <div className="empty-message">
          <span className="material-icons">store_off</span>
          <h3>No tienes tiendas registradas</h3>
          <p>Aún no has registrado ninguna tienda. Utiliza el botón de "Registrar Nueva Tienda" para comenzar.</p>
          <button 
            className="action-button" 
            onClick={() => navigate('/registro-tienda')}
          >
            <span className="material-icons">add_business</span>
            Registrar Nueva Tienda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mis-tiendas-container">
      <div className="mis-tiendas-header">
        <h3>Mis Tiendas OXXO</h3>
        <div className="mis-tiendas-actions">
          <span className="tiendas-count">{tiendas.length} tienda(s)</span>
          <button 
            className="action-button small" 
            onClick={() => navigate('/registro-tienda')}
          >
            <span className="material-icons">add_business</span>
            Nueva Tienda
          </button>
        </div>
      </div>
      
      <div className="tiendas-grid">
        {tiendas.map((tienda) => (
          <div key={tienda.id} className="tienda-card" onClick={() => handleVerDetalle(tienda.id)}>
            <div className="tienda-status" data-status={tienda.activo ? 'activo' : 'inactivo'}>
              <span className="material-icons">{tienda.activo ? 'check_circle' : 'cancel'}</span>
            </div>
            <h4 className="tienda-nombre">{tienda.nombre}</h4>
            <div className="tienda-codigo">{tienda.codigoTienda}</div>
            <div className="tienda-direccion">
              <span className="material-icons">location_on</span>
              <p>{tienda.ciudad || 'Ciudad'}, {tienda.estado || 'Estado'}</p>
            </div>
            <div className="tienda-direccion-completa">
              <p>{tienda.direccion || 'Sin dirección'}</p>
              {tienda.codigoPostal && <p>CP: {tienda.codigoPostal}</p>}
            </div>
            <button className="ver-detalle-btn">
              <span className="material-icons">visibility</span>
              Ver Detalles
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MisTiendas; 