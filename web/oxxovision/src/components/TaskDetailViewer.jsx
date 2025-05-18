import React, { useState, useEffect } from 'react';import { getFirestore, collection, getDocs } from 'firebase/firestore';import './TaskDetailViewer.css';

// Helper function to format date
const formatDate = (isoString) => {
  try {
    if (!isoString) return 'Fecha desconocida';
    
    const date = new Date(isoString);
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Error en fecha';
  }
};

// Helper function to format time
const formatTime = (isoString) => {
  try {
    if (!isoString) return 'Hora desconocida';
    
    const date = new Date(isoString);
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting time:', error);
    return 'Error en hora';
  }
};

const TaskDetailViewer = ({ tasks, tiendaId }) => {
  const [selectedTask, setSelectedTask] = useState(null);
  const [tasksWithEvidence, setTasksWithEvidence] = useState({});
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' or 'oldest'

  // Load evidence data from Firestore
  useEffect(() => {
    const loadEvidence = async () => {
      try {
        const db = getFirestore();
        const evidenceByTaskId = {};
        
        // For each task, check if there's evidence in the correct path
        for (const task of tasks) {
          try {
            const evidenceRef = collection(db, `tiendas/${tiendaId}/tareas/${task.tareaId || task.id}/evidencias`);
            const evidenceSnapshot = await getDocs(evidenceRef);
            
            if (!evidenceSnapshot.empty) {
              const evidenceItems = [];
              evidenceSnapshot.forEach(doc => {
                evidenceItems.push({
                  id: doc.id,
                  ...doc.data()
                });
              });
              evidenceByTaskId[task.id] = evidenceItems;
            }
          } catch (err) {
            console.error(`Error loading evidence for task ${task.id}:`, err);
          }
        }
        
        setTasksWithEvidence(evidenceByTaskId);
      } catch (error) {
        console.error('Error loading evidence:', error);
      }
    };
    
    if (tasks.length > 0) {
      loadEvidence();
    }
  }, [tasks, tiendaId]);

  // Get evidence for a specific task
  const getEvidenceForTask = (task) => {
    // Check first in our state object
    const evidenceFound = tasksWithEvidence[task.id];
    if (evidenceFound && evidenceFound.length > 0) {
      return evidenceFound;
    }
    
    // If not in our state and the task has the old "evidencias" field structure
    if (task.evidencias && Object.keys(task.evidencias).length > 0) {
      return Object.values(task.evidencias);
    }
    
    return null;
  };

  // Get the first evidence of a task
  const getFirstEvidence = (task) => {
    const evidence = getEvidenceForTask(task);
    if (evidence && evidence.length > 0) {
      return evidence[0];
    }
    return null;
  };

  // Get image URL (any of the fields that may have it)
  const getImageUrl = (task) => {
    // Check first in evidence
    const evidence = getFirstEvidence(task);
    if (evidence) {
      return evidence.imagenUrl || evidence.fotoUrl || evidence.evidenceUrlPic || null;
    }
    
    // Fallback to old fields
    return task.fotoUrl || task.evidenceUrlPic || null;
  };

  // Check if task has image evidence
  const hasImageEvidence = (task) => {
    return Boolean(getImageUrl(task));
  };

  // Get completed date of a task
  const getCompletedDate = (task) => {
    // Check first in evidence
    const evidence = getFirstEvidence(task);
    if (evidence) {
      return evidence.fechaCreacion || task.fechaCompletada || null;
    }
    return task.fechaCompletada || null;
  };

  // Get the task's shift
  const getShift = (task) => {
    const shiftNames = {
      'matutino': 'Matutino',
      'vespertino': 'Vespertino',
      'nocturno': 'Nocturno'
    };
    
    // Check first in evidence
    const evidence = getFirstEvidence(task);
    const shiftId = evidence?.turno || task.turno || 'matutino';
    
    return shiftNames[shiftId] || shiftId;
  };
  
  // Get task status - checking the completada field directly
  const getTaskStatus = (task) => {
    // Check if task is completed based on the completada field
    if (task.completada === true || task.estado === 'completada') {
      return 'completada';
    }
    
    // Check evidence for status
    const evidence = getFirstEvidence(task);
    if (evidence && evidence.estado) {
      return evidence.estado;
    }
    
    // Default to pending review
    return 'pendiente_revision';
  };

  // Render task status indicator
  const renderStatusIndicator = (estado) => {
    const statusMap = {
      'completada': {
        icon: 'check_circle',
        text: 'Completada'
      },
      'pendiente_revision': {
        icon: 'pending',
        text: 'Pendiente de revisión'
      }
    };
    
    const statusInfo = statusMap[estado] || statusMap.pendiente_revision;
    
    return (
      <div className={`task-status-indicator status-${estado}`}>
        <span className="material-icons">{statusInfo.icon}</span>
        <span>{statusInfo.text}</span>
      </div>
    );
  };

  // Get the person's name who completed the task
  const getResponsableName = (task) => {
    // Check first in evidence
    const evidence = getFirstEvidence(task);
    if (evidence) {
      if (evidence.responsableNombre) return evidence.responsableNombre;
      if (evidence.empleadoNombre) return evidence.empleadoNombre;
      if (evidence.empleadoId) return `ID: ${evidence.empleadoId.substring(0, 8)}...`;
    }
    
    // Fallback to task fields
    if (task.responsableNombre) {
      return task.responsableNombre;
    } else if (task.empleadoNombre) {
      return task.empleadoNombre;
    } else if (task.empleadoId) {
      return `ID: ${task.empleadoId.substring(0, 8)}...`;
    } else {
      return 'No asignado';
    }
  };

  // Get evidence text
  const getEvidenceText = (task) => {
    // Check first in evidence
    const evidence = getFirstEvidence(task);
    if (evidence) {
      return evidence.texto || task.texto || '';
    }
    return task.texto || '';
  };

  // Get the tasks sorted by date
  const getSortedTasks = () => {
    return [...tasks].sort((a, b) => {
      const dateA = getCompletedDate(a) ? new Date(getCompletedDate(a)).getTime() : 0;
      const dateB = getCompletedDate(b) ? new Date(getCompletedDate(b)).getTime() : 0;
      
      return sortOrder === 'newest' ? (dateB - dateA) : (dateA - dateB);
    });
  };

  // Render planogram products
  const renderPlanogramProducts = (productIds) => {
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return null;
    }

    return (
      <div className="evidence-planogram-products">
        <h5>Productos por Nivel</h5>
        <div className="planogram-levels">
          {productIds.map((levelProducts, index) => (
            <div key={index} className="planogram-level">
              <h6>Nivel {productIds.length - index} (de arriba hacia abajo)</h6>
              <div className="product-ids">
                {levelProducts && levelProducts.length > 0 ? (
                  <div className="product-ids-grid">
                    {levelProducts.map((productId, pidx) => (
                      <div key={pidx} className="product-id-item">
                        {productId}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-products">No hay productos en este nivel</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="task-detail-viewer">
      <div className="task-detail-controls">
        <h3>Tareas Completadas</h3>
        
        <div className="sort-controls">
          <span>Ordenar por:</span>
          <select 
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="newest">Más recientes primero</option>
            <option value="oldest">Más antiguas primero</option>
          </select>
        </div>
      </div>

      <div className="task-detail-container">
        <div className="task-list">
          {getSortedTasks().length > 0 ? (
            getSortedTasks().map(task => (
              <div 
                key={task.id} 
                className={`task-list-item ${selectedTask && selectedTask.id === task.id ? 'selected' : ''} ${hasImageEvidence(task) ? 'has-image' : ''} ${getTaskStatus(task) === 'completada' ? 'is-completed' : ''}`}
                onClick={() => setSelectedTask(task)}
              >
                <div className="task-list-item-header">
                  <h4>{task.tituloTarea || 'Tarea sin título'}</h4>
                  <div className="task-date-time">
                    <div className="date">{formatDate(getCompletedDate(task))}</div>
                    <div className="time">{formatTime(getCompletedDate(task))}</div>
                  </div>
                </div>
                
                {/* Task Status */}
                {renderStatusIndicator(getTaskStatus(task))}
                
                <div className="task-list-details">
                  <div className="task-detail-chip">
                    <span className="material-icons">schedule</span>
                    <span>{getShift(task)}</span>
                  </div>
                  
                  <div className="task-detail-chip">
                    <span className="material-icons">person</span>
                    <span>{getResponsableName(task)}</span>
                  </div>
                  
                  {hasImageEvidence(task) && (
                    <div className="task-detail-chip has-image">
                      <span className="material-icons">photo</span>
                      <span>Con foto</span>
                    </div>
                  )}
                </div>
                
                {task.planogramaId && (
                  <div className="task-planogram-info">
                    <span className="material-icons">view_in_ar</span>
                    <span>{task.planogramaNombre || 'Planograma'}</span>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="no-tasks">
              <span className="material-icons">assignment_turned_in</span>
              <p>No hay tareas completadas aún</p>
            </div>
          )}
        </div>
        
        <div className="task-detail-view">
          {selectedTask ? (
            <div className="task-details">
              <h3 className="task-title">{selectedTask.tituloTarea || 'Tarea sin título'}</h3>
              
              {/* Task Status */}
              {renderStatusIndicator(getTaskStatus(selectedTask))}
              
              <div className="task-metadata">
                <div className="metadata-item">
                  <span className="metadata-label">Fecha:</span>
                  <span className="metadata-value">{formatDate(getCompletedDate(selectedTask))}</span>
                </div>
                
                <div className="metadata-item">
                  <span className="metadata-label">Hora:</span>
                  <span className="metadata-value">{formatTime(getCompletedDate(selectedTask))}</span>
                </div>
                
                <div className="metadata-item">
                  <span className="metadata-label">Turno:</span>
                  <span className="metadata-value">{getShift(selectedTask)}</span>
                </div>
                
                <div className="metadata-item">
                  <span className="metadata-label">Completada por:</span>
                  <span className="metadata-value">{getResponsableName(selectedTask)}</span>
                </div>
              </div>
              
              {hasImageEvidence(selectedTask) && (
                <div className="task-image-container">
                  <h4>Evidencia Fotográfica</h4>
                  <div className="task-image">
                    <img src={getImageUrl(selectedTask)} alt="Evidencia" />
                  </div>
                </div>
              )}
              
              {getEvidenceText(selectedTask) && (
                <div className="task-text-evidence">
                  <h4>Descripción</h4>
                  <div className="task-text-content">
                    {getEvidenceText(selectedTask)}
                  </div>
                </div>
              )}
              
              {selectedTask.planogramaId && (
                <div className="task-planogram-details">
                  <h4>Planograma: {selectedTask.planogramaNombre || 'Sin nombre'}</h4>
                  
                  {selectedTask.planogramProductIds && (
                    renderPlanogramProducts(selectedTask.planogramProductIds)
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="no-task-selected">
              <span className="material-icons">touch_app</span>
              <p>Selecciona una tarea para ver sus detalles</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskDetailViewer; 