import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { obtenerTienda, auth } from '../firebase';
import Sidebar from '../components/Sidebar';
import Store3D from '../components/3d/Store3D';
import InventarioTienda from '../components/InventarioTienda';
import { getStore3DConfiguration } from '../services/Store3DService';
import { verificarInventarioTienda } from '../utils/updateStockUtils';
import './TiendaInfo.css';

// Función para generar colores aleatorios para los productos
const getRandomColor = (index) => {
  // Colores predefinidos para los productos
  const colors = [
    '#FF5252', // rojo
    '#4FC3F7', // azul
    '#9CCC65', // verde
    '#FFD740', // amarillo
    '#7E57C2', // morado
    '#FF7043', // naranja
    '#26A69A', // verde azulado
    '#EC407A', // rosa
    '#5C6BC0', // indigo
    '#FFCA28'  // ámbar
  ];
  
  // Devolver un color de la lista o un color aleatorio
  return colors[index % colors.length];
};

// Función para obtener las iniciales de un producto
const getProductInitials = (productName) => {
  if (!productName) return "XX";
  
  const words = productName.split(' ');
  if (words.length === 1) {
    // Si solo hay una palabra, tomamos las primeras dos letras
    return productName.substring(0, 2).toUpperCase();
  } else {
    // Si hay múltiples palabras, tomamos la inicial de las primeras dos
    return (words[0][0] + words[1][0]).toUpperCase();
  }
};

