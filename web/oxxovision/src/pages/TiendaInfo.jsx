import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { obtenerTienda, auth } from '../firebase';
import Sidebar from '../components/Sidebar';
import './TiendaInfo.css';

const TiendaInfo = () => {
  const { tiendaId } = useParams();
  const [tienda, setTienda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const cargarTienda = async () => {
      try {
        setLoading(true);
        
        // Obtener datos de la tienda
        const datosTienda = await obtenerTienda(tiendaId);
        
        if (!datosTienda) {
          setError('No se encontró la tienda solicitada');
          setLoading(false);
          return;
        }
        
        console.log('Datos de tienda cargados:', datosTienda);
        setTienda(datosTienda);
        
        // Cargar datos básicos del usuario
        const userId = auth.currentUser?.uid || localStorage.getItem('oxxoUserId');
        const userRole = localStorage.getItem('oxxoUserRole') || 'usuario';
        const userName = localStorage.getItem('oxxoUserName') || 'Usuario';
        
        setUserData({
          uid: userId,
          nombre: userName,
          rol: userRole
        });
        
      } catch (err) {
        console.error('Error al cargar tienda:', err);
        setError('Error al cargar los datos de la tienda');
      } finally {
        setLoading(false);
      }
    };
    
    cargarTienda();
  }, [tiendaId]);

  const handleVolver = () => {
    navigate('/dashboard');
  };
  
  const handleCrearPlanograma = () => {
    // Navegar a la página de creación de planogramas con el ID de la tienda
    navigate(`/planogramas/crear/${tiendaId}`);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando datos de la tienda...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
        <button onClick={handleVolver} className="action-button">
          <span className="material-icons">arrow_back</span>
          Volver al Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="layout-container">
      <Sidebar userData={userData} />
      
      <div className="main-content">
        <header className="content-header">
          <h1>Información de Tienda</h1>
          <div className="header-actions">
            <button className="back-button" onClick={handleVolver}>
              <span className="material-icons">arrow_back</span>
              Volver al Dashboard
            </button>
          </div>
        </header>
        
        <div className="tienda-info-content">
          <div className="tienda-header">
            <div className="tienda-title">
              <h2>{tienda.nombre}</h2>
              <div className="tienda-status" data-status={tienda.activo ? 'activo' : 'inactivo'}>
                <span className="material-icons">{tienda.activo ? 'check_circle' : 'cancel'}</span>
                <span>{tienda.activo ? 'Activa' : 'Inactiva'}</span>
              </div>
            </div>
            <div className="tienda-codigo-container">
              <span className="label">Código Tienda:</span>
              <span className="tienda-codigo">{tienda.codigoTienda}</span>
            </div>
          </div>
          
          <div className="tienda-card">
            <div className="tienda-details-section">
              <h3>
                <span className="material-icons">business</span>
                Datos Generales
              </h3>
              
              <div className="tienda-details">
                <div className="detail-item">
                  <span className="detail-label">Nombre:</span>
                  <span className="detail-value">{tienda.nombre}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Ubicación:</span>
                  <span className="detail-value">{tienda.ciudad}, {tienda.estado}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Dirección:</span>
                  <span className="detail-value">{tienda.direccion}</span>
                </div>
                {tienda.codigoPostal && (
                  <div className="detail-item">
                    <span className="detail-label">Código Postal:</span>
                    <span className="detail-value">{tienda.codigoPostal}</span>
                  </div>
                )}
                {tienda.telefono && (
                  <div className="detail-item">
                    <span className="detail-label">Teléfono:</span>
                    <span className="detail-value">{tienda.telefono}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="tienda-details-section">
              <h3>
                <span className="material-icons">person</span>
                Datos de Gerente
              </h3>
              
              <div className="tienda-details">
                {tienda.gerente ? (
                  <>
                    <div className="detail-item">
                      <span className="detail-label">Nombre:</span>
                      <span className="detail-value">{tienda.gerente.nombre || 'No especificado'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Email:</span>
                      <span className="detail-value">{tienda.gerente.email || 'No especificado'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Rol:</span>
                      <span className="detail-value">{tienda.gerente.rol || 'No especificado'}</span>
                    </div>
                  </>
                ) : (
                  <p className="no-data">No hay información del gerente disponible</p>
                )}
              </div>
            </div>
            
            <div className="tienda-details-section">
              <h3>
                <span className="material-icons">dashboard_customize</span>
                Planogramas
              </h3>
              
              <div className="planogramas-container">
                <p className="planogramas-info">
                  Crea y gestiona planogramas para esta tienda OXXO.
                </p>
                
                <button 
                  className="crear-planograma-button"
                  onClick={handleCrearPlanograma}
                >
                  <span className="material-icons">add</span>
                  Crear nuevo planograma
                </button>
              </div>
            </div>
          </div>
          
          <div className="tienda-metadata">
            <div className="metadata-item">
              <span className="metadata-label">Fecha de registro:</span>
              <span className="metadata-value">
                {tienda.fechaRegistro ? new Date(tienda.fechaRegistro.seconds * 1000).toLocaleDateString() : 'No disponible'}
              </span>
            </div>
            <div className="metadata-item">
              <span className="metadata-label">Última actualización:</span>
              <span className="metadata-value">
                {tienda.fechaActualizacion ? new Date(tienda.fechaActualizacion.seconds * 1000).toLocaleDateString() : 'No disponible'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TiendaInfo; 