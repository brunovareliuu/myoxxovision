import React, { useState, useEffect } from 'react';
import {
  crearConfiguracionTarea,
  obtenerConfiguracionesTareas,
  eliminarConfiguracionTarea,
  actualizarConfiguracionTarea,
  generarTareasAutomaticas,
  obtenerPlanogramas
} from '../firebase';
import './TaskScheduleConfig.css';

// Constantes - reutilizando las mismas que en TaskCreator
const FRECUENCIAS = [
  { id: 'cada_10_segundos', label: 'Cada 10 segundos (Prueba)' },
  { id: 'diaria', label: 'Diaria' },
  { id: 'semanal', label: 'Semanal' },
  { id: 'quincenal', label: 'Quincenal' },
  { id: 'mensual', label: 'Mensual' }
];

// Turnos disponibles
const TURNOS = [
  { id: 'matutino', label: 'Matutino' },
  { id: 'vespertino', label: 'Vespertino' },
  { id: 'nocturno', label: 'Nocturno' },
  { id: 'todos', label: 'Todos los turnos' }
];

// Opciones de tiempo límite
const TIEMPO_LIMITE_OPCIONES = [
  { id: 'sin_limite', label: 'Sin límite de tiempo' },
  { id: '2h', label: '2 horas' },
  { id: '4h', label: '4 horas' },
  { id: '8h', label: '8 horas' },
  { id: '12h', label: '12 horas' },
  { id: '1d', label: '1 día' },
  { id: '2d', label: '2 días' },
  { id: '3d', label: '3 días' },
  { id: '7d', label: '1 semana' }
];

