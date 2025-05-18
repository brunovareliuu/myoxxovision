import React, { useEffect } from 'react';
import './TaskItem.css';
import { actualizarEstadoTarea } from '../firebase';

// Mapeo de prioridades a colores y etiquetas
const PRIORIDADES = {
  'baja': { color: '#4caf50', label: 'Baja' },
  'normal': { color: '#2196f3', label: 'Normal' },
  'alta': { color: '#ff9800', label: 'Alta' },
  'urgente': { color: '#e5231b', label: 'Urgente' }
};

// Mapeo de frecuencias a etiquetas
const FRECUENCIAS = {
  'diaria': 'Diaria',
  'semanal': 'Semanal',
  'quincenal': 'Quincenal',
  'mensual': 'Mensual'
};

// Íconos para cada frecuencia
const FRECUENCIA_ICONS = {
  'diaria': 'today',
  'semanal': 'view_week',
  'quincenal': 'date_range',
  'mensual': 'calendar_month'
};

// Mapeo de tiempo límite a etiquetas
const TIEMPO_LIMITE = {
  'sin_limite': { label: 'Sin límite de tiempo', icon: 'access_time' },
  '2h': { label: '2 horas', icon: 'access_time' },
  '4h': { label: '4 horas', icon: 'access_time' },
  '8h': { label: '8 horas', icon: 'access_time' },
  '12h': { label: '12 horas', icon: 'access_time' },
  '1d': { label: '1 día', icon: 'today' },
  '2d': { label: '2 días', icon: 'calendar_today' },
  '3d': { label: '3 días', icon: 'calendar_today' },
  '7d': { label: '1 semana', icon: 'date_range' }
};

// Mapeo simplificado de estados de tarea - Solo pendiente y completada
const ESTADOS_TAREA = {
  'pendiente': { 
    label: 'Pendiente', 
    icon: 'pending', 
    color: '#ff9800',
    bgColor: '#fff8e1'
  },
  'completada': { 
    label: 'Completada', 
    icon: 'check_circle', 
    color: '#4caf50',
    bgColor: '#e8f5e9'
  }
};

// Roles para mostrar en español
const ROLES_LABELS = {
  'admin': 'Administrador',
  'gerente': 'Gerente',
  'supervisor': 'Supervisor',
  'usuario': 'Empleado',
  'empleado': 'Empleado'
};

