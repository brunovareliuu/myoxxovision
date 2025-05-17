import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { obtenerProductos, eliminarProducto, storage, db } from '../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import Sidebar from '../components/Sidebar';
import FileUpload from '../components/FileUpload';
import './ProductosPage.css';

const ProductosPage = () => {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('Todas');
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const navigate = useNavigate();

  // Obtener productos
  useEffect(() => {
    const fetchProductos = async () => {
      try {
        setLoading(true);
        const productosData = await obtenerProductos();
        setProductos(productosData);
        setError(null);
      } catch (err) {
        console.error('Error al obtener productos:', err);
        setError('Error al cargar los productos. Por favor, intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    };

    fetchProductos();
  }, []);

  // Monitorear progreso de subida
  useEffect(() => {
    const handleProgress = (event) => {
      if (event.detail && typeof event.detail.progress === 'number') {
        setUploadProgress(event.detail.progress);
      }
    };
    
    window.addEventListener('upload-progress', handleProgress);
    return () => {
      window.removeEventListener('upload-progress', handleProgress);
    };
  }, []);

  // Extraer categorías únicas
  const categorias = ['Todas', ...new Set(productos.map(p => p.categoria || 'Sin categoría').filter(Boolean))];

  // Filtrar productos
  const productosFiltrados = productos.filter(producto => {
    const coincideFiltro = 
      filtro === '' || 
      (producto.nombre && producto.nombre.toLowerCase().includes(filtro.toLowerCase())) ||
      (producto.barcode && producto.barcode.toLowerCase().includes(filtro.toLowerCase()));
    
    const coincideCategoria = 
      categoriaSeleccionada === 'Todas' || 
      producto.categoria === categoriaSeleccionada;
    
    return coincideFiltro && coincideCategoria;
  });

  // Manejar eliminación
  const handleEliminar = async (id) => {
    if (confirmDelete === id) {
      try {
        await eliminarProducto(id);
        setProductos(productos.filter(p => p.id !== id));
        setConfirmDelete(null);
      } catch (err) {
        console.error('Error al eliminar producto:', err);
        alert('Error al eliminar el producto');
      }
    } else {
      setConfirmDelete(id);
      // Auto-cancelar confirmación después de 3 segundos
      setTimeout(() => {
        setConfirmDelete(null);
      }, 3000);
    }
  };

  // Mostrar detalles del producto
  const mostrarDetalles = (producto) => {
    setProductoSeleccionado(producto);
    setImagePreview(producto.imagenUrl || null);
    setSelectedImage(null);
    setUploadProgress(0);
    setUploadSuccess(false);
  };

  // Cerrar modal de detalles
  const cerrarDetalles = () => {
    setProductoSeleccionado(null);
    setImagePreview(null);
    setSelectedImage(null);
    setUploadProgress(0);
    setUploadSuccess(false);
  };

  // Manejar selección de archivo
  const handleFileSelected = (file) => {
    console.log("Archivo seleccionado:", file.name, "Tamaño:", Math.round(file.size/1024), "KB", "Tipo:", file.type);
    setSelectedImage(file);
    setUploadSuccess(false);
  };

  // Subir imagen del producto
  const handleUploadImage = async () => {
    if (!selectedImage || !productoSeleccionado) return;
    
    try {
      // Reiniciar estados
      setUploadingImage(true);
      setUploadProgress(0);
      setUploadSuccess(false);
      
      console.log("Iniciando subida de imagen para producto:", productoSeleccionado.id);
      console.log("Storage bucket:", storage.app.options.storageBucket);
      
      // Crear una referencia directa a Firebase Storage
      const fileName = `${Date.now()}_${selectedImage.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, `products_planogramas/${productoSeleccionado.id}/${fileName}`);
      
      console.log("Referencia de storage creada:", storageRef.fullPath);
      
      // Iniciar subida directamente con el objeto Storage
      const uploadTask = uploadBytesResumable(storageRef, selectedImage);
      
      // Manejar eventos de la subida directamente
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Actualizar progreso en tiempo real
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          console.log("Progreso de subida directo:", progress, "%");
          setUploadProgress(progress);
        },
        async (error) => {
          // Manejar errores
          console.error("Error al subir la imagen:", error);
          
          // Intento de recuperación
          try {
            console.log("Intentando método alternativo de subida...");
            alert('El método directo falló, intentando método alternativo...');
            
            // Crear un FormData para simular una subida tradicional
            const formData = new FormData();
            formData.append('file', selectedImage);
            
            // Usar fetch para subir a Firebase Storage
            const response = await fetch(`https://firebasestorage.googleapis.com/v0/b/${storage.app.options.storageBucket}/o?name=products_planogramas/${productoSeleccionado.id}/${fileName}`, {
              method: 'POST',
              body: selectedImage,
              headers: {
                'Content-Type': selectedImage.type
              }
            });
            
            if (!response.ok) {
              throw new Error('La subida alternativa también falló');
            }
            
            const data = await response.json();
            const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${storage.app.options.storageBucket}/o/${encodeURIComponent(data.name)}?alt=media`;
            
            // Actualizar Firestore con la URL
            const productoRef = doc(db, "productos", productoSeleccionado.id);
            await updateDoc(productoRef, {
              imagenUrl: downloadURL,
              ultimaModificacion: serverTimestamp()
            });
            
            // Actualizar UI
            setImagePreview(downloadURL);
            setProductoSeleccionado({
              ...productoSeleccionado,
              imagenUrl: downloadURL
            });
            
            // Actualizar lista de productos
            const productosActualizados = productos.map(p => 
              p.id === productoSeleccionado.id 
                ? { ...p, imagenUrl: downloadURL } 
                : p
            );
            setProductos(productosActualizados);
            
            setUploadSuccess(true);
            
          } catch (fallbackError) {
            console.error("Error en método alternativo:", fallbackError);
            alert('Error al subir la imagen: ' + error.message);
          } finally {
            setUploadingImage(false);
          }
        },
        async () => {
          // Subida completada exitosamente
          console.log("¡Subida completa!");
          
          try {
            // Obtener URL de la imagen
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log("URL de imagen:", downloadURL);
            
            // Actualizar el producto en Firestore con la URL de la imagen
            const productoRef = doc(db, "productos", productoSeleccionado.id);
            await updateDoc(productoRef, {
              imagenUrl: downloadURL,
              ultimaModificacion: serverTimestamp()
            });
            
            // Actualizar vista previa y producto seleccionado
            setImagePreview(downloadURL);
            setProductoSeleccionado({
              ...productoSeleccionado,
              imagenUrl: downloadURL
            });
            
            // Actualizar lista de productos
            const productosActualizados = productos.map(p => 
              p.id === productoSeleccionado.id 
                ? { ...p, imagenUrl: downloadURL } 
                : p
            );
            setProductos(productosActualizados);
            
            setUploadSuccess(true);
            console.log("Proceso de subida finalizado con éxito");
          } catch (err) {
            console.error("Error al finalizar proceso:", err);
          } finally {
            setUploadingImage(false);
          }
        }
      );
    } catch (err) {
      console.error('Error general en proceso de subida:', err);
      alert('Error al subir la imagen. Por favor, intenta de nuevo.');
      setUploadingImage(false);
    }
  };

  const navigateToCrearProducto = () => {
    navigate('/productos/nuevo');
  };

  return (
    <div className="layout-container">
      <Sidebar />
      
      <div className="main-content">
        <div className="productos-container">
          <div className="productos-header">
            <h1>Catálogo de Productos</h1>
            <button onClick={navigateToCrearProducto} className="btn btn-primary">
              <i className="fas fa-plus"></i> Nuevo Producto
            </button>
          </div>

          {/* Filtros */}
          <div className="filtros-container">
            <div className="input-group">
              <i className="fas fa-search"></i>
              <input
                type="text"
                placeholder="Buscar por nombre o código de barras..."
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
            </div>

            <div className="select-group">
              <label>Categoría:</label>
              <select
                value={categoriaSeleccionada}
                onChange={(e) => setCategoriaSeleccionada(e.target.value)}
              >
                {categorias.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mensajes de estado */}
          {loading && <div className="loading-message">Cargando productos...</div>}
          {error && <div className="error-message">{error}</div>}
          
          {/* Lista de productos */}
          {!loading && !error && (
            <>
              <div className="productos-stats">
                Mostrando {productosFiltrados.length} de {productos.length} productos
              </div>

              {productosFiltrados.length === 0 ? (
                <div className="no-productos-message">
                  No hay productos que coincidan con los criterios de búsqueda.
                </div>
              ) : (
                <div className="productos-grid">
                  {productosFiltrados.map(producto => (
                    <div key={producto.id} className="producto-card">
                      {/* Si hay imagen, mostrarla, sino mostrar el color */}
                      {producto.imagenUrl ? (
                        <div className="producto-imagen" style={{ backgroundImage: `url(${producto.imagenUrl})` }}></div>
                      ) : (
                        <div className="producto-color" style={{ backgroundColor: producto.color || '#ccc' }}></div>
                      )}
                      <div className="producto-content">
                        <h3>{producto.nombre || 'Sin nombre'}</h3>
                        <p className="producto-barcode">
                          <i className="fas fa-barcode"></i> {producto.barcode || 'Sin código'}
                        </p>
                        <p className="producto-categoria">
                          <i className="fas fa-tag"></i> {producto.categoria || 'Sin categoría'}
                        </p>
                        
                        {producto.dimensiones && (
                          <div className="producto-dimensiones">
                            <i className="fas fa-cube"></i>
                            <span>{producto.dimensiones.ancho}cm × </span>
                            <span>{producto.dimensiones.altura}cm × </span>
                            <span>{producto.dimensiones.profundo}cm</span>
                          </div>
                        )}
                        
                        <div className="producto-acciones">
                          <button 
                            className="btn-action btn-view"
                            onClick={() => mostrarDetalles(producto)}
                            title="Ver detalles"
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                          <Link 
                            to={`/productos/editar/${producto.id}`} 
                            className="btn-action btn-edit"
                            title="Editar producto"
                          >
                            <i className="fas fa-edit"></i>
                          </Link>
                          <button 
                            className={`btn-action ${confirmDelete === producto.id ? 'btn-confirm' : 'btn-delete'}`}
                            onClick={() => handleEliminar(producto.id)}
                            title={confirmDelete === producto.id ? "Confirmar eliminación" : "Eliminar producto"}
                          >
                            <i className={`fas ${confirmDelete === producto.id ? 'fa-check' : 'fa-trash'}`}></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Modal de detalles del producto */}
          {productoSeleccionado && (
            <div className="producto-modal-overlay" onClick={cerrarDetalles}>
              <div className="producto-modal" onClick={e => e.stopPropagation()}>
                <div className="producto-modal-header">
                  <h2>{productoSeleccionado.nombre || 'Detalle del producto'}</h2>
                  <button className="modal-close" onClick={cerrarDetalles}>
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                
                <div className="producto-modal-content">
                  <div className="producto-info">
                    {/* Sección de imagen con opción de subir */}
                    <div className="producto-imagen-container">
                      <h3>Imagen del Producto</h3>
                      <FileUpload
                        onFileChange={handleFileSelected}
                        previewUrl={imagePreview}
                        className="product-image-upload"
                      />
                      
                      {/* Mostrar botón de subir si hay imagen seleccionada */}
                      {selectedImage && (
                        <div className="upload-section">
                          <button 
                            className="btn btn-primary btn-upload"
                            onClick={handleUploadImage}
                            disabled={uploadingImage}
                          >
                            {uploadingImage ? 
                              <><i className="fas fa-spinner fa-spin"></i> Subiendo... {uploadProgress}%</> : 
                              <><i className="fas fa-cloud-upload-alt"></i> Subir Imagen</>
                            }
                          </button>
                          
                          {/* Barra de progreso */}
                          {uploadingImage && (
                            <div className="progress-container">
                              <div 
                                className="progress-bar" 
                                style={{ width: `${uploadProgress}%` }}
                              ></div>
                            </div>
                          )}
                          
                          {/* Mensaje de éxito */}
                          {uploadSuccess && (
                            <div className="success-message">
                              <i className="fas fa-check-circle"></i> Imagen subida con éxito
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="producto-detalles">
                      <div className="detalle-item">
                        <span className="detalle-label"><i className="fas fa-barcode"></i> Código de barras:</span>
                        <span className="detalle-valor">{productoSeleccionado.barcode || 'No disponible'}</span>
                      </div>
                      
                      <div className="detalle-item">
                        <span className="detalle-label"><i className="fas fa-tag"></i> Categoría:</span>
                        <span className="detalle-valor">{productoSeleccionado.categoria || 'Sin categoría'}</span>
                      </div>
                      
                      {productoSeleccionado.dimensiones && (
                        <>
                          <div className="detalle-item">
                            <span className="detalle-label"><i className="fas fa-arrows-alt-v"></i> Altura:</span>
                            <span className="detalle-valor">{productoSeleccionado.dimensiones.altura}cm</span>
                          </div>
                          
                          <div className="detalle-item">
                            <span className="detalle-label"><i className="fas fa-arrows-alt-h"></i> Ancho:</span>
                            <span className="detalle-valor">{productoSeleccionado.dimensiones.ancho}cm</span>
                          </div>
                          
                          <div className="detalle-item">
                            <span className="detalle-label"><i className="fas fa-compress-alt"></i> Profundidad:</span>
                            <span className="detalle-valor">{productoSeleccionado.dimensiones.profundo}cm</span>
                          </div>
                        </>
                      )}
                      
                      <div className="detalle-item">
                        <span className="detalle-label"><i className="fas fa-map-marker-alt"></i> Ubicación:</span>
                        <span className="detalle-valor">
                          {productoSeleccionado.ubicacion ? (
                            <>
                              Frente: {productoSeleccionado.ubicacion.cantidadDeFrente},
                              Charola: {productoSeleccionado.ubicacion.charola},
                              Posición: {productoSeleccionado.ubicacion.posicionEnCharola}
                            </>
                          ) : 'No asignada'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="producto-modal-actions">
                    <Link 
                      to={`/productos/editar/${productoSeleccionado.id}`} 
                      className="btn btn-primary"
                    >
                      <i className="fas fa-edit"></i> Editar Producto
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductosPage; 