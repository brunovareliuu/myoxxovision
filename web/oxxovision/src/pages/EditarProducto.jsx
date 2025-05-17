import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { obtenerProducto, guardarProducto } from '../firebase';
import Sidebar from '../components/Sidebar';
import FileUpload from '../components/FileUpload';
import './EditarProducto.css';

const EditarProducto = () => {
  const { productoId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  // Estado para el formulario
  const [formData, setFormData] = useState({
    nombre: '',
    barcode: '',
    categoria: '',
    color: '#cccccc',
    dimensiones: {
      altura: '',
      ancho: '',
      profundo: ''
    },
    ubicacion: {
      cantidadDeFrente: '',
      charola: '',
      posicionEnCharola: ''
    }
  });
  
  // Estado para el archivo de imagen
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  
  // Estados para mostrar mensajes y controlar carga
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // Determinar si estamos editando o creando
  const isEditing = !!productoId;
  
  // Escuchar el evento de progreso de subida
  useEffect(() => {
    // Configurar el listener para el evento de progreso
    const progressHandler = (event) => {
      if (event.detail && typeof event.detail.progress === 'number') {
        setUploadProgress(event.detail.progress);
      }
    };
    
    // Agregar el event listener
    window.addEventListener('upload-progress', progressHandler);
    
    // Limpieza
    return () => {
      window.removeEventListener('upload-progress', progressHandler);
    };
  }, []);
  
  // Cargar datos del producto si estamos editando
  useEffect(() => {
    const cargarProducto = async () => {
      if (!isEditing) return; // No cargar si estamos creando
      
      try {
        setLoading(true);
        const productoData = await obtenerProducto(productoId);
        
        if (productoData) {
          // Asegurarnos que los objetos anidados existan
          if (!productoData.dimensiones) {
            productoData.dimensiones = { altura: '', ancho: '', profundo: '' };
          }
          
          if (!productoData.ubicacion) {
            productoData.ubicacion = { cantidadDeFrente: '', charola: '', posicionEnCharola: '' };
          }
          
          setFormData(productoData);
          
          // Si hay imagen, mostrar la vista previa
          if (productoData.imagenUrl) {
            setImagePreview(productoData.imagenUrl);
          }
        } else {
          setError('No se pudo encontrar el producto.');
          // Redirigir después de un breve retraso
          setTimeout(() => navigate('/productos'), 3000);
        }
      } catch (err) {
        console.error('Error al cargar producto:', err);
        setError('Error al cargar los datos del producto.');
      } finally {
        setLoading(false);
      }
    };
    
    cargarProducto();
  }, [productoId, isEditing, navigate]);
  
  // Manejar cambios en campos de texto
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Manejar campos anidados (dimensiones, ubicación)
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  // Manejar carga de imagen usando el nuevo componente FileUpload
  const handleFileSelected = (file) => {
    // Resetear errores previos
    setError(null);
    
    // Validar tipo y tamaño
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (!validTypes.includes(file.type)) {
      setError(`Tipo de archivo no válido: ${file.type}. Usa JPG, PNG, GIF o WEBP.`);
      return;
    }
    
    if (file.size > maxSize) {
      setError(`La imagen es demasiado grande: ${(file.size / (1024 * 1024)).toFixed(2)}MB. Máximo 5MB.`);
      return;
    }
    
    // Guardar el archivo para subirlo más tarde
    setImageFile(file);
    console.log("Imagen seleccionada:", file.name, "Tipo:", file.type, "Tamaño:", (file.size / 1024).toFixed(2), "KB");
  };
  
  // Eliminar la imagen
  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview('');
    setUploadProgress(0);
  };
  
  // Guardar el producto
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Iniciar proceso de guardado
      setSaving(true);
      setError(null);
      setSuccess(false);
      setUploadProgress(0);
      
      console.log("Iniciando proceso de guardado de producto");
      
      // Validar campos requeridos
      if (!formData.nombre || !formData.barcode) {
        setError('El nombre y código de barras son requeridos.');
        setSaving(false);
        return;
      }
      
      // Convertir valores numéricos
      const dataToSave = {
        ...formData,
        dimensiones: {
          altura: parseFloat(formData.dimensiones.altura) || 0,
          ancho: parseFloat(formData.dimensiones.ancho) || 0,
          profundo: parseFloat(formData.dimensiones.profundo) || 0
        },
        ubicacion: {
          cantidadDeFrente: parseInt(formData.ubicacion.cantidadDeFrente) || 0,
          charola: formData.ubicacion.charola || '',
          posicionEnCharola: parseInt(formData.ubicacion.posicionEnCharola) || 0
        }
      };
      
      console.log("Datos preparados para guardar:", 
                  isEditing ? `Actualizando producto ${productoId}` : "Nuevo producto",
                  "Contiene imagen:", !!imageFile);
      
      // Configurar listener para progreso
      const progressListener = (progress) => {
        setUploadProgress(progress);
      };
      
      // Registrar la función en el window para que firebase.js pueda actualizar el progreso
      window.uploadProgressCallback = progressListener;
      
      // Guardar en Firestore, pasando el archivo de imagen si existe
      const productoGuardadoId = await guardarProducto(
        dataToSave, 
        isEditing ? productoId : null, 
        imageFile
      );
      
      // Limpiar callback
      window.uploadProgressCallback = null;
      
      console.log("Producto guardado exitosamente con ID:", productoGuardadoId);
      
      // Mostrar mensaje de éxito
      setSuccess(true);
      
      // Redirigir después de un breve retraso
      setTimeout(() => {
        console.log("Redirigiendo a lista de productos");
        navigate('/productos');
      }, 1500);
      
    } catch (err) {
      console.error("Error al guardar producto:", err);
      setError(`Error al guardar el producto: ${err.message || 'Inténtalo de nuevo.'}`);
      setSaving(false);
      // Limpiar callback en caso de error
      window.uploadProgressCallback = null;
    }
  };
  
  // Cancelar y volver a la lista
  const handleCancel = () => {
    navigate('/productos');
  };
  
  if (loading) {
    return (
      <div className="layout-container">
        <Sidebar />
        <div className="main-content">
          <div className="editar-producto-container">
            <div className="loading-message">Cargando datos del producto...</div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="layout-container">
      <Sidebar />
      <div className="main-content">
        <div className="editar-producto-container">
          <div className="editar-producto-header">
            <h1>{isEditing ? 'Editar Producto' : 'Nuevo Producto'}</h1>
            <div className="header-actions">
              <button 
                className="btn btn-secondary" 
                onClick={handleCancel}
                disabled={saving}
              >
                <i className="fas fa-times"></i> Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleSubmit}
                disabled={saving}
              >
                <i className="fas fa-save"></i> {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">¡Producto guardado correctamente!</div>}
          
          {saving && (
            <div className="saving-indicator">
              <div className="saving-message">
                <i className="fas fa-spinner fa-spin"></i> 
                Guardando producto... {uploadProgress > 0 ? `Subiendo imagen: ${uploadProgress.toFixed(0)}%` : ''}
              </div>
              {uploadProgress > 0 && (
                <div className="progress-bar-container">
                  <div 
                    className="progress-bar" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              )}
            </div>
          )}
          
          <form className="producto-form" onSubmit={handleSubmit}>
            <div className="form-columns">
              <div className="form-left-column">
                {/* Información básica */}
                <div className="form-section">
                  <h3><i className="fas fa-info-circle"></i> Información Básica</h3>
                  
                  <div className="form-group">
                    <label htmlFor="nombre">Nombre del Producto *</label>
                    <input
                      type="text"
                      id="nombre"
                      name="nombre"
                      value={formData.nombre}
                      onChange={handleInputChange}
                      required
                      placeholder="Ej: Coca-Cola 600ml"
                      disabled={saving}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="barcode">Código de Barras *</label>
                    <input
                      type="text"
                      id="barcode"
                      name="barcode"
                      value={formData.barcode}
                      onChange={handleInputChange}
                      required
                      placeholder="Ej: 7501055310142"
                      disabled={saving}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="categoria">Categoría</label>
                    <input
                      type="text"
                      id="categoria"
                      name="categoria"
                      value={formData.categoria}
                      onChange={handleInputChange}
                      placeholder="Ej: Bebidas, Snacks, Lácteos"
                      disabled={saving}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="color">Color para visualización</label>
                    <div className="color-input-container">
                      <input
                        type="color"
                        id="color"
                        name="color"
                        value={formData.color}
                        onChange={handleInputChange}
                        disabled={saving}
                      />
                      <span className="color-value">{formData.color}</span>
                    </div>
                  </div>
                </div>
                
                {/* Dimensiones */}
                <div className="form-section">
                  <h3><i className="fas fa-cube"></i> Dimensiones</h3>
                  
                  <div className="form-row">
                    <div className="form-group half">
                      <label htmlFor="dimensiones.altura">Altura (cm)</label>
                      <input
                        type="number"
                        id="dimensiones.altura"
                        name="dimensiones.altura"
                        min="0"
                        step="0.1"
                        value={formData.dimensiones.altura}
                        onChange={handleInputChange}
                        placeholder="Ej: 20.5"
                        disabled={saving}
                      />
                    </div>
                    
                    <div className="form-group half">
                      <label htmlFor="dimensiones.ancho">Ancho (cm)</label>
                      <input
                        type="number"
                        id="dimensiones.ancho"
                        name="dimensiones.ancho"
                        min="0"
                        step="0.1"
                        value={formData.dimensiones.ancho}
                        onChange={handleInputChange}
                        placeholder="Ej: 10.3"
                        disabled={saving}
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="dimensiones.profundo">Profundidad (cm)</label>
                    <input
                      type="number"
                      id="dimensiones.profundo"
                      name="dimensiones.profundo"
                      min="0"
                      step="0.1"
                      value={formData.dimensiones.profundo}
                      onChange={handleInputChange}
                      placeholder="Ej: 5.8"
                      disabled={saving}
                    />
                  </div>
                </div>
                
                {/* Ubicación en estante */}
                <div className="form-section">
                  <h3><i className="fas fa-map-marker-alt"></i> Ubicación Estándar</h3>
                  
                  <div className="form-group">
                    <label htmlFor="ubicacion.cantidadDeFrente">Cantidad de Frente</label>
                    <input
                      type="number"
                      id="ubicacion.cantidadDeFrente"
                      name="ubicacion.cantidadDeFrente"
                      min="0"
                      value={formData.ubicacion.cantidadDeFrente}
                      onChange={handleInputChange}
                      placeholder="Ej: 3"
                      disabled={saving}
                    />
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group half">
                      <label htmlFor="ubicacion.charola">Charola</label>
                      <input
                        type="text"
                        id="ubicacion.charola"
                        name="ubicacion.charola"
                        value={formData.ubicacion.charola}
                        onChange={handleInputChange}
                        placeholder="Ej: A2"
                        disabled={saving}
                      />
                    </div>
                    
                    <div className="form-group half">
                      <label htmlFor="ubicacion.posicionEnCharola">Posición</label>
                      <input
                        type="number"
                        id="ubicacion.posicionEnCharola"
                        name="ubicacion.posicionEnCharola"
                        min="0"
                        value={formData.ubicacion.posicionEnCharola}
                        onChange={handleInputChange}
                        placeholder="Ej: 1"
                        disabled={saving}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="form-right-column">
                {/* Imagen del producto */}
                <div className="form-section image-section">
                  <h3><i className="fas fa-image"></i> Imagen del Producto</h3>
                  
                  <div className="product-image-upload-container">
                    <FileUpload
                      onFileChange={handleFileSelected}
                      previewUrl={imagePreview}
                      className="product-form-image-upload"
                    />
                    
                    {(imagePreview || imageFile) && (
                      <button 
                        type="button" 
                        className="remove-image-btn"
                        onClick={handleRemoveImage}
                        disabled={saving}
                      >
                        <i className="fas fa-trash"></i> Eliminar imagen
                      </button>
                    )}
                    
                    <p className="file-requirements">
                      Formatos: JPG, PNG, GIF, WEBP (Máx. 5MB)
                    </p>
                  </div>
                </div>
                
                {/* Vista previa del producto */}
                <div className="form-section preview-section">
                  <h3><i className="fas fa-eye"></i> Vista Previa del Producto</h3>
                  
                  <div className="product-preview-card">
                    {imagePreview || imageFile ? (
                      <div className="preview-image" style={{ backgroundImage: `url(${imagePreview || (imageFile ? URL.createObjectURL(imageFile) : '')})` }}></div>
                    ) : (
                      <div className="preview-color" style={{ backgroundColor: formData.color }}></div>
                    )}
                    <div className="preview-content">
                      <h4>{formData.nombre || 'Nombre del producto'}</h4>
                      <p className="preview-barcode">
                        <i className="fas fa-barcode"></i> {formData.barcode || 'Código de barras'}
                      </p>
                      {formData.categoria && (
                        <p className="preview-categoria">
                          <i className="fas fa-tag"></i> {formData.categoria}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="form-actions">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleCancel}
                disabled={saving}
              >
                <i className="fas fa-times"></i> Cancelar
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={saving}
              >
                <i className="fas fa-save"></i> {saving ? 'Guardando...' : 'Guardar Producto'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditarProducto; 