const TaskItem = ({ tarea, onCompletarClick, onEliminarClick, onEnviarClick = () => {}, isAdmin, tiendaId }) => {
  // Verificar que tarea existe y tiene las propiedades necesarias
  if (!tarea || !tarea.id) {
    return null;
  }

  // Detectar si la tarea tiene evidencia y actualizar estado automáticamente
  useEffect(() => {
    const verificarEvidencia = async () => {
      // Si una tarea tiene campo evidenceUrlPic y no está en estado 'completada', actualizarla
      if (tarea.evidenceUrlPic && tarea.estado !== 'completada') {
        console.log(`Tarea ${tarea.id} tiene evidencia, actualizando estado a completada`);
        try {
          await actualizarEstadoTarea(tiendaId, tarea.id, 'completada');
          // No necesitamos hacer más aquí, la UI se actualizará al obtener las tareas nuevamente
        } catch (err) {
          console.error('Error al actualizar estado:', err);
        }
      }
    };

    verificarEvidencia();
  }, [tarea, tiendaId]);

  // Obtener datos de prioridad o usar valores por defecto
  const prioridad = PRIORIDADES[tarea.prioridad] || PRIORIDADES.normal;
  const frecuencia = FRECUENCIAS[tarea.frecuencia] || 'Personalizada';
  const frecuenciaIcon = FRECUENCIA_ICONS[tarea.frecuencia] || 'schedule';
  
  // Obtener información de tiempo límite
  const tiempoLimiteInfo = TIEMPO_LIMITE[tarea.tiempoLimite] || TIEMPO_LIMITE.sin_limite;
  
  // Simplificar el estado de la tarea - Solo pendiente o completada
  let estadoTarea = tarea.estado || 'pendiente';
  
  // Convertir cualquier estado que no sea 'completada' a 'pendiente'
  if (estadoTarea !== 'completada') {
    estadoTarea = 'pendiente';
  }
  
  const estadoInfo = ESTADOS_TAREA[estadoTarea] || ESTADOS_TAREA.pendiente;
  
  // Calcular tiempo restante si hay fecha límite
  let tiempoRestante = null;
  let tiempoRestanteClase = '';
  
  if (tarea.fechaLimite) {
    const ahora = new Date();
    const fechaLimite = new Date(tarea.fechaLimite);
    
    // Diferencia en milisegundos
    const diferencia = fechaLimite - ahora;
    
    if (diferencia <= 0) {
      // La tarea está vencida
      tiempoRestante = 'Vencida';
      tiempoRestanteClase = 'tiempo-vencido';
    } else {
      // Calcular horas restantes
      const horasRestantes = Math.floor(diferencia / (1000 * 60 * 60));
      
      if (horasRestantes < 24) {
        tiempoRestante = `${horasRestantes} horas restantes`;
        tiempoRestanteClase = 'tiempo-critico';
      } else {
        // Calcular días restantes
        const diasRestantes = Math.floor(horasRestantes / 24);
        tiempoRestante = `${diasRestantes} días, ${horasRestantes % 24} horas restantes`;
        tiempoRestanteClase = 'tiempo-normal';
      }
    }
  }

  // Determinar estado de asignación
  const getAsignacionInfo = () => {
    if (!tarea.asignarA || tarea.asignarA === 'no_agendar') {
      return { icon: 'person_off', text: 'No asignada' };
    } else if (tarea.asignarA === 'cualquiera') {
      return { icon: 'groups', text: 'Cualquier empleado' };
    } else {
      // Asignada a alguien específico
      const nombreMostrar = tarea.asignarNombre || 'Empleado';
      const rolMostrar = tarea.asignarRol ? ` (${ROLES_LABELS[tarea.asignarRol] || 'Empleado'})` : '';
      return { 
        icon: 'person', 
        text: `Asignada a: ${nombreMostrar}${rolMostrar}`
      };
    }
  };

  const asignacionInfo = getAsignacionInfo();

  return (
    <div className={`task-item task-estado-${estadoTarea}`}>
      {/* Indicador de prioridad */}
      <div 
        className="priority-indicator"
        style={{ backgroundColor: prioridad.color }}
      >
        <span className="priority-label">{prioridad.label}</span>
      </div>
      
      {/* Contenido principal de la tarea */}
      <div className="task-content">
        <div className="task-header">
          <h3 className="task-title">{tarea.titulo}</h3>
          
          {/* Indicador de estado */}
          <div 
            className="task-estado"
            style={{ 
              backgroundColor: estadoInfo.bgColor,
              color: estadoInfo.color
            }}
          >
            <span className="material-icons">{estadoInfo.icon}</span>
            <span>{estadoInfo.label}</span>
          </div>
        </div>
        
        {/* Mostrar planograma si existe */}
        {tarea.planogramaId && (
          <div className="task-planogram">
            <span className="material-icons">view_in_ar</span>
            <span>Planograma: {tarea.planogramaNombre || tarea.planogramaId}</span>
          </div>
        )}
        
        <p className="task-description">{tarea.descripcion}</p>
        
        {/* Detalles y metadatos */}
        <div className="task-details">
          {/* Frecuencia */}
          <div className="task-detail-item">
            <span className="material-icons">{frecuenciaIcon}</span>
            <span>{frecuencia}</span>
          </div>
          
          {/* Tiempo límite */}
          {tarea.tiempoLimite && tarea.tiempoLimite !== 'sin_limite' && (
            <div className={`task-detail-item ${tiempoRestanteClase}`}>
              <span className="material-icons">{tiempoLimiteInfo.icon}</span>
              <span>{tiempoLimiteInfo.label}</span>
              {tiempoRestante && (
                <span className="tiempo-restante">{tiempoRestante}</span>
              )}
            </div>
          )}
          
          {/* Evidencia requerida */}
          <div className="task-detail-item">
            <span className="material-icons">fact_check</span>
            <span>
              Evidencia: 
              {tarea.requiereFoto && tarea.requiereTexto 
                ? ' Foto y texto' 
                : tarea.requiereFoto 
                  ? ' Foto' 
                  : tarea.requiereTexto 
                    ? ' Texto' 
                    : ' Ninguna'}
            </span>
          </div>
          
          {/* Turno asignado */}
          {tarea.turno && tarea.turno !== 'todos' && (
            <div className="task-detail-item">
              <span className="material-icons">schedule</span>
              <span>
                Turno: {tarea.turno === 'matutino' ? 'Matutino' : 
                         tarea.turno === 'vespertino' ? 'Vespertino' : 
                         tarea.turno === 'nocturno' ? 'Nocturno' : 
                         'Todos'}
              </span>
            </div>
          )}
          
          {/* Asignación de tarea */}
          <div className={`task-detail-item ${!tarea.asignarA || tarea.asignarA === 'no_agendar' ? 'not-assigned' : ''}`}>
            <span className="material-icons">{asignacionInfo.icon}</span>
            <span>{asignacionInfo.text}</span>
          </div>
        </div>
      </div>
      
      {/* Acciones */}
      <div className="task-actions">
        {/* Las acciones dependen del estado de la tarea */}
        {estadoTarea === 'solicitada' && (
          <>
            {/* Botón para marcar como pendiente */}
            <button 
              className="action-button progress-button"
              onClick={() => onEnviarClick(tarea, 'pendiente')}
              title="Pasar a pendiente"
            >
              <span className="material-icons">arrow_forward</span>
              Iniciar tarea
            </button>
            
            {/* Botón para eliminar (solo para administradores) */}
            {isAdmin && (
              <button 
                className="action-button delete-button"
                onClick={() => onEliminarClick(tarea.id)}
                title="Eliminar tarea"
              >
                <span className="material-icons">delete</span>
              </button>
            )}
          </>
        )}
        
        {estadoTarea === 'pendiente' && (
          <>
            {/* Botón para marcar como enviada */}
            <button 
              className="action-button send-button"
              onClick={() => onEnviarClick(tarea, 'enviada')}
              title="Marcar como enviada"
            >
              <span className="material-icons">send</span>
              Enviar
            </button>
            
            {/* Botón para eliminar (solo para administradores) */}
            {isAdmin && (
              <button 
                className="action-button delete-button"
                onClick={() => onEliminarClick(tarea.id)}
                title="Eliminar tarea"
              >
                <span className="material-icons">delete</span>
              </button>
            )}
          </>
        )}
        
        {estadoTarea === 'enviada' && (
          <>
            {/* En estado enviado, solo admin/supervisor pueden completar o rechazar */}
            {isAdmin && (
              <>
                <button 
                  className="action-button complete-button"
                  onClick={() => onCompletarClick(tarea)}
                  title="Marcar como completada"
                >
                  <span className="material-icons">done</span>
                  Completar
                </button>
                
                <button 
                  className="action-button reject-button"
                  onClick={() => onEnviarClick(tarea, 'pendiente')}
                  title="Devolver a pendiente"
                >
                  <span className="material-icons">replay</span>
                </button>
              </>
            )}
            
            {/* Si no es admin, mostrar mensaje */}
            {!isAdmin && (
              <div className="task-status-message">
                <span className="material-icons">hourglass_top</span>
                En revisión
              </div>
            )}
          </>
        )}
        
        {estadoTarea === 'completada' && (
          <div className="task-status-message completed">
            <span className="material-icons">check_circle</span>
            Completada
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskItem; 