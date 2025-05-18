/**
 * Utilidades de depuración para el entorno de desarrollo
 */

// Inicializa las utilidades de depuración
export const initDebugUtils = () => {
  console.log('🔧 Herramientas de depuración inicializadas');
  
  // Agregar al objeto window para acceso desde la consola del navegador
  if (typeof window !== 'undefined') {
    window.debugOxxoVision = {
      version: '1.0.0',
      isDebugMode: true,
      
      // Log con estilo personalizado
      log: (message, data) => {
        console.log(`%c[DEBUG] ${message}`, 'color: #3498db; font-weight: bold;', data || '');
      },
      
      // Funciones de utilidad para depuración
      showAppState: () => {
        const state = {
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
        };
        console.table(state);
        return state;
      },
      
      // Para medir el rendimiento
      startPerformanceTimer: (label = 'default') => {
        console.time(`⏱️ ${label}`);
      },
      
      endPerformanceTimer: (label = 'default') => {
        console.timeEnd(`⏱️ ${label}`);
      },
      
      // Solo muestra mensajes en desarrollo
      debugOnly: (fn) => {
        if (process.env.NODE_ENV === 'development') {
          fn();
        }
      }
    };
    
    console.log('%c🔍 Depuración de OxxoVision disponible. Usa window.debugOxxoVision en la consola.', 
      'background: #2ecc71; color: white; padding: 4px; border-radius: 4px;');
  }
};

// Helper para mostrar tiempo de ejecución
export const measureExecutionTime = async (fn, label = 'Execution time') => {
  const startTime = performance.now();
  const result = await fn();
  const endTime = performance.now();
  
  console.log(`%c${label}: ${(endTime - startTime).toFixed(2)}ms`, 'color: #f39c12; font-weight: bold;');
  return result;
};

// Exportar otras funciones de depuración según sea necesario 