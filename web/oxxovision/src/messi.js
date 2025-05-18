import axios from 'axios';

/**
 * Procesa una imagen para detectar productos, extraer códigos de barras y
 * comparar con un planograma para identificar discrepancias
 * 
 * @param {string} imageBase64 - Imagen en formato base64 (sin el prefijo data:image)
 * @param {Array<Array<string>>} planograma - Array bidimensional con los IDs/códigos según plan
 * @param {Object} options - Opciones adicionales (API key, umbral, etc)
 * @returns {Object} - Resultado con el array de códigos y discrepancias
 */
export async function processImageAndCompare(imageBase64, planograma, options = {}) {
  try {
    // Opciones por defecto
    const defaultOptions = {
      apiKey: 'SUipMLdm8BvqFBvdN1ZX',
      emptyThresholdMultiplier: 1.5,
      shelfThreshold: 100000
    };
    
    const config = { ...defaultOptions, ...options };
    
    // Paso 1: Enviar imagen a Roboflow API
    const roboflowResponse = await axios({
      method: 'POST',
      url: 'https://detect.roboflow.com/estante-productos-oxxo/6',
      params: {
        api_key: config.apiKey
      },
      data: imageBase64,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    // Obtener predicciones
    const { predictions, image } = roboflowResponse.data;
    
    if (!predictions || predictions.length === 0) {
      return {
        barcodesArray: [],
        comparacion: { discrepancias: [], movimientos: [] },
        error: 'No se detectaron productos en la imagen'
      };
    }
    
    // Dimensiones de la imagen
    const imageSize = {
      width: image.width,
      height: image.height
    };
    
    // Paso 2: Procesar predicciones para obtener coordenadas en píxeles
    const enhancedPredictions = predictions.map(pred => {
      const pixelX = Math.round(pred.x * imageSize.width);
      const pixelY = Math.round(pred.y * imageSize.height);
      const pixelWidth = Math.round(pred.width * imageSize.width);
      const pixelHeight = Math.round(pred.height * imageSize.height);
      
      const x1 = pixelX - pixelWidth / 2;
      const y1 = pixelY - pixelHeight / 2;
      const x2 = pixelX + pixelWidth / 2;
      const y2 = pixelY + pixelHeight / 2;
      
      // Calcular los puntos de las esquinas inferiores
      const bottomLeft = { x: x1, y: y2 };
      const bottomRight = { x: x2, y: y2 };
      
      return {
        ...pred,
        pixelX,
        pixelY,
        pixelWidth,
        pixelHeight,
        x1,
        y1,
        x2,
        y2,
        bottomLeft,
        bottomRight
      };
    });
    
    // Paso 3: Organizar productos por estantes (de abajo hacia arriba)
    const barcodesArray = organizeProductsByShelf(enhancedPredictions, config);
    
    // Paso 4: Comparar con el planograma
    const comparacion = messiComparations(planograma, barcodesArray);
    
    return {
      barcodesArray,
      comparacion,
      imageSize
    };
    
  } catch (error) {
    console.error('Error procesando la imagen:', error);
    return {
      barcodesArray: [],
      comparacion: { discrepancias: [], movimientos: [] },
      error: error.message || 'Error desconocido al procesar la imagen'
    };
  }
}

/**
 * Organiza los productos por estantes y genera el array de códigos de barras
 * 
 * @param {Array} predictions - Predicciones con coordenadas mejoradas
 * @param {Object} config - Configuración y umbrales
 * @returns {Array<Array<string>>} - Array anidado de códigos de barras con EMPTYs
 */
function organizeProductsByShelf(predictions, config) {
  if (!predictions || predictions.length === 0) return [];
  
  // Ordenar productos por coordenada Y (de arriba hacia abajo)
  const sortedByY = [...predictions].sort((a, b) => a.bottomLeft.y - b.bottomLeft.y);
  
  // Agrupar en estantes usando el umbral configurado
  const shelves = [];
  let currentShelf = [sortedByY[0]];
  let baselineY = sortedByY[0].bottomLeft.y;
  
  // Agrupar en estantes
  for (let i = 1; i < sortedByY.length; i++) {
    const item = sortedByY[i];
    const bottomY = item.bottomLeft.y;
    
    // Si la diferencia supera el umbral, es un nuevo estante
    if (Math.abs(baselineY - bottomY) > config.shelfThreshold) {
      shelves.push(currentShelf);
      currentShelf = [item];
      baselineY = bottomY;
    } else {
      currentShelf.push(item);
      // Actualizar la línea base como el promedio de productos actuales
      baselineY = currentShelf.reduce((sum, prod) => sum + prod.bottomLeft.y, 0) / currentShelf.length;
    }
  }
  
  // Añadir el último estante
  shelves.push(currentShelf);
  
  // Ordenar estantes de abajo hacia arriba (mayor Y a menor Y)
  const shelvesSortedBottomToTop = [...shelves].sort((a, b) => {
    const avgYA = a.reduce((sum, prod) => sum + prod.bottomLeft.y, 0) / a.length;
    const avgYB = b.reduce((sum, prod) => sum + prod.bottomLeft.y, 0) / b.length;
    return avgYB - avgYA; // Orden descendente (de abajo hacia arriba)
  });
  
  // Para cada estante, ordenar productos de izquierda a derecha y detectar espacios vacíos
  const barcodesArray = shelvesSortedBottomToTop.map(shelf => {
    // Si solo hay un producto, no hay espacios vacíos que detectar
    if (shelf.length <= 1) {
      return [extractBarcode(shelf[0].class)];
    }
    
    // Ordenar productos de izquierda a derecha
    const sortedByX = [...shelf].sort((a, b) => a.bottomLeft.x - b.bottomLeft.x);
    
    // Calcular tamaño promedio de productos en el estante
    const avgWidth = sortedByX.reduce((sum, prod) => sum + prod.pixelWidth, 0) / sortedByX.length;
    
    // Calcular distancias horizontales entre productos adyacentes
    const distances = [];
    for (let i = 0; i < sortedByX.length - 1; i++) {
      // Usar centro del producto actual al centro del siguiente para mejor precisión
      const currentCenter = sortedByX[i].bottomLeft.x + (sortedByX[i].pixelWidth / 2);
      const nextCenter = sortedByX[i+1].bottomLeft.x + (sortedByX[i+1].pixelWidth / 2);
      const dist = nextCenter - currentCenter;
      distances.push(dist);
    }
    
    // Calcular promedio y desviación estándar
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    
    // Usar técnica robusta para calcular la desviación estándar
    // Esto reduce el impacto de valores atípicos que podrían ser espacios vacíos genuinos
    const sortedDistances = [...distances].sort((a, b) => a - b);
    const lowerQuartileIndex = Math.floor(sortedDistances.length * 0.25);
    const upperQuartileIndex = Math.floor(sortedDistances.length * 0.75);
    const normalDistances = sortedDistances.slice(lowerQuartileIndex, upperQuartileIndex + 1);
    
    // Calcular desviación estándar solo con los valores dentro del rango intercuartil
    const normalAvgDistance = normalDistances.reduce((sum, d) => sum + d, 0) / 
                            (normalDistances.length || 1); // Evitar división por cero
    const normalVariance = normalDistances.reduce((sum, d) => sum + Math.pow(d - normalAvgDistance, 2), 0) / 
                         (normalDistances.length || 1);
    const normalStdDev = Math.sqrt(normalVariance);
    
    // Establecer umbral adaptativo para espacios vacíos
    // Usar factor configurable y tamaño promedio del producto como referencia
    const emptyThreshold = normalAvgDistance + 
                         (config.emptyThresholdMultiplier * normalStdDev) + 
                         (avgWidth * 0.2); // Añadir un 20% del ancho promedio como margen
    
    // Normalizar umbrales para evitar falsos positivos/negativos
    const minEmptyThreshold = avgWidth * 0.8; // Mínimo 80% del ancho promedio
    const finalEmptyThreshold = Math.max(emptyThreshold, minEmptyThreshold);
    
    // Crear array con códigos de barras y espacios vacíos
    const result = [extractBarcode(sortedByX[0].class)];
    
    for (let i = 0; i < sortedByX.length - 1; i++) {
      const current = sortedByX[i];
      const next = sortedByX[i+1];
      
      // Calcular distancia del borde derecho del producto actual al borde izquierdo del siguiente
      const gapWidth = next.bottomLeft.x - (current.bottomLeft.x + current.pixelWidth);
      
      // Si la distancia supera el umbral, agregar EMPTYs
      if (gapWidth > finalEmptyThreshold) {
        // Calcular estimación más precisa de cuántos EMPTYs agregar
        // basado en el espacio disponible y ancho promedio de productos
        const emptySpaceRatio = gapWidth / avgWidth;
        
        // Usar heurística adaptativa: Si es muy grande comparado con la media,
        // podría haber múltiples productos faltantes
        let numEmptySpaces = Math.round(emptySpaceRatio);
        
        // Limitar a un máximo razonable para evitar demasiados espacios vacíos
        // Esto es configurable según el contexto específico de la tienda
        numEmptySpaces = Math.min(numEmptySpaces, 3);
        
        // Si hay al menos un espacio vacío
        if (numEmptySpaces > 0) {
          // Agregar los EMPTYs calculados
          for (let j = 0; j < numEmptySpaces; j++) {
            result.push("EMPTY");
          }
        }
      }
      
      result.push(extractBarcode(next.class));
    }
    
    return result;
  });
  
  return barcodesArray;
}

/**
 * Extrae el código de barras (parte numérica antes del guion)
 * 
 * @param {string} className - Nombre completo de la clase/producto
 * @returns {string} - Código de barras extraído
 */
function extractBarcode(className) {
  if (!className) return '';
  
  // Si tiene un guion, extraer la parte antes del guion
  const dashIndex = className.indexOf('-');
  if (dashIndex > -1) {
    return className.substring(0, dashIndex).trim();
  }
  
  // Si no tiene guion, devolver el nombre original
  return className;
}

/**
 * Compara un planograma con un realograma para encontrar discrepancias
 * @param {Array<Array<string>>} planograma - Array bidimensional con los IDs de productos según el plan
 * @param {Array<Array<string>>} realograma - Array bidimensional con los IDs de productos en la realidad
 * @returns {Array<{fila: number, columna: number, esperado: string, encontrado: string}>} - Lista de discrepancias
 */
function messiComparations(planograma, realograma) {
  const discrepancias = [];
  
  // Verificar que ambos arrays tengan dimensiones
  if (!planograma || !planograma.length || !realograma || !realograma.length) {
    return { discrepancias: [], movimientos: [] };
  }
  
  // Iterar por cada fila y columna para comparar
  for (let i = 0; i < planograma.length; i++) {
    const filaPlano = planograma[i];
    const filaReal = realograma[i] || [];
    
    for (let j = 0; j < filaPlano.length; j++) {
      const productoPlano = filaPlano[j];
      const productoReal = filaReal[j];
      
      // Si hay diferencia, registrar la discrepancia
      if (productoPlano !== productoReal) {
        discrepancias.push({
          fila: i,
          columna: j,
          esperado: productoPlano,
          encontrado: productoReal || 'vacío'
        });
      }
    }
    
    // Verificar si el realograma tiene elementos extra en esta fila
    if (filaReal.length > filaPlano.length) {
      for (let j = filaPlano.length; j < filaReal.length; j++) {
        discrepancias.push({
          fila: i,
          columna: j,
          esperado: 'vacío',
          encontrado: filaReal[j]
        });
      }
    }
  }
  
  // Verificar si el realograma tiene filas extra
  if (realograma.length > planograma.length) {
    for (let i = planograma.length; i < realograma.length; i++) {
      const filaReal = realograma[i];
      
      for (let j = 0; j < filaReal.length; j++) {
        discrepancias.push({
          fila: i,
          columna: j,
          esperado: 'vacío',
          encontrado: filaReal[j]
        });
      }
    }
  }
  
  // Calcular los movimientos necesarios para corregir las discrepancias
  const movimientos = messiMovimientos(planograma, realograma, discrepancias);
  
  return {
    discrepancias,
    movimientos
  };
}

/**
 * Calcula los movimientos necesarios para corregir las discrepancias entre planograma y realograma
 * @param {Array<Array<string>>} planograma - Array bidimensional con los IDs de productos según el plan
 * @param {Array<Array<string>>} realograma - Array bidimensional con los IDs de productos en la realidad
 * @param {Array<{fila: number, columna: number, esperado: string, encontrado: string}>} discrepancias - Lista de discrepancias encontradas
 * @returns {Array<{tipo: string, producto: string, origen: {fila: number, columna: number}, destino: {fila: number, columna: number}}>} - Lista de movimientos a realizar
 */
function messiMovimientos(planograma, realograma, discrepancias) {
  const movimientos = [];
  
  // Mapear productos existentes en el realograma para encontrar posibles reubicaciones
  const productosEnRealograma = new Map();
  const productosEnPlanograma = new Map();
  
  // Llenar el mapa de productos en el realograma
  for (let i = 0; i < realograma.length; i++) {
    for (let j = 0; j < realograma[i].length; j++) {
      const producto = realograma[i][j];
      if (producto && producto !== 'vacío' && producto !== 'EMPTY') {
        if (!productosEnRealograma.has(producto)) {
          productosEnRealograma.set(producto, []);
        }
        productosEnRealograma.get(producto).push({ fila: i, columna: j });
      }
    }
  }
  
  // Llenar el mapa de productos en el planograma
  for (let i = 0; i < planograma.length; i++) {
    for (let j = 0; j < planograma[i].length; j++) {
      const producto = planograma[i][j];
      if (producto && producto !== 'vacío' && producto !== 'EMPTY') {
        if (!productosEnPlanograma.has(producto)) {
          productosEnPlanograma.set(producto, []);
        }
        productosEnPlanograma.get(producto).push({ fila: i, columna: j });
      }
    }
  }
  
  // Procesar cada discrepancia
  for (const discrepancia of discrepancias) {
    const { fila, columna, esperado, encontrado } = discrepancia;
    
    // Caso 1: Hay un producto incorrecto en la posición
    if (encontrado !== 'vacío' && esperado !== 'vacío') {
      // Si el producto encontrado debe estar en otro lugar según el planograma
      if (productosEnPlanograma.has(encontrado)) {
        // Buscar dónde debería estar este producto según el planograma
        const posicionesCorrectas = productosEnPlanograma.get(encontrado);
        let tieneUbicacionCorrecta = false;
        
        for (const posicionCorrecta of posicionesCorrectas) {
          const posibleDiscrepancia = discrepancias.find(
            d => d.fila === posicionCorrecta.fila && 
                 d.columna === posicionCorrecta.columna && 
                 d.esperado === encontrado
          );
          
          if (posibleDiscrepancia) {
            // El producto debe moverse a su ubicación correcta
            movimientos.push({
              tipo: 'mover',
              producto: encontrado,
              origen: { fila, columna },
              destino: { fila: posicionCorrecta.fila, columna: posicionCorrecta.columna }
            });
            tieneUbicacionCorrecta = true;
            break;
          }
        }
        
        if (!tieneUbicacionCorrecta) {
          // El producto está de más, se debe remover
          movimientos.push({
            tipo: 'remover',
            producto: encontrado,
            origen: { fila, columna },
            destino: null
          });
        }
      } else {
        // Producto no pertenece al planograma, remover
        movimientos.push({
          tipo: 'remover',
          producto: encontrado,
          origen: { fila, columna },
          destino: null
        });
      }
      
      // Verificar si el producto esperado está en otro lugar
      if (productosEnRealograma.has(esperado)) {
        const posicionesActuales = productosEnRealograma.get(esperado);
        let encontradoPosicion = null;
        
        // Buscar una posición donde el producto esperado esté incorrectamente ubicado
        for (const posActual of posicionesActuales) {
          // Verificar si esa posición es incorrecta según el planograma
          const deberiaTenerOtroProducto = planograma[posActual.fila]?.[posActual.columna] !== esperado;
          
          if (deberiaTenerOtroProducto) {
            encontradoPosicion = posActual;
            break;
          }
        }
        
        if (encontradoPosicion) {
          // Si el producto esperado está en otra ubicación incorrecta, moverlo
          movimientos.push({
            tipo: 'mover',
            producto: esperado,
            origen: encontradoPosicion,
            destino: { fila, columna }
          });
        } else {
          // El producto esperado no está disponible, se debe añadir
          movimientos.push({
            tipo: 'añadir',
            producto: esperado,
            origen: null,
            destino: { fila, columna }
          });
        }
      } else {
        // El producto esperado no está en el realograma, se debe añadir
        movimientos.push({
          tipo: 'añadir',
          producto: esperado,
          origen: null,
          destino: { fila, columna }
        });
      }
    } 
    // Caso 2: Falta un producto (hay un espacio vacío donde debería haber producto)
    else if (encontrado === 'vacío' && esperado !== 'vacío') {
      // Verificar si el producto esperado está en otra ubicación
      if (productosEnRealograma.has(esperado)) {
        const posicionesActuales = productosEnRealograma.get(esperado);
        let encontradoPosicion = null;
        
        // Buscar una posición donde el producto esté incorrectamente ubicado
        for (const posActual of posicionesActuales) {
          const posicionIncorrecta = planograma[posActual.fila]?.[posActual.columna] !== esperado;
          
          if (posicionIncorrecta) {
            encontradoPosicion = posActual;
            break;
          }
        }
        
        if (encontradoPosicion) {
          // Mover el producto a su ubicación correcta
          movimientos.push({
            tipo: 'mover',
            producto: esperado,
            origen: encontradoPosicion,
            destino: { fila, columna }
          });
        } else {
          // El producto no está disponible para mover, se debe añadir
          movimientos.push({
            tipo: 'añadir',
            producto: esperado,
            origen: null,
            destino: { fila, columna }
          });
        }
      } else {
        // El producto esperado no está en ningún lugar del realograma
        movimientos.push({
          tipo: 'añadir',
          producto: esperado,
          origen: null,
          destino: { fila, columna }
        });
      }
    } 
    // Caso 3: Hay un producto que no debería estar (debería estar vacío)
    else if (encontrado !== 'vacío' && esperado === 'vacío') {
      // Verificar si este producto debería estar en otra ubicación según el planograma
      if (productosEnPlanograma.has(encontrado)) {
        const posicionesCorrectas = productosEnPlanograma.get(encontrado);
        let destinoEncontrado = false;
        
        for (const posicionCorrecta of posicionesCorrectas) {
          const posibleDiscrepancia = discrepancias.find(
            d => d.fila === posicionCorrecta.fila && 
                 d.columna === posicionCorrecta.columna && 
                 d.esperado === encontrado && 
                 d.encontrado !== encontrado
          );
          
          if (posibleDiscrepancia) {
            // El producto debe moverse a su ubicación correcta
            movimientos.push({
              tipo: 'mover',
              producto: encontrado,
              origen: { fila, columna },
              destino: { fila: posicionCorrecta.fila, columna: posicionCorrecta.columna }
            });
            destinoEncontrado = true;
            break;
          }
        }
        
        if (!destinoEncontrado) {
          // El producto no tiene destino válido, remover
          movimientos.push({
            tipo: 'remover',
            producto: encontrado,
            origen: { fila, columna },
            destino: null
          });
        }
      } else {
        // El producto no pertenece al planograma, debe removerse
        movimientos.push({
          tipo: 'remover',
          producto: encontrado,
          origen: { fila, columna },
          destino: null
        });
      }
    }
  }
  
  // Optimizar los movimientos para eliminar redundancias
  return optimizarMovimientos(movimientos);
}

/**
 * Optimiza los movimientos eliminando operaciones redundantes
 * @param {Array<Object>} movimientos - Lista de movimientos iniciales
 * @returns {Array<Object>} - Lista optimizada de movimientos
 */
function optimizarMovimientos(movimientos) {
  const movimientosOptimizados = [];
  const movimientosProcesados = new Set();
  
  // Eliminar movimientos redundantes (como mover un producto y después removerlo)
  for (let i = 0; i < movimientos.length; i++) {
    if (movimientosProcesados.has(i)) continue;
    
    const mov = movimientos[i];
    
    // Buscar si hay otro movimiento que anule a este
    let redundante = false;
    
    for (let j = i + 1; j < movimientos.length; j++) {
      const otroMov = movimientos[j];
      
      // Si un producto se mueve y luego se remueve, eliminar ambos y añadir solo remover del origen
      if (mov.tipo === 'mover' && otroMov.tipo === 'remover' && 
          mov.producto === otroMov.producto &&
          JSON.stringify(mov.destino) === JSON.stringify(otroMov.origen)) {
        movimientosOptimizados.push({
          tipo: 'remover',
          producto: mov.producto,
          origen: mov.origen,
          destino: null
        });
        
        movimientosProcesados.add(i);
        movimientosProcesados.add(j);
        redundante = true;
        break;
      }
      
      // Si se añade un producto y luego se mueve, combinar en un solo movimiento de adición directa
      if (mov.tipo === 'añadir' && otroMov.tipo === 'mover' &&
          mov.producto === otroMov.producto &&
          JSON.stringify(mov.destino) === JSON.stringify(otroMov.origen)) {
        movimientosOptimizados.push({
          tipo: 'añadir',
          producto: mov.producto,
          origen: null,
          destino: otroMov.destino
        });
        
        movimientosProcesados.add(i);
        movimientosProcesados.add(j);
        redundante = true;
        break;
      }
    }
    
    if (!redundante && !movimientosProcesados.has(i)) {
      movimientosOptimizados.push(mov);
      movimientosProcesados.add(i);
    }
  }
  
  return movimientosOptimizados;
}

// Ejemplo de uso
// const planogramaEjemplo = [
//   ["4678379", "111989", "111989"],
//   ["111989", "111989", "4678374", "111989"],
//   ["121989", "113989", "111989", "111984"]
// ];
// 
// processImageAndCompare(imageBase64, planogramaEjemplo)
//   .then(resultado => console.log(JSON.stringify(resultado, null, 2)))
//   .catch(error => console.error(error)); 