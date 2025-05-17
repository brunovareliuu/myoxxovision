import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  OrbitControls, 
  Sky, 
  Environment, 
  Text,
  Html,
  PerspectiveCamera,
  useTexture
} from '@react-three/drei';
import * as THREE from 'three';
import './Store3D.css';

// Instruction component shown when no shelves
const EmptyStoreInstructions = () => {
  return (
    <group position={[0, 1, 0]}>
      <Text
        position={[0, 0.3, 0]}
        fontSize={0.3}
        color="#333333"
        anchorX="center"
        anchorY="middle"
        maxWidth={5}
        textAlign="center"
        font="https://fonts.gstatic.com/s/raleway/v14/1Ptrg8zYS_SKggPNwK4vaqI.woff"
      >
        Añade tu primer planograma
      </Text>
      <Text
        position={[0, -0.3, 0]}
        fontSize={0.2}
        color="#666666"
        anchorX="center"
        anchorY="middle"
        maxWidth={5}
        textAlign="center"
      >
        Utiliza el botón "Añadir Planograma" arriba
      </Text>
    </group>
  );
};

// Floor component with texture
const Floor = ({ size = 20 }) => {
  const texture = useTexture('/textures/floorTexture.png');
  // Set texture repeat based on floor size
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(size/2, size/2);
  texture.encoding = THREE.sRGBEncoding;
  
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial 
        map={texture} 
        roughness={0.8}
        metalness={0.2}
      />
      
      {/* Grid lines - more subtle */}
      <gridHelper 
        args={[size, size/2, '#888888', '#cccccc']} 
        position={[0, 0.01, 0]} 
        rotation={[Math.PI / 2, 0, 0]} 
        opacity={0.2}
        transparent={true}
      />
    </mesh>
  );
};

