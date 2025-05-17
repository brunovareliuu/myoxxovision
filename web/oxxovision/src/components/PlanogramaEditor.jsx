import React, { useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Box, Text } from '@react-three/drei';
import * as THREE from 'three';
import './PlanogramaEditor.css';

// Componente de estante (shelf)
const Shelf = ({ position, size, rotation, color, id, name, isSelected, onClick }) => {
  const meshRef = useRef();
  
  // Aplicar un color más brillante si está seleccionado
  const shelfColor = isSelected ? '#ff4d4d' : color;
  
  return (
    <Box
      ref={meshRef}
      args={size}
      position={position}
      rotation={rotation}
      onClick={(e) => {
        e.stopPropagation();
        onClick(id);
      }}
    >
      <meshStandardMaterial 
        color={shelfColor} 
        metalness={0.2} 
        roughness={0.3} 
      />
      <Text
        position={[0, size[1]/2 + 0.1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.2}
        color="black"
        anchorX="center"
        anchorY="middle"
      >
        {name}
      </Text>
    </Box>
  );
};

// Componente de suelo
const Floor = ({ size }) => {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial color="#e0e0e0" />
    </mesh>
  );
};

// Componente de pared
const Wall = ({ position, size, rotation }) => {
  return (
    <Box
      args={size}
      position={position}
      rotation={rotation}
    >
      <meshStandardMaterial color="#e0e0e0" />
    </Box>
  );
};

