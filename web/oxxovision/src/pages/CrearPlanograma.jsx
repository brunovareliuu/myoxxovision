import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { obtenerTienda, auth, guardarConfiguracion3D, obtenerConfiguracion3D, eliminarPlanograma } from '../firebase';
import Sidebar from '../components/Sidebar';
import Store3DEditor from '../components/3d/Store3DEditor';
import './CrearPlanograma.css';

const CrearPlanograma = () => {
  const { tiendaId } = useParams();
  const [tienda, setTienda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [storeData, setStoreData] = useState({
    storeSize: 20,
    shelves: [],
    walls: [],
    products: []
  });
  const [configExistente, setConfigExistente] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const cargarDatos = async () => {
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
        
        // Intentar obtener la configuración 3D existente
        const config3d = await obtenerConfiguracion3D(tiendaId);
        
        if (config3d && (config3d.shelves.length > 0 || config3d.walls.length > 0)) {
          console.log('Configuración 3D existente cargada:', config3d);
          setConfigExistente(true);
          setStoreData(config3d);
        }
        
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
        console.error('Error al cargar datos:', err);
        setError('Error al cargar los datos necesarios');
      } finally {
        setLoading(false);
      }
    };
    
    cargarDatos();
  }, [tiendaId]);

  const handleVolver = () => {
    navigate(`/tienda/${tiendaId}`);
  };

  const handleStoreDataChange = (newStoreData) => {
    // Ensure the data structure is complete
    if (!newStoreData) return;
    
    // Create a complete valid structure with no undefined properties
    const validData = {
      storeSize: newStoreData.storeSize || 20,
      shelves: Array.isArray(newStoreData.shelves) ? newStoreData.shelves : [],
      walls: Array.isArray(newStoreData.walls) ? newStoreData.walls : [],
      products: Array.isArray(newStoreData.products) ? newStoreData.products : []
    };
    
    setStoreData(validData);
  };

  const handleSaveConfig = async () => {
    try {
      setSavingConfig(true);
      
      // If we have existing configuration, we need to check for deleted planograms
      if (configExistente) {
        // Try to get existing configuration from Firestore
        const existingConfig = await obtenerConfiguracion3D(tiendaId);
        if (existingConfig && existingConfig.shelves) {
          // Find IDs of shelves that exist in DB but not in current storeData
          const currentShelfIds = storeData.shelves.map(shelf => shelf.id);
          const deletedShelves = existingConfig.shelves.filter(
            shelf => !currentShelfIds.includes(shelf.id)
          );
          
          // Delete these shelves from Firestore explicitly
          const deletePromises = deletedShelves.map(shelf => {
            console.log("Eliminando planograma que ya no existe en UI:", shelf.id);
            return eliminarPlanograma(tiendaId, shelf.id);
          });
          
          if (deletePromises.length > 0) {
            await Promise.all(deletePromises);
          }
        }
      }
      
      // Guardar configuración en Firebase
      await guardarConfiguracion3D(tiendaId, storeData);
      
      // Mostrar mensaje de éxito
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
      
      // Si no había una configuración existente, ahora la hay
      if (!configExistente) {
        setConfigExistente(true);
      }
    } catch (error) {
      console.error('Error al guardar configuración 3D:', error);
      setError('No se pudo guardar la configuración. Intente nuevamente.');
    } finally {
      setSavingConfig(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando datos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
        <button onClick={handleVolver} className="action-button">
          <span className="material-icons">arrow_back</span>
          Volver a la tienda
        </button>
      </div>
    );
  }

  return (
    <div className="layout-container">
      <Sidebar userData={userData} />
      
      <div className="main-content">
        <header className="content-header">
          <h1>Configuración 3D de Tienda</h1>
          <div className="header-actions">
            <button className="back-button" onClick={handleVolver}>
              <span className="material-icons">arrow_back</span>
              Volver a la tienda
            </button>
          </div>
        </header>
        
        <div className="crear-planograma-content">
          {/* Información de la tienda */}
          <div className="planograma-config-section">
            <div className="tienda-info-banner">
              <div className="tienda-info">
                <span className="label">Tienda:</span>
                <span className="value">{tienda.nombre}</span>
              </div>
              <div className="tienda-info">
                <span className="label">Código:</span>
                <span className="value">{tienda.codigoTienda}</span>
              </div>
              <div className="tienda-info">
                <span className="label">Ubicación:</span>
                <span className="value">{tienda.ciudad}, {tienda.estado}</span>
              </div>
              
              <button 
                className="action-button save-button" 
                onClick={handleSaveConfig}
                disabled={savingConfig}
              >
                {savingConfig ? 'Guardando...' : (configExistente ? 'Actualizar Configuración' : 'Guardar Configuración')}
              </button>
            </div>
            
            <div className="instrucciones-config">
              <h4>Instrucciones:</h4>
              <p>Configura el modelo 3D de tu tienda añadiendo planogramas (estantes). Cada planograma representa un tipo de producto dentro de tu tienda.</p>
              <ul>
                <li>Utiliza el panel superior para añadir nuevos planogramas</li>
                <li>Selecciona un planograma para editarlo o moverlo</li>
                <li>Haz clic en "Guardar Configuración" cuando termines</li>
              </ul>
            </div>
          </div>
          
          {/* 3D Store Editor */}
          <div className="planograma-editor-container">
            <Store3DEditor 
              tiendaData={tienda}
              onStoreDataChange={handleStoreDataChange}
              initialStoreData={storeData}
            />
          </div>
          
          {/* Success Message */}
          {saveSuccess && (
            <div className="success-message">
              <span className="material-icons">check_circle</span>
              {configExistente ? 'Configuración actualizada exitosamente' : 'Configuración guardada exitosamente'}
            </div>
          )}
          
          {/* Loading overlay when saving */}
          {savingConfig && (
            <div className="saving-overlay">
              <div className="loading-spinner"></div>
              <p>{configExistente ? 'Actualizando configuración...' : 'Guardando configuración...'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CrearPlanograma; 