const TaskScheduleConfig = ({ tiendaId, empleados, onClose }) => {
  // Estado para configuraciones existentes
  const [configuraciones, setConfiguraciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  
  // Estado para edición/creación de configuración
  const [editandoConfig, setEditandoConfig] = useState(false);
  const [configActual, setConfigActual] = useState(null);
  
  // Estado para la nueva configuración
  const [nuevaConfig, setNuevaConfig] = useState({
    plantillaTitulo: '',
    plantillaDescripcion: '',
    frecuencia: 'cada_10_segundos',
    prioridad: 'normal',
    turno: 'matutino',
    requiereFoto: true,
    requiereTexto: true,
    horaInicio: '08:00',
    horaFinalizacion: '20:00',
    asignarA: 'no_agendar',
    tiempoLimite: 'sin_limite',
    planogramaId: '',
    planogramaNombre: ''
  });
  
  // Estado para planogramas
  const [planogramas, setPlanogramas] = useState([]);
  
  // Cargar configuraciones al iniciar
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setCargando(true);
        setError(null);
        
        // Cargar configuraciones existentes
        const configsData = await obtenerConfiguracionesTareas(tiendaId);
        setConfiguraciones(configsData);
        
        // Cargar planogramas
        const planogramasData = await obtenerPlanogramas(tiendaId);
        setPlanogramas(planogramasData || []);
        
      } catch (err) {
        console.error('Error al cargar datos:', err);
        setError('Error al cargar configuraciones: ' + err.message);
      } finally {
        setCargando(false);
      }
    };
    
    cargarDatos();
  }, [tiendaId]);
  
  // Manejar cambios en el formulario
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Si el campo es el selector de planogramas, actualizar también el nombre
    if (name === 'planogramaId' && value) {
      const planogramaSeleccionado = planogramas.find(p => p.id === value);
      
      setNuevaConfig({
        ...nuevaConfig,
        [name]: value,
        planogramaNombre: planogramaSeleccionado ? planogramaSeleccionado.nombre : ''
      });
    } else {
      setNuevaConfig({
        ...nuevaConfig,
        [name]: type === 'checkbox' ? checked : value
      });
    }
  };
  
  // Validar formulario
  const validarFormulario = () => {
    if (!nuevaConfig.plantillaTitulo.trim()) {
      setError('El título de la plantilla es obligatorio');
      return false;
    }
    
    if (!nuevaConfig.plantillaDescripcion.trim()) {
      setError('La descripción de la plantilla es obligatoria');
      return false;
    }
    
    if (!nuevaConfig.horaInicio || !nuevaConfig.horaFinalizacion) {
      setError('La hora de inicio y finalización son obligatorias');
      return false;
    }
    
    // Validar que la hora de inicio es anterior a la de finalización
    const [horaInicio, minutosInicio] = nuevaConfig.horaInicio.split(':').map(Number);
    const [horaFin, minutosFin] = nuevaConfig.horaFinalizacion.split(':').map(Number);
    
    const inicioMinutos = horaInicio * 60 + minutosInicio;
    const finMinutos = horaFin * 60 + minutosFin;
    
    if (inicioMinutos >= finMinutos) {
      setError('La hora de finalización debe ser posterior a la hora de inicio');
      return false;
    }
    
    setError(null);
    return true;
  };
  
  // Guardar configuración
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validarFormulario()) {
      return;
    }
    
    try {
      setCargando(true);
      
      // Si estamos editando, actualizar configuración existente
      if (configActual) {
        await actualizarConfiguracionTarea(tiendaId, configActual.id, nuevaConfig);
      } else {
        // Si no, crear nueva configuración
        await crearConfiguracionTarea(tiendaId, nuevaConfig);
      }
      
      // Recargar configuraciones
      const configsActualizadas = await obtenerConfiguracionesTareas(tiendaId);
      setConfiguraciones(configsActualizadas);
      
      // Resetear formulario
      setEditandoConfig(false);
      setConfigActual(null);
      setNuevaConfig({
        plantillaTitulo: '',
        plantillaDescripcion: '',
        frecuencia: 'cada_10_segundos',
        prioridad: 'normal',
        turno: 'matutino',
        requiereFoto: true,
        requiereTexto: true,
        horaInicio: '08:00',
        horaFinalizacion: '20:00',
        asignarA: 'no_agendar',
        tiempoLimite: 'sin_limite',
        planogramaId: '',
        planogramaNombre: ''
      });
      
    } catch (err) {
      console.error('Error al guardar configuración:', err);
      setError('Error al guardar configuración: ' + err.message);
    } finally {
      setCargando(false);
    }
  };
  
  // Eliminar configuración
  const handleEliminar = async (configId) => {
    if (!window.confirm('¿Está seguro de eliminar esta configuración? Esta acción no se puede deshacer.')) {
      return;
    }
    
    try {
      setCargando(true);
      await eliminarConfiguracionTarea(tiendaId, configId);
      
      // Actualizar lista
      setConfiguraciones(configuraciones.filter(c => c.id !== configId));
      
    } catch (err) {
      console.error('Error al eliminar configuración:', err);
      setError('Error al eliminar configuración: ' + err.message);
    } finally {
      setCargando(false);
    }
  };
  
  // Editar configuración
  const handleEditar = (config) => {
    setConfigActual(config);
    setNuevaConfig({
      ...config,
      // Asegurar que todos los campos necesarios estén presentes
      plantillaTitulo: config.plantillaTitulo || '',
      plantillaDescripcion: config.plantillaDescripcion || '',
      frecuencia: config.frecuencia || 'diaria',
      prioridad: config.prioridad || 'normal',
      turno: config.turno || 'matutino',
      requiereFoto: config.requiereFoto !== false,
      requiereTexto: config.requiereTexto !== false,
      horaInicio: config.horaInicio || '08:00',
      horaFinalizacion: config.horaFinalizacion || '20:00',
      asignarA: config.asignarA || 'no_agendar',
      tiempoLimite: config.tiempoLimite || 'sin_limite',
      planogramaId: config.planogramaId || '',
      planogramaNombre: config.planogramaNombre || ''
    });
    setEditandoConfig(true);
  };
  
  // Ejecutar generación manual de tareas
  const handleGenerarTareas = async () => {
    try {
      setCargando(true);
      const generadas = await generarTareasAutomaticas(tiendaId);
      alert(`Se generaron ${generadas.length} tareas automáticas`);
    } catch (err) {
      console.error('Error al generar tareas:', err);
      setError('Error al generar tareas: ' + err.message);
    } finally {
      setCargando(false);
    }
  };
  
  // Formatear fecha para mostrar
  const formatearFecha = (fechaIso) => {
    if (!fechaIso) return 'Nunca';
    
    try {
      const fecha = new Date(fechaIso);
      return fecha.toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      return 'Fecha inválida';
    }
  };
  
  // Renderizar lista de configuraciones
  const renderConfiguraciones = () => {
    if (configuraciones.length === 0) {
      return (
        <div className="no-configs-message">
          <p>No hay configuraciones de tareas automáticas creadas</p>
          <button 
            className="add-config-button"
            onClick={() => setEditandoConfig(true)}
          >
            <span className="material-icons">add</span>
            Crear configuración
          </button>
        </div>
      );
    }
    
    return (
      <div className="configs-list">
        <div className="configs-header">
          <h3>Configuraciones de tareas automáticas</h3>
          <button 
            className="add-config-button"
            onClick={() => setEditandoConfig(true)}
          >
            <span className="material-icons">add</span>
            Nueva configuración
          </button>
          
          <button 
            className="generate-now-button"
            onClick={handleGenerarTareas}
            disabled={cargando}
          >
            <span className="material-icons">play_circle</span>
            Generar ahora
          </button>
        </div>
        
        <div className="configs-table">
          <table>
            <thead>
              <tr>
                <th>Tarea</th>
                <th>Frecuencia</th>
                <th>Turno</th>
                <th>Horario</th>
                <th>Última generación</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {configuraciones.map(config => (
                <tr key={config.id} className={config.activa ? 'activa' : 'inactiva'}>
                  <td>{config.plantillaTitulo}</td>
                  <td>
                    {FRECUENCIAS.find(f => f.id === config.frecuencia)?.label || config.frecuencia}
                  </td>
                  <td>
                    {TURNOS.find(t => t.id === config.turno)?.label || config.turno}
                  </td>
                  <td>
                    {config.horaInicio || '--'} a {config.horaFinalizacion || '--'}
                  </td>
                  <td>{formatearFecha(config.ultimaEjecucion)}</td>
                  <td className="acciones">
                    <button 
                      className="edit-button"
                      onClick={() => handleEditar(config)}
                      title="Editar"
                    >
                      <span className="material-icons">edit</span>
                    </button>
                    <button 
                      className="delete-button"
                      onClick={() => handleEliminar(config.id)}
                      title="Eliminar"
                    >
                      <span className="material-icons">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  
  // Renderizar formulario de configuración
  const renderFormulario = () => {
    return (
      <div className="config-form-container">
        <h3>{configActual ? 'Editar configuración' : 'Nueva configuración'}</h3>
        
        <form onSubmit={handleSubmit} className="config-form">
          {/* Datos básicos de la tarea */}
          <div className="form-section">
            <h4>Información básica</h4>
            
            <div className="form-group">
              <label htmlFor="plantillaTitulo">
                Título de la tarea <span className="required">*</span>
              </label>
              <input
                type="text"
                id="plantillaTitulo"
                name="plantillaTitulo"
                value={nuevaConfig.plantillaTitulo}
                onChange={handleChange}
                placeholder="Ejemplo: Revisión de refrigeradores"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="plantillaDescripcion">
                Descripción de la tarea <span className="required">*</span>
              </label>
              <textarea
                id="plantillaDescripcion"
                name="plantillaDescripcion"
                value={nuevaConfig.plantillaDescripcion}
                onChange={handleChange}
                placeholder="Instrucciones detalladas sobre cómo realizar la tarea..."
                rows="3"
                required
              ></textarea>
            </div>
            
            <div className="form-row">
              <div className="form-group half">
                <label htmlFor="frecuencia">Frecuencia</label>
                <select
                  id="frecuencia"
                  name="frecuencia"
                  value={nuevaConfig.frecuencia}
                  onChange={handleChange}
                >
                  {FRECUENCIAS.map(freq => (
                    <option key={freq.id} value={freq.id}>{freq.label}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group half">
                <label htmlFor="prioridad">Prioridad</label>
                <select
                  id="prioridad"
                  name="prioridad"
                  value={nuevaConfig.prioridad}
                  onChange={handleChange}
                >
                  <option value="baja">Baja</option>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
            </div>
          </div>
          
          {/* Configuración de horarios */}
          <div className="form-section">
            <h4>Horarios y turnos</h4>
            
            <div className="form-group">
              <label htmlFor="turno">Turno</label>
              <select
                id="turno"
                name="turno"
                value={nuevaConfig.turno}
                onChange={handleChange}
              >
                {TURNOS.map(turno => (
                  <option key={turno.id} value={turno.id}>{turno.label}</option>
                ))}
              </select>
            </div>
            
            <div className="form-row">
              <div className="form-group half">
                <label htmlFor="horaInicio">
                  Hora de creación <span className="required">*</span>
                </label>
                <input
                  type="time"
                  id="horaInicio"
                  name="horaInicio"
                  value={nuevaConfig.horaInicio}
                  onChange={handleChange}
                  required
                />
                <div className="input-help">La tarea se creará a esta hora</div>
              </div>
              
              <div className="form-group half">
                <label htmlFor="horaFinalizacion">
                  Hora límite <span className="required">*</span>
                </label>
                <input
                  type="time"
                  id="horaFinalizacion"
                  name="horaFinalizacion"
                  value={nuevaConfig.horaFinalizacion}
                  onChange={handleChange}
                  required
                />
                <div className="input-help">Plazo máximo para completar la tarea</div>
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="tiempoLimite">Tiempo de ejecución</label>
              <select
                id="tiempoLimite"
                name="tiempoLimite"
                value={nuevaConfig.tiempoLimite}
                onChange={handleChange}
              >
                {TIEMPO_LIMITE_OPCIONES.map(opcion => (
                  <option key={opcion.id} value={opcion.id}>{opcion.label}</option>
                ))}
              </select>
              <div className="input-help">Tiempo estimado para completar la tarea</div>
            </div>
          </div>
          
          {/* Evidencia y asignación */}
          <div className="form-section">
            <h4>Evidencia y asignación</h4>
            
            <div className="form-group">
              <label>Evidencia requerida</label>
              <div className="checkbox-group">
                <div className="checkbox-item">
                  <input
                    type="checkbox"
                    id="requiereFoto"
                    name="requiereFoto"
                    checked={nuevaConfig.requiereFoto}
                    onChange={handleChange}
                  />
                  <label htmlFor="requiereFoto">Foto</label>
                </div>
                
                <div className="checkbox-item">
                  <input
                    type="checkbox"
                    id="requiereTexto"
                    name="requiereTexto"
                    checked={nuevaConfig.requiereTexto}
                    onChange={handleChange}
                  />
                  <label htmlFor="requiereTexto">Reporte de texto</label>
                </div>
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="asignarA">Asignar a</label>
              <select
                id="asignarA"
                name="asignarA"
                value={nuevaConfig.asignarA}
                onChange={handleChange}
              >
                <option value="no_agendar">No agendar - Sin asignación específica</option>
                <option value="cualquiera">Cualquier empleado disponible</option>
                
                {/* Opción para mostrar empleados separados por rol */}
                {empleados && empleados.length > 0 && (
                  <>
                    <optgroup label="Empleados">
                      {empleados.map(empleado => (
                        <option key={empleado.id} value={empleado.id}>
                          {empleado.nombre} ({empleado.rol})
                        </option>
                      ))}
                    </optgroup>
                  </>
                )}
              </select>
            </div>
            
            {/* Planograma asociado */}
            <div className="form-group">
              <label htmlFor="planogramaId">Relacionado con Planograma</label>
              <select
                id="planogramaId"
                name="planogramaId"
                value={nuevaConfig.planogramaId}
                onChange={handleChange}
              >
                <option value="">Sin asociar a planograma</option>
                {planogramas.map(planograma => (
                  <option key={planograma.id} value={planograma.id}>
                    {planograma.nombre || `Planograma ${planograma.id.substring(0, 6)}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Botones de formulario */}
          <div className="form-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={() => {
                setEditandoConfig(false);
                setConfigActual(null);
                setError(null);
              }}
              disabled={cargando}
            >
              Cancelar
            </button>
            
            <button
              type="submit"
              className="submit-button"
              disabled={cargando}
            >
              {cargando ? (
                <>
                  <div className="spinner-small"></div>
                  Guardando...
                </>
              ) : configActual ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    );
  };
  
  return (
    <div className="task-schedule-config-container">
      <div className="header">
        <h2>Configuración de Tareas Automáticas</h2>
        <button className="close-button" onClick={onClose}>
          <span className="material-icons">close</span>
        </button>
      </div>
      
      {error && (
        <div className="error-message">
          <span className="material-icons">error</span>
          {error}
          <button onClick={() => setError(null)}>
            <span className="material-icons">close</span>
          </button>
        </div>
      )}
      
      {cargando && !editandoConfig ? (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Cargando configuraciones...</p>
        </div>
      ) : (
        editandoConfig ? renderFormulario() : renderConfiguraciones()
      )}
    </div>
  );
};

export default TaskScheduleConfig; 