// Componente principal del editor de planogramas
const PlanogramaEditor = ({ tiendaData, onSavePlanograma }) => {
  const [shelves, setShelves] = useState([]);
  const [walls, setWalls] = useState([]);
  const [selectedShelfId, setSelectedShelfId] = useState(null);
  const [storeWidth, setStoreWidth] = useState(10);
  const [storeDepth, setStoreDepth] = useState(15);
  const [isAddingShelf, setIsAddingShelf] = useState(false);
  const [newShelfName, setNewShelfName] = useState('');
  const [newShelfWidth, setNewShelfWidth] = useState(2);
  const [newShelfDepth, setNewShelfDepth] = useState(0.6);
  const [newShelfHeight, setNewShelfHeight] = useState(1.8);
  
  // Generar ID único
  const generateId = () => `shelf_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  // Manejar click en un estante
  const handleShelfClick = (id) => {
    setSelectedShelfId(id);
  };
  
  // Añadir nuevo estante
  const handleAddShelf = () => {
    if (!newShelfName) {
      alert('Por favor ingresa un nombre para el estante');
      return;
    }
    
    const newShelf = {
      id: generateId(),
      name: newShelfName,
      position: [0, newShelfHeight/2, 0],
      size: [newShelfWidth, newShelfHeight, newShelfDepth],
      rotation: [0, 0, 0],
      color: '#b89a61' // Color madera
    };
    
    setShelves([...shelves, newShelf]);
    setNewShelfName('');
    setIsAddingShelf(false);
  };
  
  // Eliminar estante seleccionado
  const handleDeleteShelf = () => {
    if (!selectedShelfId) return;
    
    setShelves(shelves.filter(shelf => shelf.id !== selectedShelfId));
    setSelectedShelfId(null);
  };
  
  // Mover estante seleccionado
  const handleMoveShelf = (axis, value) => {
    if (!selectedShelfId) return;
    
    setShelves(shelves.map(shelf => {
      if (shelf.id === selectedShelfId) {
        const newPosition = [...shelf.position];
        newPosition[axis] += value;
        return { ...shelf, position: newPosition };
      }
      return shelf;
    }));
  };
  
  // Rotar estante seleccionado
  const handleRotateShelf = () => {
    if (!selectedShelfId) return;
    
    setShelves(shelves.map(shelf => {
      if (shelf.id === selectedShelfId) {
        // Rotar 90 grados en el eje Y
        const newRotation = [...shelf.rotation];
        newRotation[1] += Math.PI / 2;
        return { ...shelf, rotation: newRotation };
      }
      return shelf;
    }));
  };
  
  // Guardar planograma
  const handleSave = () => {
    const planogramData = {
      tiendaId: tiendaData.id,
      nombre: `Planograma ${tiendaData.nombre}`,
      fecha: new Date(),
      storeWidth,
      storeDepth,
      shelves,
      walls
    };
    
    onSavePlanograma(planogramData);
  };
  
  // Crear paredes al inicio
  React.useEffect(() => {
    // Paredes básicas alrededor del perímetro de la tienda
    const newWalls = [
      // Pared trasera
      {
        id: 'wall_back',
        position: [0, 1, -storeDepth/2],
        size: [storeWidth, 2, 0.2],
        rotation: [0, 0, 0]
      },
      // Pared frontal
      {
        id: 'wall_front',
        position: [0, 1, storeDepth/2],
        size: [storeWidth, 2, 0.2],
        rotation: [0, 0, 0]
      },
      // Pared izquierda
      {
        id: 'wall_left',
        position: [-storeWidth/2, 1, 0],
        size: [0.2, 2, storeDepth],
        rotation: [0, 0, 0]
      },
      // Pared derecha
      {
        id: 'wall_right',
        position: [storeWidth/2, 1, 0],
        size: [0.2, 2, storeDepth],
        rotation: [0, 0, 0]
      }
    ];
    
    setWalls(newWalls);
  }, [storeWidth, storeDepth]);

  return (
    <div className="planograma-editor">
      <div className="editor-controls">
        <div className="editor-section">
          <h3>Configuración de Tienda</h3>
          <div className="control-group">
            <label>Ancho (m):</label>
            <input 
              type="number" 
              value={storeWidth} 
              onChange={(e) => setStoreWidth(Number(e.target.value))}
              min={5}
              max={30}
              step={1}
            />
          </div>
          <div className="control-group">
            <label>Profundidad (m):</label>
            <input 
              type="number" 
              value={storeDepth} 
              onChange={(e) => setStoreDepth(Number(e.target.value))}
              min={5}
              max={30}
              step={1}
            />
          </div>
        </div>
        
        <div className="editor-section">
          <h3>Estantes</h3>
          <button 
            className="action-button"
            onClick={() => setIsAddingShelf(true)}
          >
            <span className="material-icons">add</span>
            Añadir Estante
          </button>
          
          {isAddingShelf && (
            <div className="shelf-form">
              <div className="control-group">
                <label>Nombre:</label>
                <input 
                  type="text" 
                  value={newShelfName} 
                  onChange={(e) => setNewShelfName(e.target.value)}
                  placeholder="Ej: Estante Bebidas"
                />
              </div>
              <div className="control-group">
                <label>Ancho (m):</label>
                <input 
                  type="number" 
                  value={newShelfWidth} 
                  onChange={(e) => setNewShelfWidth(Number(e.target.value))}
                  min={0.5}
                  max={5}
                  step={0.1}
                />
              </div>
              <div className="control-group">
                <label>Profundidad (m):</label>
                <input 
                  type="number" 
                  value={newShelfDepth} 
                  onChange={(e) => setNewShelfDepth(Number(e.target.value))}
                  min={0.3}
                  max={2}
                  step={0.1}
                />
              </div>
              <div className="control-group">
                <label>Altura (m):</label>
                <input 
                  type="number" 
                  value={newShelfHeight} 
                  onChange={(e) => setNewShelfHeight(Number(e.target.value))}
                  min={0.5}
                  max={3}
                  step={0.1}
                />
              </div>
              <div className="form-actions">
                <button 
                  className="action-button confirm" 
                  onClick={handleAddShelf}
                >
                  Confirmar
                </button>
                <button 
                  className="action-button cancel" 
                  onClick={() => setIsAddingShelf(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
          
          {shelves.length > 0 && (
            <div className="shelves-list">
              <h4>Estantes ({shelves.length})</h4>
              <ul>
                {shelves.map(shelf => (
                  <li 
                    key={shelf.id} 
                    className={selectedShelfId === shelf.id ? 'selected' : ''}
                    onClick={() => setSelectedShelfId(shelf.id)}
                  >
                    {shelf.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {selectedShelfId && (
          <div className="editor-section">
            <h3>Editar Estante</h3>
            <div className="control-buttons">
              <button onClick={() => handleMoveShelf(0, 0.5)} title="Mover derecha">
                <span className="material-icons">arrow_forward</span>
              </button>
              <button onClick={() => handleMoveShelf(0, -0.5)} title="Mover izquierda">
                <span className="material-icons">arrow_back</span>
              </button>
              <button onClick={() => handleMoveShelf(2, 0.5)} title="Mover atrás">
                <span className="material-icons">arrow_upward</span>
              </button>
              <button onClick={() => handleMoveShelf(2, -0.5)} title="Mover adelante">
                <span className="material-icons">arrow_downward</span>
              </button>
              <button onClick={handleRotateShelf} title="Rotar">
                <span className="material-icons">rotate_right</span>
              </button>
              <button onClick={handleDeleteShelf} title="Eliminar" className="delete-button">
                <span className="material-icons">delete</span>
              </button>
            </div>
          </div>
        )}
        
        <div className="editor-section">
          <button className="save-button" onClick={handleSave}>
            <span className="material-icons">save</span>
            Guardar Planograma
          </button>
        </div>
      </div>
      
      <div className="canvas-container">
        <Canvas shadows camera={{ position: [0, 10, 10], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.3} penumbra={1} intensity={1} castShadow />
          
          {/* Grid y Controles */}
          <Grid infiniteGrid fadeDistance={50} fadeStrength={1.5} />
          <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
          
          {/* Suelo */}
          <Floor size={Math.max(storeWidth, storeDepth) * 1.5} />
          
          {/* Paredes */}
          {walls.map(wall => (
            <Wall
              key={wall.id}
              position={wall.position}
              size={wall.size}
              rotation={wall.rotation}
            />
          ))}
          
          {/* Estantes */}
          {shelves.map(shelf => (
            <Shelf
              key={shelf.id}
              id={shelf.id}
              name={shelf.name}
              position={shelf.position}
              size={shelf.size}
              rotation={shelf.rotation}
              color={shelf.color}
              isSelected={selectedShelfId === shelf.id}
              onClick={handleShelfClick}
            />
          ))}
        </Canvas>
      </div>
    </div>
  );
};

export default PlanogramaEditor; 