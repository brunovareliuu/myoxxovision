import React, { useState, useEffect } from 'react';
import './SolicitudesFotos.css';
import { getFirestore, collection, addDoc, updateDoc, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Función simple para formatear fecha
const formatearFecha = (fechaISOString) => {
  try {
    if (!fechaISOString) return 'Fecha desconocida';
    
    // Si es un timestamp de Firestore, convertirlo a fecha
    if (fechaISOString.toDate && typeof fechaISOString.toDate === 'function') {
      fechaISOString = fechaISOString.toDate().toISOString();
    }
    
    const fecha = new Date(fechaISOString);
    return fecha.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric'
    });
  } catch (error) {
    return 'Error en fecha';
  }
};

const SolicitudesFotos = ({ tiendaId, esAdmin, usuarioActual }) => {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nuevaSolicitud, setNuevaSolicitud] = useState({
    titulo: '',
    planogramaNombre: '',
    planogramaId: '',
    fechaLimite: '',
    descripcion: ''
  });
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);
  const [solicitudParaResponder, setSolicitudParaResponder] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [planogramas, setPlanogramas] = useState([]);
  const [cargandoPlanogramas, setCargandoPlanogramas] = useState(false);

  // Cargar solicitudes al montar el componente
  useEffect(() => {
    cargarSolicitudes();
    cargarPlanogramas();
  }, [tiendaId]);

  // Función para cargar planogramas de la tienda
  const cargarPlanogramas = async () => {
    try {
      setCargandoPlanogramas(true);
      const db = getFirestore();
      
      // Referencia a planogramas en la tienda
      const planogramasRef = collection(db, `tiendas/${tiendaId}/planogramas`);
      const snapshot = await getDocs(planogramasRef);
      
      const planogramasData = [];
      snapshot.forEach(doc => {
        planogramasData.push({
          id: doc.id,
          nombre: doc.data().nombre || 'Planograma sin nombre',
          ...doc.data()
        });
      });
      
      // Ordenar planogramas por nombre
      planogramasData.sort((a, b) => a.nombre.localeCompare(b.nombre));
      
      setPlanogramas(planogramasData);
      console.log(`Cargados ${planogramasData.length} planogramas`);
    } catch (error) {
      console.error("Error al cargar planogramas:", error);
    } finally {
      setCargandoPlanogramas(false);
    }
  };

  // Función para cargar solicitudes de la tienda desde Firestore
  const cargarSolicitudes = async () => {
    try {
      setLoading(true);
      const db = getFirestore();
      let solicitudesRef;
      
      if (esAdmin) {
        // Administradores ven todas las solicitudes de la tienda
        solicitudesRef = collection(db, `tiendas/${tiendaId}/solicitudes`);
      } else {
        // Empleados ven solicitudes asignadas a ellos o sin asignar
        solicitudesRef = query(
          collection(db, `tiendas/${tiendaId}/solicitudes`),
          where('completada', '==', false)
        );
      }
      
      const snapshot = await getDocs(solicitudesRef);
      
      const solicitudesData = [];
      snapshot.forEach(doc => {
        solicitudesData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Ordenar por fecha límite (las más próximas primero)
      solicitudesData.sort((a, b) => {
        if (!a.fechaLimite) return 1;
        if (!b.fechaLimite) return -1;
        return new Date(a.fechaLimite) - new Date(b.fechaLimite);
      });
      
      setSolicitudes(solicitudesData);
    } catch (error) {
      console.error("Error al cargar solicitudes:", error);
    } finally {
      setLoading(false);
    }
  };

  // Manejar cambios en el formulario
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNuevaSolicitud({
      ...nuevaSolicitud,
      [name]: value
    });
    
    // Si selecciona un planograma, actualizar también el nombre
    if (name === 'planogramaId') {
      const planogramaSeleccionado = planogramas.find(p => p.id === value);
      if (planogramaSeleccionado) {
        setNuevaSolicitud(prev => ({
          ...prev,
          planogramaId: value,
          planogramaNombre: planogramaSeleccionado.nombre || 'Planograma sin nombre'
        }));
      }
    }
  };

  // Manejar selección de archivo
  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setArchivoSeleccionado(e.target.files[0]);
    }
  };

  // Crear nueva solicitud
  const crearSolicitud = async (e) => {
    e.preventDefault();
    try {
      setEnviando(true);
      const db = getFirestore();
      
      // Preparar datos de la solicitud
      const solicitudData = {
        titulo: nuevaSolicitud.titulo,
        planogramaNombre: nuevaSolicitud.planogramaNombre,
        planogramaId: nuevaSolicitud.planogramaId,
        fechaLimite: nuevaSolicitud.fechaLimite,
        descripcion: nuevaSolicitud.descripcion,
        fechaCreacion: new Date(),
        completada: false,
        fotoUrl: '', // Inicializar campo vacío
        creadaPor: usuarioActual?.nombre || 'Administrador',
        usuarioId: usuarioActual?.uid || 'admin'
      };
      
      // Guardar en Firestore
      const docRef = await addDoc(collection(db, `tiendas/${tiendaId}/solicitudes`), solicitudData);
      
      // Limpiar formulario y recargar
      setNuevaSolicitud({
        titulo: '',
        planogramaNombre: '',
        planogramaId: '',
        fechaLimite: '',
        descripcion: ''
      });
      setMostrarFormulario(false);
      cargarSolicitudes();
      
    } catch (error) {
      console.error("Error al crear solicitud:", error);
      alert("Error al crear la solicitud. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  // Responder a una solicitud con foto
  const responderSolicitud = async (e) => {
    e.preventDefault();
    if (!archivoSeleccionado || !solicitudParaResponder) {
      alert("Selecciona un archivo de imagen para subir");
      return;
    }
    
    try {
      setEnviando(true);
      const storage = getStorage();
      const db = getFirestore();
      
      // Crear referencia en Storage
      const storageRef = ref(storage, `tiendas/${tiendaId}/solicitudes/${solicitudParaResponder.id}/${Date.now()}_${archivoSeleccionado.name}`);
      
      // Subir archivo
      await uploadBytes(storageRef, archivoSeleccionado);
      
      // Obtener URL de descarga
      const downloadURL = await getDownloadURL(storageRef);
      
      // Actualizar documento en Firestore
      await updateDoc(doc(db, `tiendas/${tiendaId}/solicitudes/${solicitudParaResponder.id}`), {
        fotoUrl: downloadURL,
        completada: true,
        fechaCompletada: new Date(),
        completadaPor: usuarioActual?.nombre || 'Usuario'
      });
      
      // Limpiar y recargar
      setArchivoSeleccionado(null);
      setSolicitudParaResponder(null);
      cargarSolicitudes();
      
    } catch (error) {
      console.error("Error al responder solicitud:", error);
      alert("Error al subir la imagen. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="solicitudes-container">
      <div className="solicitudes-header">
        <h3>Solicitudes de Fotos de Planogramas</h3>
        
        {esAdmin && (
          <button 
            className="nueva-solicitud-btn"
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
          >
            {mostrarFormulario ? 'Cancelar' : 'Nueva Solicitud'}
          </button>
        )}
      </div>
      
      {/* Formulario para crear nueva solicitud */}
      {mostrarFormulario && (
        <div className="solicitud-form-container">
          <form onSubmit={crearSolicitud} className="solicitud-form">
            <div className="form-group">
              <label>Título:</label>
              <input 
                type="text" 
                name="titulo" 
                value={nuevaSolicitud.titulo} 
                onChange={handleInputChange}
                placeholder="Ej: Verificar planograma de bebidas"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Seleccionar Planograma:</label>
              {cargandoPlanogramas ? (
                <div className="loading-planogramas">Cargando planogramas...</div>
              ) : planogramas.length > 0 ? (
                <select
                  name="planogramaId"
                  value={nuevaSolicitud.planogramaId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">-- Seleccionar planograma --</option>
                  {planogramas.map(planograma => (
                    <option key={planograma.id} value={planograma.id}>
                      {planograma.nombre}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="no-planogramas-warning">
                  No hay planogramas disponibles. 
                  <input 
                    type="text" 
                    name="planogramaNombre" 
                    value={nuevaSolicitud.planogramaNombre} 
                    onChange={handleInputChange}
                    placeholder="Escribe manualmente el nombre del planograma"
                    required
                  />
                </div>
              )}
            </div>
            
            <div className="form-group">
              <label>Fecha Límite:</label>
              <input 
                type="date" 
                name="fechaLimite" 
                value={nuevaSolicitud.fechaLimite} 
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Descripción:</label>
              <textarea 
                name="descripcion" 
                value={nuevaSolicitud.descripcion} 
                onChange={handleInputChange}
                placeholder="Proporciona instrucciones detalladas sobre qué necesitas verificar en este planograma"
              />
            </div>
            
            <button 
              type="submit" 
              className="submit-btn"
              disabled={enviando}
            >
              {enviando ? 'Creando...' : 'Crear Solicitud'}
            </button>
          </form>
        </div>
      )}
      
      {/* Modal para responder solicitud */}
      {solicitudParaResponder && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h4>Responder Solicitud</h4>
            <p><strong>{solicitudParaResponder.titulo}</strong></p>
            <p>Planograma: {solicitudParaResponder.planogramaNombre}</p>
            
            <form onSubmit={responderSolicitud} className="respuesta-form">
              <div className="form-group">
                <label>Seleccionar Foto:</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange}
                  required
                />
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => setSolicitudParaResponder(null)}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="submit-btn"
                  disabled={enviando}
                >
                  {enviando ? 'Subiendo...' : 'Subir Foto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Lista de solicitudes */}
      {loading ? (
        <div className="loading">Cargando solicitudes...</div>
      ) : solicitudes.length === 0 ? (
        <div className="no-solicitudes">
          <p>No hay solicitudes de fotos pendientes</p>
        </div>
      ) : (
        <div className="solicitudes-list">
          {solicitudes.map(solicitud => (
            <div key={solicitud.id} className={`solicitud-item ${solicitud.completada ? 'completada' : 'pendiente'}`}>
              <div className="solicitud-info">
                <h4>{solicitud.titulo}</h4>
                
                <div className="solicitud-details">
                  <div className="solicitud-detail">
                    <i className="material-icons">view_in_ar</i>
                    <span>{solicitud.planogramaNombre}</span>
                  </div>
                  
                  <div className="solicitud-detail">
                    <i className="material-icons">event</i>
                    <span>Fecha límite: {formatearFecha(solicitud.fechaLimite)}</span>
                  </div>
                  
                  <div className="solicitud-detail">
                    <i className="material-icons">person</i>
                    <span>Solicitado por: {solicitud.creadaPor}</span>
                  </div>
                </div>
                
                {solicitud.descripcion && (
                  <p className="solicitud-descripcion">{solicitud.descripcion}</p>
                )}
                
                {!solicitud.completada && !esAdmin && (
                  <button 
                    className="responder-btn"
                    onClick={() => setSolicitudParaResponder(solicitud)}
                  >
                    Subir Foto
                  </button>
                )}
                
                {solicitud.completada && (
                  <div className="solicitud-status">
                    <i className="material-icons">check_circle</i>
                    <span>Completada por {solicitud.completadaPor} el {formatearFecha(solicitud.fechaCompletada)}</span>
                  </div>
                )}
              </div>
              
              {solicitud.fotoUrl && (
                <div className="solicitud-imagen">
                  <a href={solicitud.fotoUrl} target="_blank" rel="noopener noreferrer">
                    <img src={solicitud.fotoUrl} alt="Foto del planograma" />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SolicitudesFotos; 