import React, { useState } from 'react';
import TaskItem from './TaskItem';
import './TaskManager.css';
import { actualizarEstadoTarea } from '../firebase';

const TaskManager = ({ 
  tareas, 
  empleados, 
  tiendaId, 
  onCompletarTarea, 
  onEliminarTarea, 
  isAdmin,
  userId
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState('todas');
  const [filterFrequency, setFilterFrequency] = useState('todas');
  const [showCompletarModal, setShowCompletarModal] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const [evidencia, setEvidencia] = useState({
    texto: '',
    foto: null,
    fotoUrl: '',
    evidenceUrlPic: '', // Campo para la referencia de almacenamiento
    responsable: userId,
    turno: 'matutino'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Filtrar tareas según los criterios
  const tareasFiltradas = tareas.filter(tarea => {
    // Búsqueda por texto
    const matchesSearch = 
      !searchTerm || 
      tarea.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tarea.descripcion.toLowerCase().includes(searchTerm.toLowerCase());

    // Filtro por prioridad
    const matchesPriority = 
      filterPriority === 'todas' || 
      tarea.prioridad === filterPriority;

    // Filtro por frecuencia
    const matchesFrequency = 
      filterFrequency === 'todas' || 
      tarea.frecuencia === filterFrequency;

    return matchesSearch && matchesPriority && matchesFrequency;
  });

  // Ordenar tareas por prioridad
  const tareasPriorizadas = [...tareasFiltradas].sort((a, b) => {
    const prioridadOrden = {
      'urgente': 0,
      'alta': 1,
      'normal': 2,
      'baja': 3
    };

    return prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad];
  });

  // Manejar clic en completar tarea
  const handleCompletarClick = (tarea) => {
    setCurrentTask(tarea);
    setEvidencia({
      texto: '',
      foto: null,
      fotoUrl: '',
      evidenceUrlPic: '',
      responsable: userId,
      turno: 'matutino'
    });
    setErrors({});
    setShowCompletarModal(true);
  };

  // Manejar cambios en el formulario de evidencia
  const handleEvidenciaChange = (e) => {
    const { name, value } = e.target;
    setEvidencia({
      ...evidencia,
      [name]: value
    });

    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: null
      });
    }
  };

  // Manejar selección de imagen
  const handleImageChange = (e) => {
    const file = e.target.files[0];

    if (file) {
      // Validar que sea una imagen
      if (!file.type.startsWith('image/')) {
        setErrors({
          ...errors,
          foto: 'El archivo debe ser una imagen (JPG, PNG, etc.)'
        });
        return;
      }

      // Verificar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors({
          ...errors,
          foto: 'La imagen no puede ser mayor a 5MB'
        });
        return;
      }

      // Crear vista previa
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        setEvidencia({
          ...evidencia,
          foto: file,
          fotoUrl: readerEvent.target.result
        });
      };
      
      reader.readAsDataURL(file);
      
      // Limpiar error si existía
      if (errors.foto) {
        setErrors({
          ...errors,
          foto: null
        });
      }
    }
  };

  // Validar formulario
  const validarFormulario = () => {
    const nuevosErrors = {};
    
    // Verificar que hay texto si la tarea lo requiere
    if (currentTask?.requiereTexto && !evidencia.texto.trim()) {
      nuevosErrors.texto = 'El reporte de texto es obligatorio para esta tarea';
    }
    
    // Verificar que hay foto si la tarea lo requiere
    if (currentTask?.requiereFoto && !evidencia.foto) {
      nuevosErrors.foto = 'Se requiere adjuntar una foto para esta tarea';
    }
    
    setErrors(nuevosErrors);
    return Object.keys(nuevosErrors).length === 0;
  };

  // Enviar evidencia de tarea completada
  const handleSubmitEvidencia = async (e) => {
    e.preventDefault();
    
    if (!validarFormulario()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Preparar objeto con datos de tarea completada
      const datosCompletada = {
        ...evidencia,
        fechaCompletada: new Date().toISOString(),
        tareaId: currentTask.id,
        tituloTarea: currentTask.titulo,
        empleadoId: userId,
        tiendaId: tiendaId
      };
      
      // Llamar a la función de completar tarea
      const resultado = await onCompletarTarea(currentTask.id, datosCompletada);
      
      if (resultado) {
        setShowCompletarModal(false);
        setCurrentTask(null);
      }
    } catch (error) {
      console.error('Error al enviar evidencia:', error);
      setErrors({
        general: `Error al completar la tarea: ${error.message}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejar cambio de estado de tarea
  const handleEnviarClick = async (tarea, nuevoEstado) => {
    try {
      // Actualizar la tarea en Firestore con el nuevo estado
      await actualizarEstadoTarea(tiendaId, tarea.id, nuevoEstado);
      
      // Se podría implementar una actualización optimista de la UI aquí
      // o depender de la recarga posterior de las tareas
      
      console.log(`Tarea ${tarea.id} actualizada a estado: ${nuevoEstado}`);
    } catch (error) {
      console.error('Error al cambiar estado de tarea:', error);
      // Podría mostrar una notificación al usuario
    }
  };

  return (
    <div className="task-manager-container">
      {/* Filtros y búsqueda */}
      <div className="task-filters">
        <div className="search-box">
          <span className="material-icons">search</span>
          <input
            type="text"
            placeholder="Buscar tareas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              className="clear-search"
              onClick={() => setSearchTerm('')}
            >
              <span className="material-icons">close</span>
            </button>
          )}
        </div>
        
        <div className="filter-group">
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="todas">Todas las prioridades</option>
            <option value="baja">Baja prioridad</option>
            <option value="normal">Prioridad normal</option>
            <option value="alta">Alta prioridad</option>
            <option value="urgente">Urgente</option>
          </select>
          
          <select
            value={filterFrequency}
            onChange={(e) => setFilterFrequency(e.target.value)}
          >
            <option value="todas">Todas las frecuencias</option>
            <option value="diaria">Diaria</option>
            <option value="semanal">Semanal</option>
            <option value="quincenal">Quincenal</option>
            <option value="mensual">Mensual</option>
          </select>
        </div>
      </div>
      
      {/* Lista de tareas */}
      <div className="tasks-list">
        {tareasPriorizadas.length > 0 ? (
          tareasPriorizadas.map(tarea => (
            <TaskItem 
              key={tarea.id} 
              tarea={tarea}
              onCompletarClick={() => handleCompletarClick(tarea)}
              onEliminarClick={() => onEliminarTarea(tarea.id)}
              onEnviarClick={handleEnviarClick}
              isAdmin={isAdmin}
              tiendaId={tiendaId}
            />
          ))
        ) : (
          <div className="no-tasks-message">
            {searchTerm || filterPriority !== 'todas' || filterFrequency !== 'todas' ? (
              <>
                <span className="material-icons">search_off</span>
                <p>No se encontraron tareas con los filtros actuales</p>
                <button 
                  className="clear-filters-button"
                  onClick={() => {
                    setSearchTerm('');
                    setFilterPriority('todas');
                    setFilterFrequency('todas');
                  }}
                >
                  Limpiar filtros
                </button>
              </>
            ) : (
              <>
                <span className="material-icons">assignment</span>
                <p>No hay tareas configuradas para esta tienda</p>
                {isAdmin && (
                  <p className="add-task-prompt">
                    Haz clic en el botón "Nueva Tarea" para empezar a crear tareas recurrentes
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Modal para completar tarea */}
      {showCompletarModal && currentTask && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Completar Tarea</h3>
            <h4>{currentTask.titulo}</h4>
            
            <div className="task-description">
              <p>{currentTask.descripcion}</p>
            </div>
            
            {errors.general && (
              <div className="error-message general-error">
                <span className="material-icons">error</span>
                {errors.general}
              </div>
            )}
            
            <form onSubmit={handleSubmitEvidencia} className="evidencia-form">
              {/* Turno */}
              <div className="form-group">
                <label htmlFor="turno">Turno</label>
                <select
                  id="turno"
                  name="turno"
                  value={evidencia.turno}
                  onChange={handleEvidenciaChange}
                >
                  <option value="matutino">Matutino</option>
                  <option value="vespertino">Vespertino</option>
                  <option value="nocturno">Nocturno</option>
                </select>
              </div>
              
              {/* Responsable (solo para admins) */}
              {isAdmin && (
                <div className="form-group">
                  <label htmlFor="responsable">Responsable</label>
                  <select
                    id="responsable"
                    name="responsable"
                    value={evidencia.responsable}
                    onChange={handleEvidenciaChange}
                  >
                    <option value={userId}>Yo</option>
                    {empleados.filter(emp => emp.id !== userId).map(empleado => (
                      <option key={empleado.id} value={empleado.id}>
                        {empleado.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Foto (si es requerida) */}
              {currentTask.requiereFoto && (
                <div className="form-group">
                  <label htmlFor="foto">
                    Fotografía <span className="required">*</span>
                  </label>
                  
                  <div className="foto-upload-container">
                    <input
                      type="file"
                      id="foto"
                      accept="image/*"
                      onChange={handleImageChange}
                      className={errors.foto ? 'error' : ''}
                    />
                    
                    <label htmlFor="foto" className="foto-upload-button">
                      <span className="material-icons">add_a_photo</span>
                      {evidencia.foto ? 'Cambiar foto' : 'Seleccionar foto'}
                    </label>
                    
                    {errors.foto && <div className="error-text">{errors.foto}</div>}
                  </div>
                  
                  {evidencia.fotoUrl && (
                    <div className="foto-preview">
                      <img src={evidencia.fotoUrl} alt="Previsualización" />
                      <button 
                        type="button" 
                        className="remove-foto" 
                        onClick={() => setEvidencia({...evidencia, foto: null, fotoUrl: ''})}
                      >
                        <span className="material-icons">delete</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {/* Texto (si es requerido) */}
              {currentTask.requiereTexto && (
                <div className="form-group">
                  <label htmlFor="texto">
                    Reporte <span className="required">*</span>
                  </label>
                  <textarea
                    id="texto"
                    name="texto"
                    value={evidencia.texto}
                    onChange={handleEvidenciaChange}
                    placeholder="Escribe los detalles de la tarea realizada..."
                    rows="4"
                    className={errors.texto ? 'error' : ''}
                  ></textarea>
                  {errors.texto && <div className="error-text">{errors.texto}</div>}
                </div>
              )}
              
              {/* Botones de acción */}
              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-button"
                  onClick={() => setShowCompletarModal(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="submit-button"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="spinner-small"></div>
                      Enviando...
                    </>
                  ) : 'Marcar como Completada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskManager; 