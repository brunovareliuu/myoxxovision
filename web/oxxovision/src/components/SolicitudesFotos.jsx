import React, { useState, useEffect } from 'react';
import './SolicitudesFotos.css';
import { getFirestore, collection, addDoc, updateDoc, doc, getDoc, query, where, getDocs, onSnapshot } from 'firebase/firestore';
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

// Función para registrar cuando se recibe una foto
const logFotoRecibida = (solicitud) => {
  console.log(`📸 Nueva foto recibida - ${new Date().toLocaleString()}`);
  console.log(`  • Solicitud: ${solicitud.titulo}`);
  console.log(`  • Planograma: ${solicitud.planogramaNombre}`);
  console.log(`  • Completada por: ${solicitud.completadaPor}`);
  console.log(`  • URL: ${solicitud.fotoUrl.substring(0, 50)}...`);
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
  const [planogramas, setPlanogramas] = useState([]);
  const [cargandoPlanogramas, setCargandoPlanogramas] = useState(false);
  const [mostrarImagenCompleta, setMostrarImagenCompleta] = useState(null);

  // Cargar solicitudes y planogramas al montar el componente
  useEffect(() => {
    const unsubscribe = configurarSolicitudesListener();
    cargarPlanogramas();
    
    // Limpieza al desmontar
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [tiendaId, esAdmin]);

  // Función para configurar el listener de solicitudes
  const configurarSolicitudesListener = () => {
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
      
      // Configurar un listener en lugar de una carga única
      return onSnapshot(solicitudesRef, (snapshot) => {
        const solicitudesData = [];
        const cambios = {
          agregadas: [],
          modificadas: [],
          eliminadas: []
        };
        
        snapshot.docChanges().forEach((change) => {
          const solicitud = {
            id: change.doc.id,
            ...change.doc.data()
          };
          
          if (change.type === 'added') {
            cambios.agregadas.push(solicitud);
          } 
          else if (change.type === 'modified') {
            cambios.modificadas.push(solicitud);
            
            // Verificar si se ha añadido una foto (completada es true y tiene fotoUrl)
            if (solicitud.completada && solicitud.fotoUrl) {
              const solicitudAnterior = solicitudes.find(s => s.id === solicitud.id);
              // Si es una nueva foto o la foto ha cambiado
              if (!solicitudAnterior?.fotoUrl || solicitudAnterior.fotoUrl !== solicitud.fotoUrl) {
                logFotoRecibida(solicitud);
              }
            }
          } 
          else if (change.type === 'removed') {
            cambios.eliminadas.push(solicitud);
          }
        });
        
        // Registrar cambios para debugging
        if (cambios.agregadas.length > 0) {
          console.log(`📩 ${cambios.agregadas.length} solicitudes nuevas recibidas`);
        }
        if (cambios.modificadas.length > 0) {
          console.log(`🔄 ${cambios.modificadas.length} solicitudes actualizadas`);
        }
        
        // Construir la lista actualizada
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
        setLoading(false);
      }, (error) => {
        console.error("Error en el listener de solicitudes:", error);
        setLoading(false);
      });
      
    } catch (error) {
      console.error("Error al configurar listener de solicitudes:", error);
      setLoading(false);
      return null;
    }
  };

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
      
      // Limpiar formulario
      setNuevaSolicitud({
        titulo: '',
        planogramaNombre: '',
        planogramaId: '',
        fechaLimite: '',
        descripcion: ''
      });
      setMostrarFormulario(false);
      
      // No es necesario recargar manualmente, el snapshot listener actualizará automáticamente
      
    } catch (error) {
      console.error("Error al crear solicitud:", error);
      alert("Error al crear la solicitud. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  // Configurar el modal para ver la imagen completa
  const abrirImagenCompleta = (solicitud) => {
    setMostrarImagenCompleta(solicitud);
  };

  return (
    <div className="solicitudes-container">
      <div className="solicitudes-header">
        <h3>Visualización de Fotos de Planogramas</h3>
        
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
      
      {/* Modal para ver imagen completa */}
      {mostrarImagenCompleta && (
        <div className="modal-overlay">
          <div className="modal-content imagen-completa-modal">
            <h4>{mostrarImagenCompleta.titulo}</h4>
            <p>Planograma: {mostrarImagenCompleta.planogramaNombre}</p>
            <div className="imagen-completa-contenedor">
              <img 
                src={mostrarImagenCompleta.fotoUrl} 
                alt="Foto del planograma" 
                />
              </div>
            <div className="detalles-imagen">
              <p>Subida por: {mostrarImagenCompleta.completadaPor || 'No disponible'}</p>
              <p>Fecha: {formatearFecha(mostrarImagenCompleta.fechaCompletada)}</p>
            </div>
              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-btn"
                onClick={() => setMostrarImagenCompleta(null)}
              >
                Cerrar
                </button>
              </div>
          </div>
        </div>
      )}
      
      {/* Lista de solicitudes */}
      {loading ? (
        <div className="loading">Cargando solicitudes...</div>
      ) : solicitudes.length === 0 ? (
        <div className="no-solicitudes">
          <p>No hay solicitudes de fotos disponibles</p>
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
                
                {solicitud.completada && (
                  <div className="solicitud-status">
                    <i className="material-icons">check_circle</i>
                    <span>Completada por {solicitud.completadaPor} el {formatearFecha(solicitud.fechaCompletada)}</span>
                  </div>
                )}
              </div>
              
              {solicitud.fotoUrl && (
                <div className="solicitud-imagen" onClick={() => abrirImagenCompleta(solicitud)}>
                  <img 
                    src={solicitud.fotoUrl} 
                    alt="Foto del planograma" 
                    className={solicitud._pendiente ? 'imagen-pendiente' : ''}
                  />
                  {solicitud._pendiente && (
                    <div className="estado-pendiente">
                      <span className="material-icons">hourglass_top</span>
                      <span>Cargando...</span>
                    </div>
                  )}
                </div>
              )}

              {/* Mostrar placeholder si no hay foto */}
              {!solicitud.fotoUrl && (
                <div className="solicitud-imagen-placeholder">
                  <span className="material-icons">image_not_supported</span>
                  <span>Sin imagen</span>
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