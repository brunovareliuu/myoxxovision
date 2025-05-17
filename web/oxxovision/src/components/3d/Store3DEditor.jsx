import React, { useState, useEffect } from 'react';
import { eliminarPlanograma } from '../../firebase';
import Store3D from './Store3D';
import PlanogramaConfig from './PlanogramaConfig';
import './Store3DEditor.css';

const Store3DEditor = ({ tiendaData, onStoreDataChange, initialStoreData }) => {
  // Ensure initialStoreData has all required properties
  const safeInitialData = initialStoreData ? {
    storeSize: initialStoreData.storeSize || 20,
    shelves: initialStoreData.shelves || [],
    walls: initialStoreData.walls || [],
    products: initialStoreData.products || []
  } : null;
  
  // State for store configuration
  const [storeData, setStoreData] = useState(safeInitialData || {
    storeSize: 20,
    shelves: [],
    walls: [],
    products: []
  });
  
  // UI states
  const [selectedShelfId, setSelectedShelfId] = useState(null);
  const [isAddingShelf, setIsAddingShelf] = useState(false);
  const [configureShelfId, setConfigureShelfId] = useState(null);
  const [viewOptions, setViewOptions] = useState({
    autoRotate: false,
    showFloor: true,
    showWalls: true,
    showSky: true
  });
  const [configPanelCollapsed, setConfigPanelCollapsed] = useState(false);
  
  // Form states for new shelf (planograma)
  const [newShelf, setNewShelf] = useState({
    name: '',
    width: 2,
    height: 1.5,
    depth: 0.6,
    posX: 0,
    posY: 0,
    posZ: 0,
    rotY: 0,
    color: '#b5a642'
  });
  
  // Estado para el ID de la tienda actual
  const [tiendaId, setTiendaId] = useState(null);
  
  // Obtener el ID de la tienda cuando se cargan los props
  useEffect(() => {
    // Si tenemos tiendaData, usar su ID directamente (prioridad máxima)
    if (tiendaData && tiendaData.id) {
      console.log(`[STORE3D] Usando ID de tienda de tiendaData: ${tiendaData.id}`);
      setTiendaId(tiendaData.id);
      return;
    }
    
    // Obtener de la URL como respaldo
    const url = window.location.pathname;
    const match = url.match(/\/tienda\/([^\/]+)/);
    if (match && match[1]) {
      console.log(`[STORE3D] ID de tienda encontrado en URL: ${match[1]}`);
      setTiendaId(match[1]);
      return;
    }
    
    // Obtener de los parámetros URL como segunda opción de respaldo
    const urlParams = new URLSearchParams(window.location.search);
    const idParam = urlParams.get('id') || urlParams.get('tiendaId') || urlParams.get('storeId');
    if (idParam) {
      console.log(`[STORE3D] ID de tienda encontrado en parámetros: ${idParam}`);
      setTiendaId(idParam);
      return;
    }

    // ADVERTENCIA: No se encontró ID válido de tienda
    console.error("[STORE3D] ERROR: No se pudo determinar el ID de la tienda");
  }, [tiendaData]);
  
  // Update parent component when store data changes
  useEffect(() => {
    if (onStoreDataChange) {
      onStoreDataChange(storeData);
    }
  }, [storeData, onStoreDataChange]);
  
  // Find selected shelf
  const selectedShelf = storeData.shelves.find(shelf => shelf.id === selectedShelfId);
  // Find configuring shelf
  const configuringShelf = storeData.shelves.find(shelf => shelf.id === configureShelfId);
  
  // Handle shelf selection from 3D view
  const handleShelfSelect = (id) => {
    setSelectedShelfId(id);
    setIsAddingShelf(false);
  };
  
  // Generate unique ID
  const generateId = (prefix) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  // Add a new shelf (planograma)
  const handleAddShelf = () => {
    if (!newShelf.name) {
      alert('Por favor ingresa un nombre para el planograma');
      return;
    }
    
    const id = generateId('shelf');
    const shelf = {
      id,
      name: newShelf.name,
      position: [newShelf.posX, newShelf.height/2 + newShelf.posY, newShelf.posZ],
      size: [newShelf.width, newShelf.height, newShelf.depth],
      rotation: [0, newShelf.rotY * (Math.PI / 180), 0], // Convert degrees to radians
      color: newShelf.color,
      products: [],
      shelves: [[]],  // Add default shelf configuration with 1 level
      maxProductsPerShelf: 5,  // Default max products
      tiendaId: tiendaId  // Add tiendaId to associate shelf with correct store
    };
    
    setStoreData({
      ...storeData,
      shelves: [...storeData.shelves, shelf]
    });
    
    // Reset form
    setNewShelf({
      name: '',
      width: 2,
      height: 1.5,
      depth: 0.6,
      posX: 0,
      posY: 0,
      posZ: 0,
      rotY: 0,
      color: '#b5a642'
    });
    setSelectedShelfId(id);
    setIsAddingShelf(false);
  };
  
  // Update shelf position
  const handleUpdateShelfPosition = (axis, value) => {
    if (!selectedShelfId) return;
    
    setStoreData(prev => ({
      ...prev,
      shelves: prev.shelves.map(shelf => {
        if (shelf.id === selectedShelfId) {
          // Add defensive checks for undefined position
          const shelfPosition = shelf.position || [0, 0, 0];
          const newPosition = [...shelfPosition];
          newPosition[axis] += value;
          return { ...shelf, position: newPosition };
        }
        return shelf;
      })
    }));
  };
  
  // Rotate shelf
  const handleRotateShelf = (degrees) => {
    if (!selectedShelfId) return;
    
    setStoreData(prev => ({
      ...prev,
      shelves: prev.shelves.map(shelf => {
        if (shelf.id === selectedShelfId) {
          // Add defensive checks for undefined rotation
          const shelfRotation = shelf.rotation || [0, 0, 0];
          const currentRotation = shelfRotation[1] * (180 / Math.PI); // Convert to degrees
          const newRotation = [...shelfRotation];
          newRotation[1] = (currentRotation + degrees) * (Math.PI / 180); // Add degrees and convert back
          return { ...shelf, rotation: newRotation };
        }
        return shelf;
      })
    }));
  };
  
  // Delete shelf
  const handleDeleteShelf = async () => {
    if (!selectedShelfId) return;
    
    if (confirm('¿Estás seguro que deseas eliminar este planograma?')) {
      try {
        // Delete from Firebase first
        if (tiendaData && tiendaData.id) {
          await eliminarPlanograma(tiendaData.id, selectedShelfId);
        }
        
        // Then update local state
        setStoreData(prev => {
          // Check if products array exists and filter if it does
          const updatedProducts = prev.products 
            ? prev.products.filter(product => product.shelfId !== selectedShelfId) 
            : [];
          
          return {
        ...prev,
        shelves: prev.shelves.filter(shelf => shelf.id !== selectedShelfId),
            products: updatedProducts
          };
        });
      setSelectedShelfId(null);
      } catch (error) {
        console.error("Error al eliminar planograma:", error);
        alert("Hubo un error al eliminar el planograma. Intenta de nuevo.");
      }
    }
  };
  
  // Update view options
  const handleViewOptionChange = (option) => {
    setViewOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };
  
  // Open planogram configuration
  const handleConfigurePlanogram = () => {
    if (!selectedShelfId) return;
    setConfigureShelfId(selectedShelfId);
  };

  // Save planogram configuration
  const handleSavePlanogramConfig = (updatedShelf) => {
    setStoreData(prev => ({
      ...prev,
      shelves: prev.shelves.map(shelf => 
        shelf.id === updatedShelf.id ? { ...shelf, ...updatedShelf } : shelf
      )
    }));
  };
  
  return (
    <div className="store3d-editor-column">
      {/* Panel de configuración superior */}
      <div className={`config-panel ${configPanelCollapsed ? 'collapsed' : 'expanded'}`}>
        <div className="config-header">
          <h3>
            Configuración de Planogramas
            {tiendaId && (
              <span className="current-store-badge">
                Tienda: {tiendaId}
              </span>
            )}
          </h3>
              <div className="view-options">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={viewOptions.autoRotate}
                    onChange={() => handleViewOptionChange('autoRotate')}
                  />
                  Rotación automática
                </label>
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={viewOptions.showFloor}
                    onChange={() => handleViewOptionChange('showFloor')}
                  />
                  Mostrar piso
                </label>
          </div>
              </div>
              
        <div className="planograma-management">
          <div className="section-header">
            <h4>Planogramas ({storeData.shelves.length})</h4>
            <button 
              className="action-button add-button"
              onClick={() => {
                setIsAddingShelf(!isAddingShelf);
                if (!isAddingShelf) {
                  setSelectedShelfId(null);
                }
              }}
            >
              {isAddingShelf ? 'Cancelar' : '+ Añadir Planograma'}
              </button>
            </div>
          
          <div className="planograma-content">
            {/* Lista de planogramas */}
            <div className="planograma-list">
              {storeData.shelves.length === 0 ? (
                <div className="empty-state">
                  <p>No hay planogramas. Añade tu primer planograma con el botón "Añadir Planograma".</p>
                </div>
              ) : (
                storeData.shelves.map(shelf => (
                  <div 
                    key={shelf.id}
                    className={`planograma-item ${selectedShelfId === shelf.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedShelfId(shelf.id);
                      setIsAddingShelf(false);
                    }}
                >
                    <div className="planograma-color" style={{ backgroundColor: shelf.color }}></div>
                    <div className="planograma-name">{shelf.name}</div>
                  </div>
                ))
              )}
            </div>
            
            {/* Formulario para añadir planograma */}
            {isAddingShelf && (
              <div className="planograma-form">
                <h5>Añadir nuevo planograma</h5>
                <div className="form-row">
                  <div className="form-group">
                    <label>Nombre del Planograma</label>
                    <input 
                      type="text" 
                      value={newShelf.name} 
                      onChange={(e) => setNewShelf({...newShelf, name: e.target.value})}
                      placeholder="Ej: Bebidas, Abarrotes, etc."
                    />
                  </div>
                  <div className="form-group">
                    <label>Color</label>
                    <input 
                      type="color" 
                      value={newShelf.color} 
                      onChange={(e) => setNewShelf({...newShelf, color: e.target.value})}
                    />
                  </div>
                  </div>
                  
                <div className="form-columns">
                  <div className="form-column">
                    <h5>Dimensiones</h5>
                    <div className="form-row">
                    <div className="form-group">
                      <label>Ancho</label>
                      <input 
                        type="number" 
                        value={newShelf.width} 
                        onChange={(e) => setNewShelf({...newShelf, width: Number(e.target.value)})}
                        step={0.1}
                        min={0.1}
                      />
                    </div>
                    <div className="form-group">
                      <label>Alto</label>
                      <input 
                        type="number" 
                        value={newShelf.height} 
                        onChange={(e) => setNewShelf({...newShelf, height: Number(e.target.value)})}
                        step={0.1}
                        min={0.1}
                      />
                    </div>
                    <div className="form-group">
                      <label>Profundidad</label>
                      <input 
                        type="number" 
                        value={newShelf.depth} 
                        onChange={(e) => setNewShelf({...newShelf, depth: Number(e.target.value)})}
                        step={0.1}
                        min={0.1}
                      />
                      </div>
                    </div>
                  </div>
                  
                  <div className="form-column">
                    <h5>Posición Inicial</h5>
                    <div className="form-row">
                    <div className="form-group">
                      <label>Posición X</label>
                      <input 
                        type="number" 
                        value={newShelf.posX} 
                        onChange={(e) => setNewShelf({...newShelf, posX: Number(e.target.value)})}
                        step={0.5}
                      />
                    </div>
                    <div className="form-group">
                      <label>Posición Z</label>
                      <input 
                        type="number" 
                        value={newShelf.posZ} 
                        onChange={(e) => setNewShelf({...newShelf, posZ: Number(e.target.value)})}
                        step={0.5}
                      />
                    </div>
                    <div className="form-group">
                      <label>Rotación Y°</label>
                      <input 
                        type="number" 
                        value={newShelf.rotY} 
                        onChange={(e) => setNewShelf({...newShelf, rotY: Number(e.target.value)})}
                        step={15}
                      />
                    </div>
                  </div>
                  </div>
                  </div>
                  
                  <div className="form-actions">
                    <button 
                      className="action-button confirm-button"
                      onClick={handleAddShelf}
                    >
                    Agregar Planograma
                    </button>
                  </div>
                </div>
              )}
              
            {/* Controles del planograma seleccionado */}
            {selectedShelf && !isAddingShelf && (
              <div className="planograma-controls">
                <h5>Editando: {selectedShelf.name}</h5>
                
                <div className="controls-container">
                  <div className="control-section">
                    <div className="control-label">Mover planograma</div>
                    <div className="movement-controls">
                      <button onClick={() => handleUpdateShelfPosition(0, -0.5)} title="Mover a la izquierda">◀</button>
                      <button onClick={() => handleUpdateShelfPosition(2, -0.5)} title="Mover hacia atrás">▲</button>
                      <button onClick={() => handleUpdateShelfPosition(2, 0.5)} title="Mover hacia adelante">▼</button>
                      <button onClick={() => handleUpdateShelfPosition(0, 0.5)} title="Mover a la derecha">▶</button>
                    </div>
                  </div>
                  
                  <div className="control-section">
                    <div className="control-label">Rotar planograma</div>
                    <div className="rotation-controls">
                      <button onClick={() => handleRotateShelf(-15)} title="Rotar a la izquierda">↺ 15°</button>
                      <button onClick={() => handleRotateShelf(15)} title="Rotar a la derecha">↻ 15°</button>
                    </div>
                  </div>
                  
                  <div className="control-section control-buttons">
                    <button 
                      className="action-button configure-button"
                      onClick={handleConfigurePlanogram}
                    >
                      <span className="material-icons">settings</span>
                      Configurar Planograma
                    </button>
                    
                    <button 
                      className="action-button delete-button"
                      onClick={handleDeleteShelf}
                    >
                      <span className="material-icons">delete</span>
                      Eliminar Planograma
                    </button>
                  </div>
                </div>
                </div>
              )}
            </div>
        </div>
        
        {/* Toggle button */}
        <div 
          className="config-toggle"
          onClick={() => setConfigPanelCollapsed(!configPanelCollapsed)}
        >
          <span className="material-icons">
            {configPanelCollapsed ? 'expand_more' : 'expand_less'}
          </span>
        </div>
      </div>
      
      {/* Visualización 3D */}
      <div className="store3d-canvas">
        <Store3D
          storeData={storeData}
          onShelfSelect={handleShelfSelect}
          autoRotateCamera={viewOptions.autoRotate}
          showFloor={viewOptions.showFloor}
          showWalls={viewOptions.showWalls}
          showSky={viewOptions.showSky}
        />
      </div>

      {/* Configurador de Planograma (Pantalla Completa) */}
      {configuringShelf && (
        <PlanogramaConfig
          shelf={configuringShelf}
          onClose={() => setConfigureShelfId(null)}
          onSave={handleSavePlanogramConfig}
          tiendaId={tiendaId}
        />
      )}
    </div>
  );
};

export default Store3DEditor; 