// Wall component
const Wall = ({ position = [0, 0, 0], size = [1, 1, 1], rotation = [0, 0, 0], color = "#ffffff" }) => {
  // Ensure arrays are properly defined
  const safePosition = Array.isArray(position) ? position : [0, 0, 0];
  const safeSize = Array.isArray(size) ? size : [1, 1, 1];
  const safeRotation = Array.isArray(rotation) ? rotation : [0, 0, 0];
  
  return (
    <mesh position={safePosition} rotation={safeRotation} castShadow receiveShadow>
      <boxGeometry args={safeSize} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
};

// Shelf component with labels and interactivity
const Shelf = ({ position = [0, 0, 0], size = [1, 1, 1], rotation = [0, 0, 0], color = "#cccccc", id, name, products = [], shelves = [], maxProductsPerShelf = 5, isSelected, onClick }) => {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  
  // Ensure all arrays are properly defined
  const safePosition = Array.isArray(position) ? position : [0, 0, 0];
  const safeSize = Array.isArray(size) ? size : [1, 1, 1];
  const safeRotation = Array.isArray(rotation) ? rotation : [0, 0, 0];
  
  // Highlight color when hovered or selected
  const shelfColor = isSelected ? '#4285f4' : (hovered ? '#90caf9' : color);
  
  // No animation for selected shelves - prevent unwanted rotation
  
  // Compute shelf positions based on configuration
  const shelfCount = shelves ? shelves.length : 1;
  const shelfHeight = safeSize[1] / shelfCount;
  
  return (
    <group position={safePosition} rotation={safeRotation}>
      {/* Main shelf structure */}
      <mesh
        ref={meshRef}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onClick(id);
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={safeSize} />
        <meshStandardMaterial 
          color={shelfColor} 
          metalness={0.1} 
          roughness={0.6} 
        />
      </mesh>
      
      {/* Shelf label - replace text with a simple square/block when hovering */}
      {(hovered || isSelected) && (
        <mesh position={[0, safeSize[1]/2 + 0.1, 0]} castShadow>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshStandardMaterial color={isSelected ? "#4285f4" : "#90caf9"} />
        </mesh>
      )}
      
      {/* Display shelf levels */}
      {shelves && shelves.length > 0 && shelves.map((shelfLevel, levelIndex) => {
        // Position for this shelf level
        const levelY = -safeSize[1]/2 + (levelIndex + 0.5) * shelfHeight;
        return (
          <group key={`shelf-level-${levelIndex}`} position={[0, levelY, 0]}>
            {/* Shelf divider (except for bottom shelf) */}
            {levelIndex > 0 && (
              <mesh position={[0, shelfHeight/2, 0]}>
                <boxGeometry args={[safeSize[0], 0.05, safeSize[2]]} />
                <meshStandardMaterial color="#8b7355" />
              </mesh>
            )}
            
            {/* Products on this shelf level */}
            {shelfLevel && shelfLevel.length > 0 && shelfLevel.map((product, productIndex) => {
              // Calculate product position within the shelf
              const totalProducts = shelfLevel.length;
              const productWidth = safeSize[0] / Math.max(totalProducts, maxProductsPerShelf);
              const startX = -safeSize[0]/2 + productWidth/2;
              const productX = startX + productIndex * productWidth;
              const productY = 0; // centered at shelf level
              const productZ = safeSize[2]/4; // position at front half of shelf
              
              return (
                <mesh 
                  key={`product-${levelIndex}-${productIndex}`}
                  position={[productX, productY, productZ]}
                  castShadow
                >
                  <boxGeometry args={[productWidth * 0.8, shelfHeight * 0.7, safeSize[2] * 0.4]} />
                  <meshStandardMaterial color={product.color || "#ff9800"} />
                  
                  {/* Product label - only show on hover or when shelf selected */}
                  {(isSelected || hovered) && (
                    <Html position={[0, shelfHeight * 0.4, 0]} center distanceFactor={10}>
                      <div className="product-tag">
                        {product.name}
                      </div>
                    </Html>
                  )}
                </mesh>
              );
            })}
          </group>
        );
      })}
      
      {/* Display product information when shelf is selected */}
      {isSelected && products && products.length > 0 && (
        <Html position={[safeSize[0]/2 + 0.5, 0, 0]}>
          <div className="product-info-panel">
            <h4>Productos</h4>
            <ul>
              {products.map((product, index) => (
                <li key={index}>{product.name}</li>
              ))}
            </ul>
          </div>
        </Html>
      )}
    </group>
  );
};

// Product component that can be placed on shelves
const Product = ({ position = [0, 0, 0], size = [0.3, 0.3, 0.3], color = "#ff9800", name = "Producto" }) => {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef();
  
  // Ensure arrays are properly defined
  const safePosition = Array.isArray(position) ? position : [0, 0, 0];
  const safeSize = Array.isArray(size) ? size : [0.3, 0.3, 0.3];
  
  return (
    <group position={safePosition}>
      <mesh
        ref={meshRef}
        castShadow
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={safeSize} />
        <meshStandardMaterial color={hovered ? '#ffcdd2' : color} />
      </mesh>
      
      {hovered && (
        <mesh position={[0, safeSize[1] + 0.1, 0]} castShadow>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshStandardMaterial color="#ffcdd2" />
        </mesh>
      )}
    </group>
  );
};

// Camera controller with controls
const CameraController = ({ autoRotate = false }) => {
  const { camera } = useThree();
  const controlsRef = useRef();
  
  useEffect(() => {
    camera.position.set(8, 5, 8);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  
  return (
    <>
      <OrbitControls
        ref={controlsRef}
        args={[camera]}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
        autoRotate={autoRotate}
        autoRotateSpeed={0.5}
        minDistance={3}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2 - 0.1}
        screenSpacePanning={true}
      />
      {/* Add custom navigation UI */}
      <Html position={[0, 0, 0]} prepend fullscreen>
        <div className="scene-controls">
          <div className="scene-controls-container">
            {/* Zoom controls */}
            <div className="zoom-controls">
              <button
                className="control-button"
                onClick={() => {
                  if (controlsRef.current) {
                    controlsRef.current.object.position.lerp(
                      new THREE.Vector3(
                        controlsRef.current.object.position.x * 0.8,
                        controlsRef.current.object.position.y * 0.8,
                        controlsRef.current.object.position.z * 0.8
                      ),
                      0.5
                    );
                  }
                }}
              >
                <span className="material-icons">add</span>
              </button>
              <button
                className="control-button"
                onClick={() => {
                  if (controlsRef.current) {
                    controlsRef.current.object.position.lerp(
                      new THREE.Vector3(
                        controlsRef.current.object.position.x * 1.2,
                        controlsRef.current.object.position.y * 1.2,
                        controlsRef.current.object.position.z * 1.2
                      ),
                      0.5
                    );
                  }
                }}
              >
                <span className="material-icons">remove</span>
              </button>
            </div>
            {/* Reset view button */}
            <button
              className="control-button reset-view"
              onClick={() => {
                if (controlsRef.current) {
                  controlsRef.current.reset();
                }
              }}
            >
              <span className="material-icons">center_focus_strong</span>
            </button>
          </div>
        </div>
      </Html>
    </>
  );
};

// Main Store3D component
const Store3D = ({
  storeData,
  onShelfSelect,
  autoRotateCamera = false,
  showFloor = true,
  showWalls = true,
  showSky = true
}) => {
  const [selectedShelfId, setSelectedShelfId] = useState(null);
  
  // Handle shelf selection
  const handleShelfClick = (id) => {
    setSelectedShelfId(id);
    if (onShelfSelect) {
      onShelfSelect(id);
    }
  };

  // Use shelves from props or default if none provided
  const shelves = storeData?.shelves || [];
  
  // Use walls from props or default if none provided
  const walls = storeData?.walls || [
    // Back wall
    {
      position: [0, 1.5, -5],
      size: [10, 3, 0.2],
      rotation: [0, 0, 0],
      color: '#f5f5f5'
    },
    // Left wall
    {
      position: [-5, 1.5, 0],
      size: [0.2, 3, 10],
      rotation: [0, 0, 0],
      color: '#f5f5f5'
    },
    // Right wall
    {
      position: [5, 1.5, 0],
      size: [0.2, 3, 10],
      rotation: [0, 0, 0],
      color: '#f5f5f5'
    }
  ];
  
  // Default products if none provided
  const products = storeData?.products || [];
  
  return (
    <div className="store3d-container">
      <Canvas shadows>
        {/* Camera setup */}
        <PerspectiveCamera makeDefault position={[5, 5, 5]} />
        <CameraController autoRotate={autoRotateCamera} />
        
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight 
          position={[5, 8, 5]} 
          intensity={1} 
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight position={[-3, 3, -3]} intensity={0.5} />
        
        {/* Environment */}
        {showSky && <Sky sunPosition={[100, 10, 100]} />}
        <Environment preset="city" />
        
        {/* Floor */}
        {showFloor && <Floor size={storeData?.storeSize || 20} />}
        
        {/* Walls */}
        {showWalls && walls.map((wall, index) => (
          <Wall 
            key={`wall-${index}`}
            position={wall.position}
            size={wall.size}
            rotation={wall.rotation}
            color={wall.color}
          />
        ))}
        
        {/* Show instructions when no shelves */}
        {shelves.length === 0 && (
          <EmptyStoreInstructions />
        )}
        
        {/* Shelves */}
        {shelves.map((shelf) => (
          <Shelf
            key={shelf.id}
            id={shelf.id}
            name={shelf.name}
            position={shelf.position}
            size={shelf.size}
            rotation={shelf.rotation}
            color={shelf.color}
            products={shelf.products}
            shelves={shelf.shelves}
            maxProductsPerShelf={shelf.maxProductsPerShelf}
            isSelected={selectedShelfId === shelf.id}
            onClick={handleShelfClick}
          />
        ))}
        
        {/* Products */}
        {products.map((product, index) => (
          <Product
            key={`product-${index}`}
            position={product.position}
            size={product.size || [0.3, 0.3, 0.3]}
            color={product.color}
            name={product.name}
          />
        ))}
      </Canvas>
    </div>
  );
};

export default Store3D; 