// Función para procesar la URL de la imagen
const processImageUrl = (url) => {
  if (!url) return '';
  
  // Si la URL ya incluye un token o es una URL completa, devolverla tal cual
  if (url.includes('token=') || !url.startsWith('gs://')) {
    return url;
  }
  
  // Si es una URL de Firebase Storage (gs://), convertirla a URL HTTP
  if (url.startsWith('gs://')) {
    // Extraer el bucket y la ruta del archivo
    const gsMatch = url.match(/gs:\/\/([^\/]+)\/(.+)/);
    if (gsMatch) {
      const bucket = gsMatch[1];
      const filePath = gsMatch[2];
      // Construir la URL HTTP para Firebase Storage
      return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(filePath)}?alt=media`;
    }
  }
  
  return url;
};

const TiendaInfo = () => {
  const { tiendaId } = useParams();
  const [tienda, setTienda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);
  const [storeData, setStoreData] = useState({
    storeSize: 20,
    shelves: [],
    walls: [],
    products: []
  });
  const [loadingStore3D, setLoadingStore3D] = useState(true);
  const [showInventarioModal, setShowInventarioModal] = useState(false);
  const [tieneInventario, setTieneInventario] = useState(false);
  const [showPlanogramaModal, setShowPlanogramaModal] = useState(false);
  const [selectedPlanograma, setSelectedPlanograma] = useState(null);
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
        
        // Verificar si la tienda tiene inventario
        const tieneInv = await verificarInventarioTienda(tiendaId);
        setTieneInventario(tieneInv);
        
        // Cargar configuración 3D de la tienda
        try {
          setLoadingStore3D(true);
          const config3D = await getStore3DConfiguration(tiendaId);
          if (config3D) {
            console.log('Configuración 3D cargada:', config3D);
            setStoreData(config3D);
          }
        } catch (err) {
          console.error('Error al cargar configuración 3D:', err);
          // No mostramos error al usuario, solo lo registramos en consola
        } finally {
          setLoadingStore3D(false);
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
  
  const handleVerPlanograma = (planogramaId) => {
    // Navegar a la página de visualización de planogramas con el ID del planograma
    navigate(`/planogramas/crear/${tiendaId}?planogramaId=${planogramaId}`);
  };
  
  const toggleInventarioModal = () => {
    setShowInventarioModal(!showInventarioModal);
  };

  const handleVerTodosPlanogramas = () => {
    // Mostrar modal con todos los planogramas
    setShowPlanogramaModal(true);
  };

  const handlePlanogramaSelect = (planograma) => {
    setSelectedPlanograma(planograma);
    setShowPlanogramaModal(true);
  };

  const closePlanogramaModal = () => {
    setShowPlanogramaModal(false);
    setSelectedPlanograma(null);
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
                <span className="material-icons">inventory</span>
                Inventario de Productos
              </h3>
              
              <div className="inventario-container">
                <p className="inventario-info">
                  {tieneInventario 
                    ? "Esta tienda tiene inventario de productos con stock configurado."
                    : "Esta tienda no tiene inventario de productos configurado."
                  }
                </p>
                
                <button 
                  className="ver-inventario-button"
                  onClick={toggleInventarioModal}
                >
                  <span className="material-icons">visibility</span>
                  {tieneInventario ? "Ver y editar inventario" : "Configurar inventario"}
                </button>
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
          
          {/* Visualización 3D de la tienda */}
          <div className="tienda-3d-section">
            <h3>
              <span className="material-icons">view_in_ar</span>
              Modelo 3D de la Tienda
            </h3>
            
            {loadingStore3D ? (
              <div className="loading-store3d">
                <div className="loading-spinner small"></div>
                <span>Cargando modelo 3D...</span>
              </div>
            ) : storeData.shelves.length > 0 ? (
              <div className="store3d-viewer">
                <Store3D 
                  storeData={storeData} 
                  autoRotateCamera={true}
                  showFloor={true}
                  showWalls={true}
                  showSky={true}
                />
              </div>
            ) : (
              <div className="no-model-message">
                <span className="material-icons">info</span>
                <p>No hay modelo 3D disponible para esta tienda. Crea planogramas para construir el modelo 3D.</p>
                <button 
                  className="crear-planograma-button"
                  onClick={handleCrearPlanograma}
                  style={{ marginTop: '20px' }}
                >
                  <span className="material-icons">add</span>
                  Crear primer planograma
                </button>
              </div>
            )}
          </div>
          
          {/* Lista detallada de planogramas */}
          {storeData.shelves.length > 0 && (
            <div className="planogramas-list-section">
              <h3>
                <span className="material-icons">grid_view</span>
                Planogramas Disponibles
              </h3>
              
              <div className="planogramas-grid">
                {storeData.shelves.map((shelf, index) => {
                  // Asegurar que tenemos datos reales y no de prueba
                  const hasValidData = shelf && shelf.id && shelf.shelves && Array.isArray(shelf.shelves);
                  
                  return (
                  <div 
                    className="planograma-card" 
                      key={shelf.id || `planogram-${index}`}
                    onClick={() => handleVerPlanograma(shelf.id)}
                  >
                    <div className="planograma-header">
                        <h4>{shelf.name || `PLANOGRAMA ${index + 1}`}</h4>
                      <button 
                        className="edit-planogram-button" 
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent triggering card click
                          navigate(`/planogramas/crear/${tiendaId}?planogramaId=${shelf.id}&edit=true`);
                        }}
                        title="Editar planograma"
                      >
                        <span className="material-icons">edit</span>
                      </button>
                    </div>
                    
                      {/* Planogram 2D visualization - Solo datos reales */}
                    <div className="planograma-2d-container">
                      <div className="planograma-title">PLANOGRAMA TIENDA</div>
                      
                      <div className="estanteria">
                          {hasValidData ? (
                            // Renderizar niveles reales desde los datos de Firestore
                            shelf.shelves.map((nivel, nivelIdx) => {
                              if (!nivel || !Array.isArray(nivel) || nivel.length === 0) return null;
                              
                              return (
                                <div className="estante" key={`estante-${nivelIdx}`}>
                                  <div className="shelf-bar"></div>
                                  <div className="products-row">
                                    {/* Mostrar productos reales en este nivel */}
                                    {nivel.slice(0, 5).map((product, prodIdx) => {
                                      if (!product) return null;
                                      
                                      // Generar código de producto para productos sin imagen
                                      const code = product.name 
                                        ? getProductInitials(product.name) 
                                        : `P${nivelIdx}${prodIdx}`;
                                      
                                      return (
                                        <div className="product-item" key={`product-${nivelIdx}-${prodIdx}`}>
                                          {prodIdx === 0 && nivelIdx < 2 && (
                                            <div className="priority-badge">{nivelIdx + 1}</div>
                                          )}
                                          {product.imagenUrl ? (
                                            <>
                                    <img 
                                      src={processImageUrl(product.imagenUrl)}
                                      alt={product.name || "Producto"}
                                      className="product-image-direct"
                                      onError={(e) => {
                                        e.target.onerror = null;
                                                  const placeholderEl = e.target.parentNode.querySelector('.product-placeholder');
                                                  if (placeholderEl) {
                                                    e.target.style.display = 'none';
                                                    placeholderEl.style.display = 'flex';
                                                  } else {
                                                    // Si no existe el placeholder, crear un div con el estilo adecuado
                                                    const placeholder = document.createElement('div');
                                                    placeholder.className = 'product-placeholder';
                                                    placeholder.style.backgroundColor = product?.color || getRandomColor(prodIdx + (nivelIdx * 5));
                                                    placeholder.textContent = code;
                                                    placeholder.style.display = 'flex';
                                                    e.target.parentNode.appendChild(placeholder);
                                        e.target.style.display = 'none';
                                                  }
                                                }}
                                              />
                                              <div 
                                                className="product-placeholder" 
                                                style={{ 
                                                  backgroundColor: product?.color || getRandomColor(prodIdx + (nivelIdx * 5)), 
                                                  display: 'none' 
                                                }}
                                              >
                                                {code}
                                              </div>
                                            </>
                                  ) : (
                                    <div 
                                      className="product-placeholder" 
                                              style={{ backgroundColor: product?.color || getRandomColor(prodIdx + (nivelIdx * 5)) }}
                                    >
                                      {code}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                                    
                                    {/* Si hay menos de 5 productos, mostrar espacios vacíos */}
                                    {nivel.length < 5 && Array(5 - nivel.length).fill().map((_, idx) => (
                                      <div className="product-item empty" key={`empty-${nivelIdx}-${idx}`}></div>
                                    ))}
                          </div>
                          <div className="shelf-bar"></div>
                        </div>
                              );
                            })
                          ) : (
                            // Fallback para datos no válidos: mostrar estructura vacía
                            <>
                        <div className="estante">
                          <div className="shelf-bar"></div>
                          <div className="products-row">
                                  <div className="product-item empty"></div>
                                  <div className="product-item empty"></div>
                                  <div className="product-item empty"></div>
                          </div>
                          <div className="shelf-bar"></div>
                        </div>
                        <div className="estante">
                          <div className="shelf-bar"></div>
                          <div className="products-row">
                                  <div className="product-item empty"></div>
                                  <div className="product-item empty"></div>
                          </div>
                          <div className="shelf-bar"></div>
                              </div>
                            </>
                          )}
                      </div>
                    </div>
                    
                    <div className="planograma-info">
                      <div className="info-group">
                        <div className="info-label">Dimensiones:</div>
                          <div className="info-value">
                            {shelf.size ? 
                              `${shelf.size[0].toFixed(1)}m × ${shelf.size[1].toFixed(1)}m × ${shelf.size[2].toFixed(1)}m` : 
                              'Dimensiones no disponibles'
                            }
                          </div>
                      </div>
                      <div className="info-group">
                        <div className="info-label">Ubicación:</div>
                          <div className="info-value">
                            {shelf.position ? 
                              `X: ${shelf.position[0].toFixed(1)}, Y: ${shelf.position[1].toFixed(1)}, Z: ${shelf.position[2].toFixed(1)}` : 
                              'Ubicación no disponible'
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="planogramas-actions">
                <button 
                  className="ver-todos-button"
                  onClick={handleVerTodosPlanogramas}
                >
                  <span className="material-icons">grid_3x3</span>
                  Ver todos los planogramas
                </button>
              </div>
            </div>
          )}
          
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
      
      {/* Modal para gestión de inventario */}
      {showInventarioModal && (
        <>
          <div className="inventory-modal-overlay" onClick={toggleInventarioModal}></div>
          <InventarioTienda 
            tiendaId={tiendaId} 
            onClose={toggleInventarioModal} 
          />
        </>
      )}

      {/* Modal para visualizar planogramas */}
      {showPlanogramaModal && (
        <>
          <div className="planograma-modal-overlay" onClick={closePlanogramaModal}></div>
          <div className="planograma-modal">
            <div className="planograma-modal-header">
              <h3>{selectedPlanograma ? `Planograma ${storeData.shelves.indexOf(selectedPlanograma) + 1}` : 'Todos los Planogramas'}</h3>
              <button className="close-button" onClick={closePlanogramaModal}>
                <span className="material-icons">close</span>
              </button>
            </div>
            
            <div className="planograma-modal-content">
              {selectedPlanograma ? (
                <div className="selected-planograma">
                  <div className="planograma-dimensions">
                    <h4>Dimensiones</h4>
                    <p>Ancho: {selectedPlanograma.size[0].toFixed(2)}m</p>
                    <p>Alto: {selectedPlanograma.size[1].toFixed(2)}m</p>
                    <p>Profundidad: {selectedPlanograma.size[2].toFixed(2)}m</p>
                  </div>
                  
                  <div className="planograma-ubicacion">
                    <h4>Ubicación</h4>
                    <p>X: {selectedPlanograma.position[0].toFixed(2)}</p>
                    <p>Y: {selectedPlanograma.position[1].toFixed(2)}</p>
                    <p>Z: {selectedPlanograma.position[2].toFixed(2)}</p>
                  </div>
                  
                  <div className="planograma-productos">
                    <h4>Productos en este Planograma</h4>
                    {selectedPlanograma.shelves && selectedPlanograma.shelves.map((nivel, nivelIdx) => {
                      // Calcular el número de nivel para mostrar (de abajo hacia arriba)
                      // El nivel más bajo (índice más alto) será el nivel 1
                      const nivelNumero = selectedPlanograma.shelves.length - nivelIdx;
                      
                      return (
                        <div key={`nivel-${nivelIdx}`} className="nivel-productos">
                          <h5>Nivel {nivelNumero}</h5>
                          <div className="productos-nivel">
                            {nivel && nivel.map((producto, prodIdx) => (
                              <div key={`prod-${nivelIdx}-${prodIdx}`} className="producto-item-detail">
                                {producto.imagenUrl ? (
                                  <img 
                                    src={processImageUrl(producto.imagenUrl)} 
                                    alt={producto.name || "Producto"}
                                    className="producto-imagen"
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.style.display = 'none';
                                      e.target.nextElementSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div 
                                  className="producto-placeholder" 
                                  style={{ 
                                    backgroundColor: producto.color || getRandomColor(nivelIdx * 10 + prodIdx),
                                    display: producto.imagenUrl ? 'none' : 'flex'
                                  }}
                                >
                                  {getProductInitials(producto.name)}
                                </div>
                                <div className="producto-info">
                                  <div className="producto-nombre">{producto.name || "Producto sin nombre"}</div>
                                  <div className="producto-sku">{producto.sku || "SKU no disponible"}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="planograma-actions-detail">
                    <button 
                      className="edit-button"
                      onClick={() => navigate(`/planogramas/crear/${tiendaId}?planogramaId=${selectedPlanograma.id}&edit=true`)}
                    >
                      <span className="material-icons">edit</span>
                      Editar este planograma
                    </button>
                  </div>
                </div>
              ) : (
                <div className="all-planogramas">
                  <div className="planogramas-grid-expanded">
                    {storeData.shelves.map((shelf, index) => (
                      <div 
                        className="planograma-card" 
                        key={shelf.id}
                        onClick={() => handlePlanogramaSelect(shelf)}
                      >
                        <div className="planograma-header">
                          <h4>PLANOGRAMA {index + 1}</h4>
                        </div>
                        
                        {/* Planogram 2D visualization (simplified) */}
                        <div className="planograma-2d-container-small">
                          <div className="estanteria-small">
                            {/* Mostrar producto representativo */}
                            {shelf.shelves && shelf.shelves.map((nivel, nivelIdx) => {
                              // No cambiamos el orden de renderizado aquí, solo aseguramos que
                              // la visualización sea consistente con el modal de detalle
                              return (
                                <div className="estante-small" key={`nivel-small-${nivelIdx}`}>
                                  <div className="shelf-bar-small"></div>
                                  <div className="products-row-small">
                                    {nivel && nivel.map((producto, prodIdx) => (
                                      <div className="product-item-small" key={`prod-small-${nivelIdx}-${prodIdx}`}>
                                        {producto.imagenUrl ? (
                                          <img 
                                            src={processImageUrl(producto.imagenUrl)} 
                                            alt={producto.name || "Producto"}
                                            className="product-image-small"
                                            onError={(e) => {
                                              e.target.onerror = null;
                                              e.target.style.display = 'none';
                                              e.target.nextElementSibling.style.display = 'flex';
                                            }}
                                          />
                                        ) : null}
                                        <div 
                                          className="product-placeholder-small" 
                                          style={{ 
                                            backgroundColor: producto.color || getRandomColor(nivelIdx * 10 + prodIdx),
                                            display: producto.imagenUrl ? 'none' : 'flex' 
                                          }}
                                        >
                                          {getProductInitials(producto.name)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="shelf-bar-small"></div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        
                        <div className="planograma-info-small">
                          <div className="info-label-small">Dimensiones: {shelf.size[0].toFixed(1)}m × {shelf.size[1].toFixed(1)}m × {shelf.size[2].toFixed(1)}m</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="planogramas-actions-all">
                    <button 
                      className="crear-button"
                      onClick={handleCrearPlanograma}
                    >
                      <span className="material-icons">add</span>
                      Crear nuevo planograma
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TiendaInfo; 