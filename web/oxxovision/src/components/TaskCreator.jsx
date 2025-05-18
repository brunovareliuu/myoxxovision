import React, { useState, useEffect } from 'react';
import { obtenerPlanogramas } from '../firebase';
import './TaskCreator.css';

// Frecuencias predefinidas para tareas recurrentes
const FRECUENCIAS = [
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

// Mapa para mostrar roles en español
const ROLES_LABELS = {
  'admin': 'Administrador',
  'gerente': 'Gerente',
  'supervisor': 'Supervisor',
  'usuario': 'Empleado',
  'empleado': 'Empleado'
};

const TaskCreator = ({ tiendaId, empleados, onCrearTarea, onCancel }) => {
  // Estado inicial para una nueva tarea
  const [nuevaTarea, setNuevaTarea] = useState({
    titulo: '',
    descripcion: '',
    frecuencia: 'diaria',
    prioridad: 'normal',
    requiereFoto: true,
    requiereTexto: true,
    asignarA: 'no_agendar',
    turno: 'todos',
    planogramaId: '',
    planogramaNombre: '',
    tiempoLimite: 'sin_limite'
  });

  // Estado para planogramas de la tienda
  const [planogramas, setPlanogramas] = useState([]);
  const [cargandoPlanogramas, setCargandoPlanogramas] = useState(false);

  // Estado para empleados organizados por rol
  const [empleadosPorRol, setEmpleadosPorRol] = useState({
    gerentes: [],
    supervisores: [],
    empleados: []
  });

  // Cargar planogramas de la tienda
  useEffect(() => {
    const cargarPlanogramas = async () => {
      try {
        setCargandoPlanogramas(true);
        // Obtener planogramas de la tienda desde Firebase
        const planogramasData = await obtenerPlanogramas(tiendaId);
        console.log('Planogramas cargados:', planogramasData);
        setPlanogramas(planogramasData || []);
      } catch (error) {
        console.error('Error al cargar planogramas:', error);
      } finally {
        setCargandoPlanogramas(false);
      }
    };

    if (tiendaId) {
      cargarPlanogramas();
    }
  }, [tiendaId]);

  // Organizar empleados por rol al cargar el componente
  useEffect(() => {
    const organizarEmpleados = () => {
      const porRol = {
        gerentes: [],
        supervisores: [],
        empleados: []
      };

      if (empleados && Array.isArray(empleados)) {
        empleados.forEach(emp => {
          if (!emp) return;
          
          if (emp.rol === 'gerente' || emp.rol === 'admin') {
            porRol.gerentes.push(emp);
          } else if (emp.rol === 'supervisor') {
            porRol.supervisores.push(emp);
          } else {
            porRol.empleados.push(emp);
          }
        });
      }

      console.log('Empleados organizados por rol:', porRol);
      setEmpleadosPorRol(porRol);
    };

    organizarEmpleados();
  }, [empleados]);

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Manejar cambios en los campos del formulario
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Si el campo es el selector de planogramas, actualizar también el nombre
    if (name === 'planogramaId' && value) {
      const planogramaSeleccionado = planogramas.find(p => p.id === value);
      
      setNuevaTarea({
        ...nuevaTarea,
        [name]: value,
        planogramaNombre: planogramaSeleccionado ? planogramaSeleccionado.nombre : ''
      });
    } else {
      setNuevaTarea({
        ...nuevaTarea,
        [name]: type === 'checkbox' ? checked : value
      });
    }

    // Limpiar error del campo modificado
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: null
      });
    }
  };

  // Validar formulario antes de enviar
  const validarFormulario = () => {
    const nuevoErrors = {};

    if (!nuevaTarea.titulo.trim()) {
      nuevoErrors.titulo = 'El título es obligatorio';
    }

    if (!nuevaTarea.descripcion.trim()) {
      nuevoErrors.descripcion = 'La descripción es obligatoria';
    }

    if (!nuevaTarea.requiereFoto && !nuevaTarea.requiereTexto) {
      nuevoErrors.evidencia = 'Debe requerir al menos un tipo de evidencia';
    }

    setErrors(nuevoErrors);
    return Object.keys(nuevoErrors).length === 0;
  };

  // Enviar el formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validarFormulario()) {
      return;
    }

    setIsLoading(true);
    
    try {
      // Preparar objeto de tarea
      const tareaNueva = {
        ...nuevaTarea,
        tiendaId,
        fechaCreacion: new Date().toISOString(),
        activa: true
      };
      
      // Si se seleccionó un empleado específico, buscar su nombre para guardarlo también
      if (tareaNueva.asignarA !== 'no_agendar' && tareaNueva.asignarA !== 'cualquiera') {
        const empleadoSeleccionado = empleados.find(emp => emp.id === tareaNueva.asignarA);
        if (empleadoSeleccionado) {
          tareaNueva.asignarNombre = empleadoSeleccionado.nombre;
          tareaNueva.asignarRol = empleadoSeleccionado.rol;
        }
      }
      
      // Si se seleccionó un planograma, guardar su información
      if (tareaNueva.planogramaId) {
        const planogramaSeleccionado = planogramas.find(p => p.id === tareaNueva.planogramaId);
        if (planogramaSeleccionado) {
          tareaNueva.planogramaNombre = planogramaSeleccionado.nombre || 'Planograma sin nombre';
        }
      }
      
      // Calcular fecha límite si se especificó un tiempo límite
      if (tareaNueva.tiempoLimite !== 'sin_limite') {
        const ahora = new Date();
        let fechaLimite = new Date(ahora);
        
        const cantidad = parseInt(tareaNueva.tiempoLimite.slice(0, -1));
        const unidad = tareaNueva.tiempoLimite.slice(-1);
        
        if (unidad === 'h') {
          fechaLimite.setHours(fechaLimite.getHours() + cantidad);
        } else if (unidad === 'd') {
          fechaLimite.setDate(fechaLimite.getDate() + cantidad);
        }
        
        tareaNueva.fechaLimite = fechaLimite.toISOString();
      }
      
      console.log('Creando tarea con datos:', tareaNueva);
      
      // Llamar a la función de creación
      const resultado = await onCrearTarea(tareaNueva);
      
      if (resultado) {
        // Resetear formulario
        setNuevaTarea({
          titulo: '',
          descripcion: '',
          frecuencia: 'diaria',
          prioridad: 'normal',
          requiereFoto: true,
          requiereTexto: true,
          asignarA: 'no_agendar',
          turno: 'todos',
          planogramaId: '',
          planogramaNombre: '',
          tiempoLimite: 'sin_limite'
        });
      }
    } catch (error) {
      console.error('Error al crear tarea:', error);
      setErrors({
        general: `Error al crear la tarea: ${error.message}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="task-creator-container">
      <h2>Crear Nueva Tarea Recurrente</h2>
      
      {errors.general && (
        <div className="error-message general-error">
          <span className="material-icons">error</span>
          {errors.general}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="task-form">
        {/* Título */}
        <div className="form-group">
          <label htmlFor="titulo">
            Título <span className="required">*</span>
          </label>
          <input
            type="text"
            id="titulo"
            name="titulo"
            value={nuevaTarea.titulo}
            onChange={handleChange}
            placeholder="Ejemplo: Verificar fechas de caducidad"
            className={errors.titulo ? 'error' : ''}
          />
          {errors.titulo && <div className="error-text">{errors.titulo}</div>}
        </div>
        
        {/* Descripción */}
        <div className="form-group">
          <label htmlFor="descripcion">
            Descripción <span className="required">*</span>
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            value={nuevaTarea.descripcion}
            onChange={handleChange}
            placeholder="Instrucciones detalladas sobre cómo realizar la tarea..."
            rows="4"
            className={errors.descripcion ? 'error' : ''}
          ></textarea>
          {errors.descripcion && <div className="error-text">{errors.descripcion}</div>}
        </div>
        
        {/* Planograma */}
        <div className="form-group">
          <label htmlFor="planogramaId">Relacionado con Planograma</label>
          <select
            id="planogramaId"
            name="planogramaId"
            value={nuevaTarea.planogramaId}
            onChange={handleChange}
          >
            <option value="">Sin asociar a planograma</option>
            {planogramas.map(planograma => (
              <option key={planograma.id} value={planograma.id}>
                {planograma.nombre || `Planograma ${planograma.id.substring(0, 6)}`}
              </option>
            ))}
          </select>
          {cargandoPlanogramas && <div className="info-text">Cargando planogramas...</div>}
        </div>
        
        {/* Frecuencia y Prioridad */}
        <div className="form-row">
          <div className="form-group half">
            <label htmlFor="frecuencia">Frecuencia</label>
            <select
              id="frecuencia"
              name="frecuencia"
              value={nuevaTarea.frecuencia}
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
              value={nuevaTarea.prioridad}
              onChange={handleChange}
            >
              <option value="baja">Baja</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
        </div>
        
        {/* Tiempo Límite y Turno */}
        <div className="form-row">
          <div className="form-group half">
            <label htmlFor="tiempoLimite">Tiempo Límite</label>
            <select
              id="tiempoLimite"
              name="tiempoLimite"
              value={nuevaTarea.tiempoLimite}
              onChange={handleChange}
            >
              {TIEMPO_LIMITE_OPCIONES.map(opcion => (
                <option key={opcion.id} value={opcion.id}>{opcion.label}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group half">
            <label htmlFor="turno">Turno</label>
            <select
              id="turno"
              name="turno"
              value={nuevaTarea.turno}
              onChange={handleChange}
            >
              {TURNOS.map(turno => (
                <option key={turno.id} value={turno.id}>{turno.label}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Asignar a */}
        <div className="form-group">
          <label htmlFor="asignarA">Asignar a</label>
          <select
            id="asignarA"
            name="asignarA"
            value={nuevaTarea.asignarA}
            onChange={handleChange}
            className="employee-select"
          >
            <option value="no_agendar">No agendar - Sin asignación específica</option>
            <option value="cualquiera">Cualquier empleado disponible</option>
            
            {/* Mostrar gerentes si hay */}
            {empleadosPorRol.gerentes.length > 0 && (
              <optgroup label="Gerentes">
                {empleadosPorRol.gerentes.map(empleado => (
                  <option key={empleado.id} value={empleado.id}>
                    {empleado.nombre} ({ROLES_LABELS[empleado.rol] || 'Gerente'})
                  </option>
                ))}
              </optgroup>
            )}
            
            {/* Mostrar supervisores si hay */}
            {empleadosPorRol.supervisores.length > 0 && (
              <optgroup label="Supervisores">
                {empleadosPorRol.supervisores.map(empleado => (
                  <option key={empleado.id} value={empleado.id}>
                    {empleado.nombre} ({ROLES_LABELS[empleado.rol] || 'Supervisor'})
                  </option>
                ))}
              </optgroup>
            )}
            
            {/* Mostrar empleados regulares si hay */}
            {empleadosPorRol.empleados.length > 0 && (
              <optgroup label="Empleados">
                {empleadosPorRol.empleados.map(empleado => (
                  <option key={empleado.id} value={empleado.id}>
                    {empleado.nombre} ({ROLES_LABELS[empleado.rol] || 'Empleado'})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        
        {/* Requisitos de evidencia */}
        <div className="form-group">
          <label>Evidencia requerida</label>
          <div className="checkbox-group">
            <div className="checkbox-item">
              <input
                type="checkbox"
                id="requiereFoto"
                name="requiereFoto"
                checked={nuevaTarea.requiereFoto}
                onChange={handleChange}
              />
              <label htmlFor="requiereFoto">Foto</label>
            </div>
            
            <div className="checkbox-item">
              <input
                type="checkbox"
                id="requiereTexto"
                name="requiereTexto"
                checked={nuevaTarea.requiereTexto}
                onChange={handleChange}
              />
              <label htmlFor="requiereTexto">Reporte de texto</label>
            </div>
          </div>
          {errors.evidencia && (
            <div className="error-text">{errors.evidencia}</div>
          )}
        </div>
        
        {/* Botones */}
        <div className="form-actions">
          <button 
            type="button" 
            className="cancel-button"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            className="submit-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="spinner-small"></div>
                Creando...
              </>
            ) : 'Crear Tarea'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TaskCreator; 