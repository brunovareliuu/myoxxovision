import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { processImageAndCompare } from '../messi';
import planogramTaskService from '../services/PlanogramTaskService';
import { 
  obtenerTiendas,
  obtenerPlanogramas,
  obtenerProducto,
  storage,
  db,
  auth
} from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL, uploadString } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import FileUpload from './FileUpload';
import './OCR.css';

const OCR = () => {
  // State for form inputs and data
  const [tiendas, setTiendas] = useState([]);
  const [planogramas, setPlanogramas] = useState([]);
  const [selectedTienda, setSelectedTienda] = useState('');
  const [selectedPlanograma, setSelectedPlanograma] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loadingTiendas, setLoadingTiendas] = useState(false);
  const [loadingPlanogramas, setLoadingPlanogramas] = useState(false);
  const [productNames, setProductNames] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedAnalysisId, setSavedAnalysisId] = useState(null);
  const [savedImageUrl, setSavedImageUrl] = useState(null);
  
  // Referencias para visualización avanzada
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [visualMode, setVisualMode] = useState('normal'); // normal, heatmap, bounding-boxes
  const [showDetectionBoxes, setShowDetectionBoxes] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [colorByDiscrepancy, setColorByDiscrepancy] = useState(true);
  const [highPrecisionMode, setHighPrecisionMode] = useState(true);
  
  // Configuración para modelos múltiples
  const [useMultipleModels, setUseMultipleModels] = useState(true);
  const [modelConfigs, setModelConfigs] = useState([
    {
      id: 'model1',
      name: 'Modelo Principal',
      apiKey: 'SUipMLdm8BvqFBvdN1ZX', // API Key de Roboflow
      emptyThresholdMultiplier: 1.7,
      shelfThreshold: 90000,
      confidence: 0.35, // Umbral de confianza para detección
      enabled: true,
      result: null,
      processing: false,
      error: null
    },
    {
      id: 'model2',
      name: 'Modelo Alternativo',
      apiKey: 'SUipMLdm8BvqFBvdN1ZX', // API Key de Roboflow
      emptyThresholdMultiplier: 2.0,
      shelfThreshold: 80000,
      confidence: 0.4, // Umbral de confianza para detección
      enabled: true,
      result: null,
      processing: false,
      error: null
    },
    {
      id: 'model3',
      name: 'Modelo Alta Precisión',
      apiKey: 'SUipMLdm8BvqFBvdN1ZX', // API Key de Roboflow
      emptyThresholdMultiplier: 1.5,
      shelfThreshold: 95000,
      confidence: 0.5, // Umbral de confianza más alto para mayor precisión
      enabled: highPrecisionMode,
      result: null,
      processing: false,
      error: null
    }
  ]);

  // Load tiendas on component mount with improved error handling
  useEffect(() => {
    const loadTiendas = async () => {
      try {
        setLoadingTiendas(true);
        setError(null);
        const tiendasData = await obtenerTiendas();
        
        if (tiendasData && tiendasData.length > 0) {
          // Sort tiendas by name for easier selection
          const sortedTiendas = [...tiendasData].sort((a, b) => 
            (a.nombre || '').localeCompare(b.nombre || '')
          );
          setTiendas(sortedTiendas);
        } else {
          setTiendas([]);
          setError('No se encontraron tiendas. Por favor, registre una tienda primero.');
        }
      } catch (error) {
        console.error('Error al cargar tiendas:', error);
        setError('No se pudieron cargar las tiendas. Intente nuevamente.');
      } finally {
        setLoadingTiendas(false);
      }
    };

    loadTiendas();
  }, []);

  // Load planogramas when a tienda is selected with improved error handling
  useEffect(() => {
    if (!selectedTienda) {
      setPlanogramas([]);
      return;
    }

    const loadPlanogramas = async () => {
      try {
        setLoadingPlanogramas(true);
        setError(null);
        const planogramasData = await obtenerPlanogramas(selectedTienda);
        
        if (planogramasData && planogramasData.length > 0) {
          // Sort planogramas by name for easier selection
          const sortedPlanogramas = [...planogramasData].sort((a, b) => 
            (a.nombre || '').localeCompare(b.nombre || '')
          );
          setPlanogramas(sortedPlanogramas);
        } else {
          setPlanogramas([]);
          setError(`No se encontraron planogramas para la tienda seleccionada. 
                   Por favor, cree un planograma primero.`);
        }
      } catch (error) {
        console.error('Error al cargar planogramas:', error);
        setError('No se pudieron cargar los planogramas. Intente nuevamente.');
      } finally {
        setLoadingPlanogramas(false);
      }
    };

    loadPlanogramas();
  }, [selectedTienda]);

  // Inicializar canvas para visualización
  const initializeCanvas = useCallback((img) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    
    // Dibujar imagen en canvas
    ctx.drawImage(img, 0, 0, img.width, img.height);
    
    // Guardar estado original
    ctx.save();
  }, []);

  // Función mejorada para manejar cambios de imagen con preprocesamiento
  const handleFileChange = useCallback((file) => {
    if (!file) return;
    
    setImageFile(file);
    setError(null);
    
    // Crear imagen preview con compresión y preprocesamiento para mejor detección
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Crear un canvas para compresión y preprocesamiento
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Mantener relación de aspecto pero limitar dimensiones para mejor rendimiento
        // Usamos un mayor tamaño máximo para mantener buena calidad en el análisis
        const MAX_DIMENSION = 1600;
        if (width > height && width > MAX_DIMENSION) {
          height = Math.round(height * (MAX_DIMENSION / width));
          width = MAX_DIMENSION;
        } else if (height > width && height > MAX_DIMENSION) {
          width = Math.round(width * (MAX_DIMENSION / height));
          height = MAX_DIMENSION;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Dibujar y comprimir la imagen
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Aplicar filtros para mejorar detección de bordes
        try {
          // Aumentar contraste ligeramente para mejorar detección
          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;
          
          // Aplicar mejora de imagen adaptable para estantes de productos
          const factorContraste = highPrecisionMode ? 1.2 : 1.1; // Mayor contraste en modo alta precisión
          const factorNitidez = 1.3; // Factor de nitidez para realzar bordes
          
          // Aplicar ajustes a cada pixel
          for (let i = 0; i < data.length; i += 4) {
            // Aplicar aumento de contraste adaptativo
            for (let j = 0; j < 3; j++) {
              // Ajuste adaptativo para productos en estantes
              // Evita distorsionar demasiado los colores
              const pixelValue = data[i + j];
              // Contraste adaptativo con preservación de detalles
              let adjustedValue = (pixelValue - 128) * factorContraste + 128;
              
              // Verificar si estamos en un borde (diferencia significativa con píxeles adyacentes)
              // Esto ayuda a realzar los límites entre productos
              const isBorder = (i > 4 && i < data.length - 4) && 
                              (Math.abs(pixelValue - data[i + j - 4]) > 20 || 
                               Math.abs(pixelValue - data[i + j + 4]) > 20);
              
              // Aplicar nitidez extra a los bordes
              if (isBorder) {
                adjustedValue = adjustedValue + (adjustedValue - 128) * (factorNitidez - 1);
              }
              
              // Límites para evitar pérdida de detalles
              data[i + j] = Math.max(0, Math.min(255, adjustedValue));
            }
          }
          
          ctx.putImageData(imageData, 0, 0);
        } catch (e) {
          console.log('Error en preprocesamiento avanzado de imagen:', e);
          // Si falla el preprocesamiento avanzado, aplicar mejoras básicas
          try {
            // Mejora básica de contraste
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            // Ajuste simple de contraste
            const factor = 1.1;
            const intercept = 128 * (1 - factor);
            
            for (let i = 0; i < data.length; i += 4) {
              for (let j = 0; j < 3; j++) {
                data[i + j] = data[i + j] * factor + intercept;
              }
            }
            
            ctx.putImageData(imageData, 0, 0);
          } catch (e) {
            console.log('Error en preprocesamiento básico de imagen:', e);
            // Continuar sin preprocesamiento si falla todo
          }
        }
        
        // Convertir a data URL con alta calidad para evitar pérdida de información
        // Para detección de productos, la calidad de la imagen es crucial
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        setImagePreview(compressedDataUrl);
        
        // Guardar referencia para visualización posterior
        if (imageRef.current) {
          imageRef.current.src = compressedDataUrl;
          // Después de cargar la imagen, inicializar canvas
          imageRef.current.onload = () => {
            if (initializeCanvas) {
              initializeCanvas(imageRef.current);
            }
          };
        }
      };
      img.src = reader.result;
    };
    reader.onerror = () => {
      setError('Error al leer el archivo. Intente con otra imagen.');
    };
    reader.readAsDataURL(file);
    
    // Reset any previous results
    setResult(null);
  }, [highPrecisionMode]);

  // Visualizar resultados en canvas
  const visualizeResults = useCallback((resultData) => {
    if (!canvasRef.current || !imageRef.current || !resultData) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;
    
    // Restablecer canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    if (visualMode === 'normal' && !showDetectionBoxes) {
      // Solo mostrar la imagen original
      return;
    }
    
    // Extraer datos relevantes
    const { barcodesArray, comparacion, predictions, imageSize, advancedAnalysis } = resultData;
    const discrepancias = comparacion?.discrepancias || [];
    const shelfAlignment = comparacion?.alineamiento || []; // Obtener alineamiento si está disponible
    
    // Dibujar los límites de los estantes primero (para que queden detrás de los productos)
    if (barcodesArray && barcodesArray.length > 0) {
      const shelfBoundaryHeight = canvas.height / barcodesArray.length;
      
      // Dibujar cada estante
      for (let i = 0; i <= barcodesArray.length; i++) {
        const y = i * shelfBoundaryHeight;
        
        // Dibujar línea horizontal para el límite del estante
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)'; // Línea negra semi-transparente
        ctx.lineWidth = 2.5; // Línea gruesa
        ctx.setLineDash([0]); // Línea sólida
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
        
        // Si no es el último estante, dibujar el área del estante con un fondo semi-transparente
        if (i < barcodesArray.length) {
          ctx.fillStyle = 'rgba(245, 245, 245, 0.1)'; // Fondo gris muy claro y casi transparente
          ctx.fillRect(0, y, canvas.width, shelfBoundaryHeight);
          
          // Añadir etiqueta de estante
          const shelfNumber = barcodesArray.length - i; // Invertir para que estante 1 esté abajo
          ctx.font = 'bold 14px Arial';
          ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
          ctx.fillText(`Estante ${shelfNumber}`, 10, y + 20);
        }
      }
      
      // Dibujar límites verticales (izquierda y derecha)
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 2;
      
      // Borde izquierdo
      ctx.moveTo(0, 0);
      ctx.lineTo(0, canvas.height);
      
      // Borde derecho
      ctx.moveTo(canvas.width, 0);
      ctx.lineTo(canvas.width, canvas.height);
      
      ctx.stroke();
    }
    
    // Crear mapa de discrepancias para colorear
    const discrepancyMap = new Map();
    discrepancias.forEach(disc => {
      const key = `${disc.fila}-${disc.columna}`;
      discrepancyMap.set(key, disc);
    });
    
    // Dibujar bounding boxes si están disponibles y habilitados
    if (showDetectionBoxes && predictions && predictions.length > 0) {
      // Filtrar predicciones con baja confianza para evitar ruido visual
      const filteredPredictions = predictions.filter(pred => 
        pred.confidence >= 0.25  // Solo mostrar predicciones con confianza significativa
      );
      
      // Dibujar cada predicción
      filteredPredictions.forEach(pred => {
        const { x1, y1, x2, y2, class: className, confidence } = pred;
        
        // Calcular el ancho y alto del producto
        const boxWidth = x2 - x1;
        const boxHeight = y2 - y1;
        
        // Mejorar posicionamiento horizontal - desplazar más a la derecha
        // Ajuste asimétrico para mover más hacia la derecha
        const horizontalAdjustmentLeft = boxWidth * 0.10;  // 10% del ancho como ajuste izquierdo
        const horizontalAdjustmentRight = boxWidth * 0.05; // 5% del ancho como ajuste derecho
        const verticalAdjustment = boxHeight * 0.05;   // 5% del alto como ajuste vertical
        
        // Aplicar ajustes para centrar mejor el cuadro alrededor del producto
        // Mover más a la derecha reduciendo el ajuste izquierdo
        const adjustedX1 = x1 + horizontalAdjustmentLeft;
        const adjustedY1 = y1 + verticalAdjustment;
        const adjustedX2 = x2 - horizontalAdjustmentRight;
        const adjustedY2 = y2 - verticalAdjustment;
        
        // Asegurar dimensiones mínimas para el cuadro
        const minBoxSize = 18; // tamaño mínimo para visibilidad (aumentado)
        const finalWidth = Math.max(minBoxSize, adjustedX2 - adjustedX1);
        const finalHeight = Math.max(minBoxSize, adjustedY2 - adjustedY1);
        
        // Mantener el cuadro centrado si se aplica el tamaño mínimo
        const finalX1 = finalWidth === minBoxSize ? 
            (adjustedX1 + adjustedX2 - minBoxSize) / 2 : adjustedX1;
        const finalY1 = finalHeight === minBoxSize ? 
            (adjustedY1 + adjustedY2 - minBoxSize) / 2 : adjustedY1;
        
        // Determinar color basado en confianza o discrepancia
        let boxColor;
        if (colorByDiscrepancy) {
          // Buscar si el producto está en discrepancias
          const isDiscrepancy = discrepancias.some(d => 
            d.encontrado === className || d.esperado === className
          );
          boxColor = isDiscrepancy ? 'rgba(227, 6, 19, 0.95)' : 'rgba(0, 170, 0, 0.95)'; // Mayor opacidad para mejor visibilidad
        } else {
          // Color basado en confianza - escala desde rojo (baja) a verde (alta)
          const greenIntensity = Math.min(255, Math.floor(confidence * 255 * 1.5));
          const redIntensity = Math.min(255, Math.floor((1 - confidence) * 255 * 1.5));
          boxColor = `rgba(${redIntensity}, ${greenIntensity}, 0, 0.95)`;
        }
        
        // Dibujar rectángulo con líneas aún más gruesas
        ctx.strokeStyle = boxColor;
        ctx.lineWidth = Math.max(3.5, Math.min(5, confidence * 6)); // Líneas mucho más gruesas
        
        // Dibujar con efecto de doble línea para mayor visibilidad
        // Primero un contorno exterior más oscuro
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth += 1;
        ctx.strokeRect(finalX1, finalY1, finalWidth, finalHeight);
        
        // Luego el contorno interior con el color original
        ctx.strokeStyle = boxColor;
        ctx.lineWidth -= 1;
        ctx.strokeRect(finalX1, finalY1, finalWidth, finalHeight);
        
        // Dibujar fondo para etiqueta - más compacto
        if (showLabels) {
          const fontSize = Math.max(10, Math.min(13, confidence * 15)); // Tamaño de fuente ligeramente mayor
          ctx.font = `bold ${fontSize}px Arial`;
          
          // Medir el ancho del texto para ajustar tamaño del fondo
          const confText = `${Math.round(confidence * 100)}%`;
          const textWidth = Math.max(
            ctx.measureText(className).width,
            ctx.measureText(confText).width
          );
          
          const labelPadding = 4;
          const labelHeight = fontSize * 2 + labelPadding * 2;
          const labelWidth = textWidth + labelPadding * 2;
          
          // Fondo semi-transparente para etiqueta
          ctx.fillStyle = boxColor.replace('0.95', '0.98');
          // Dibujar rectángulo con esquinas redondeadas
          const labelRadius = 3;
          ctx.beginPath();
          ctx.roundRect(
            finalX1, 
            finalY1 - labelHeight - 2, 
            labelWidth, 
            labelHeight, 
            labelRadius
          );
          ctx.fill();
          
          // Dibujar texto
          ctx.fillStyle = 'white';
          ctx.fillText(className, finalX1 + labelPadding, finalY1 - labelHeight + fontSize + labelPadding);
          ctx.fillText(confText, finalX1 + labelPadding, finalY1 - labelPadding);
        }
      });
    }
    
    // Si modo de visualización es heatmap, aplicar mapa de calor de discrepancias
    if (visualMode === 'heatmap' && barcodesArray && barcodesArray.length > 0) {
      // Invertir el orden de los estantes para la visualización (el estante 1 abajo)
      const reversedBarcodesArray = [...barcodesArray].reverse();
      
      // Calcular altura aproximada de cada estante
      const shelfHeight = canvas.height / reversedBarcodesArray.length;
      
      // Recolectar datos de predicciones por estante para sizing más preciso
      const predictionsPerShelf = [];
      if (predictions && predictions.length > 0) {
        // Ordenar predicciones por Y (de arriba hacia abajo)
        const sortedPredictions = [...predictions].sort((a, b) => a.y1 - b.y1);
        
        // Distribuir predicciones en tantos grupos como estantes tengamos
        const numShelves = barcodesArray.length;
        const predictionHeight = canvas.height / numShelves;
        
        // Inicializar arrays vacíos para cada estante
        for (let i = 0; i < numShelves; i++) {
          predictionsPerShelf[i] = [];
        }
        
        // Asignar cada predicción al estante correspondiente según su posición Y
        sortedPredictions.forEach(pred => {
          const centerY = pred.y1 + (pred.y2 - pred.y1) / 2;
          const shelfIndex = Math.min(
            numShelves - 1, 
            Math.floor(centerY / predictionHeight)
          );
          predictionsPerShelf[shelfIndex].push(pred);
        });
        
        // Invertir para que coincida con el orden de visualización (estante 1 abajo)
        predictionsPerShelf.reverse();
      }
      
      // Para cada estante
      reversedBarcodesArray.forEach((shelf, visualIndex) => {
        if (!shelf || shelf.length === 0) return;
        
        // El índice real en el array original (invertido para visualización)
        const shelfIndex = barcodesArray.length - 1 - visualIndex;
        
        // Obtener predicciones para este estante si existen
        const shelfPredictions = predictionsPerShelf[visualIndex] || [];
        
        // Encontrar el estante del planograma alineado con este estante real
        let planShelfIndex = -1;
        if (shelfAlignment.length > 0) {
          // Buscar en el alineamiento qué fila del planograma corresponde a este estante
          planShelfIndex = shelfAlignment.findIndex(idx => idx === shelfIndex);
        }
        
        // Calcular ancho de cada producto - más preciso
        const productWidth = canvas.width / shelf.length;
        
        // Ajustar el espaciado para una distribución más uniforme
        // Incrementar espaciado y desplazar ligeramente a la derecha
        const spacingFactor = 0.12; // 12% de espaciado entre productos
        const rightShift = productWidth * 0.05; // Desplazamiento a la derecha de un 5%
        const productPadding = Math.max(3, Math.floor(productWidth * spacingFactor)); // Mínimo 3px de padding
        const productHeight = Math.max(shelfHeight * 0.92, 12); // 92% de altura, mínimo 12px
        const productTopPadding = (shelfHeight - productHeight) / 2; // Centrar verticalmente
        
        // Para cada producto
        shelf.forEach((barcode, productIndex) => {
          // Verificar si hay discrepancia
          // Si tenemos el índice del planograma alineado, usar esa fila para buscar discrepancias
          let key = `${shelfIndex}-${productIndex}`;
          if (planShelfIndex !== -1) {
            // Usar el índice del planograma alineado para una mejor correspondencia
            key = `${planShelfIndex}-${productIndex}`;
          }
          
          const hasDiscrepancy = discrepancyMap.has(key);
          
          // Intentar encontrar la predicción específica para este producto
          const productPredictions = shelfPredictions.filter(pred => {
            // Calcular el centro horizontal de la predicción
            const predCenter = pred.x1 + (pred.x2 - pred.x1) / 2;
            // Calcular el rango horizontal para este producto con más margen a la derecha
            const prodLeft = productIndex * productWidth - productWidth * 0.05; // Ampliar margen izquierdo
            const prodRight = (productIndex + 1) * productWidth + productWidth * 0.10; // Ampliar margen derecho aún más
            // Verificar si el centro de la predicción está dentro del rango
            return predCenter >= prodLeft && predCenter < prodRight;
          });
          
          // Calcular posición base del producto con mejor distribución espacial
          // Desplazar ligeramente hacia la derecha
          const productBaseX = productIndex * productWidth + rightShift;
          const productBaseY = visualIndex * shelfHeight;
          
          // Ajustar x e y para centrar el producto en su espacio
          let x = productBaseX + productPadding;
          let y = productBaseY + productTopPadding;
          
          // Calcular ancho y alto con espaciado mejorado
          let adjustedWidth = productWidth - (productPadding * 2);
          let adjustedHeight = productHeight;
          
          // Si hay predicciones para este producto, refinar dimensiones usando esos datos
          if (productPredictions.length > 0) {
            // Calcular dimensiones más precisas basadas en el promedio de las predicciones
            // con ponderación según confianza
            let totalConfidence = 0;
            let weightedX1 = 0, weightedY1 = 0, weightedX2 = 0, weightedY2 = 0;
            
            productPredictions.forEach(p => {
              const weight = p.confidence;
              totalConfidence += weight;
              weightedX1 += p.x1 * weight;
              weightedY1 += p.y1 * weight;
              weightedX2 += p.x2 * weight;
              weightedY2 += p.y2 * weight;
            });
            
            if (totalConfidence > 0) {
              // Obtener promedio ponderado
              const avgX1 = weightedX1 / totalConfidence;
              const avgY1 = weightedY1 / totalConfidence;
              const avgX2 = weightedX2 / totalConfidence;
              const avgY2 = weightedY2 / totalConfidence;
              
              // Calcular ancho y alto del producto detectado
              const detectedWidth = avgX2 - avgX1;
              const detectedHeight = avgY2 - avgY1;
              
              // Determinar el tipo de producto basado en la relación de aspecto
              const productType = determineProductType(
                { x1: avgX1, y1: avgY1, x2: avgX2, y2: avgY2 }, 
                barcode
              );
              
              // Ajustar las dimensiones según el tipo de producto
              let aspectRatioAdjustment = 1.0;
              let heightExpansion = 1.0;
              
              switch (productType) {
                case 'bottle':
                  // Las botellas suelen ser altas, asegurarse de capturar toda la altura
                  aspectRatioAdjustment = 0.9; // Reducir ancho un poco
                  heightExpansion = 1.15;      // Aumentar altura
                  break;
                case 'box':
                  // Las cajas son más cuadradas
                  aspectRatioAdjustment = 1.05; // Ligeramente más ancho
                  heightExpansion = 1.05;       // Ligeramente más alto
                  break;
                case 'can':
                  // Las latas son más circulares
                  aspectRatioAdjustment = 1.0;
                  heightExpansion = 1.0;
                  break;
                case 'packet':
                  // Los paquetes son rectangulares
                  aspectRatioAdjustment = 1.1;  // Más ancho
                  heightExpansion = 0.95;       // Ligeramente menos alto
                  break;
                case 'flat':
                  // Productos planos y anchos
                  aspectRatioAdjustment = 1.15; // Más ancho
                  heightExpansion = 0.9;        // Menos alto
                  break;
                default:
                  // Ajuste por defecto
                  aspectRatioAdjustment = 1.0;
                  heightExpansion = 1.0;
              }
              
              // Ajuste para centrado horizontal - desplazar más a la derecha
              const horizontalShift = detectedWidth * 0.08; // 8% de ajuste para desplazar a la derecha
              
              // Limitar a los bordes del espacio asignado para este producto
              // con un margen de tolerancia para mejor precisión
              const tolerance = productWidth * 0.20; // 20% de tolerancia
              
              // Calcular dimensiones ajustadas según el tipo de producto
              const adjustedWidthByType = detectedWidth * aspectRatioAdjustment;
              const adjustedHeightByType = detectedHeight * heightExpansion;
              
              // Calcular el centro del producto para posicionamiento
              const centerX = (avgX1 + avgX2) / 2;
              const centerY = (avgY1 + avgY2) / 2;
              
              // Calcular nuevas coordenadas basadas en el centro y las dimensiones ajustadas
              const adjustedX1 = centerX - (adjustedWidthByType / 2);
              const adjustedY1 = centerY - (adjustedHeightByType / 2);
              const adjustedX2 = centerX + (adjustedWidthByType / 2);
              const adjustedY2 = centerY + (adjustedHeightByType / 2);
              
              // Asegurar que el producto se mantenga dentro de su espacio asignado pero permitiendo
              // cierta flexibilidad para una visualización más precisa
              // Aplicar más desplazamiento a la derecha reduciendo el ajuste izquierdo
              const minX = Math.max(
                productBaseX - tolerance * 0.7, 
                adjustedX1 - horizontalShift * 0.5
              );
              const maxX = Math.min(
                productBaseX + productWidth + tolerance * 1.3, 
                adjustedX2 + horizontalShift * 1.5
              );
              
              // Aplicar restricciones estrictas para que los productos estén contenidos dentro de los límites del estante
            const shelfTop = visualIndex * shelfHeight;
            const shelfBottom = (visualIndex + 1) * shelfHeight;
            
              // Aplicar márgenes internos para asegurar que los productos no toquen los bordes del estante
              const topMargin = 5; // 5px de margen desde el borde superior del estante
              const bottomMargin = 5; // 5px de margen desde el borde inferior del estante
              
              // Restringir la posición Y al área delimitada del estante, respetando los márgenes
              // Priorizar mantener el producto dentro del estante sobre mantener sus proporciones originales
              const minY = Math.max(shelfTop + topMargin, adjustedY1);
              const maxY = Math.min(shelfBottom - bottomMargin, adjustedY2);
              
              // Aplicar límites mejorados
              x = minX;
              y = minY;
              adjustedWidth = maxX - minX;
              adjustedHeight = maxY - minY;
              
              // Asegurar dimensiones mínimas para visibilidad, adaptadas al tipo de producto
              const minWidthByType = productType === 'bottle' ? 15 : 20;
              const minHeightByType = productType === 'bottle' ? 25 : 18;
              
              adjustedWidth = Math.max(minWidthByType, adjustedWidth);
              adjustedHeight = Math.max(minHeightByType, adjustedHeight);
              
              // Si el producto es muy pequeño, centrar en el espacio detectado
              if (adjustedWidth < productWidth * 0.3) {
                const center = (avgX1 + avgX2) / 2;
                x = center - (adjustedWidth / 2) + horizontalShift; // Desplazar a la derecha
              }
              
              // Ajustar dimensiones según tipo, pero siempre respetando los límites del estante
              // Calcular altura máxima disponible en este espacio del estante
              const maxAvailableHeight = shelfBottom - shelfTop - (topMargin + bottomMargin);
              
              // Para productos tipo botella, ajustar proporciones pero dentro del estante
              if (productType === 'bottle') {
                // Ideal: altura = 2 * ancho, pero limitado por el espacio del estante
                const idealHeight = adjustedWidth * 2;
                // Limitar al espacio disponible
                adjustedHeight = Math.min(idealHeight, maxAvailableHeight);
                // Centrar verticalmente dentro del espacio disponible
                y = shelfTop + topMargin + (maxAvailableHeight - adjustedHeight) / 2;
              }
              
              // Para productos tipo caja, mantener una relación de aspecto más equilibrada
              else if (productType === 'box') {
                // Relación máxima altura/ancho = 1.5
                if (adjustedHeight > adjustedWidth * 1.5) {
                  adjustedHeight = Math.min(adjustedWidth * 1.5, maxAvailableHeight);
                }
                // Centrar verticalmente
                y = shelfTop + topMargin + (maxAvailableHeight - adjustedHeight) / 2;
              }
              
              // Para otros tipos de productos, asegurar que estén dentro del estante
              else {
                // Limitar al espacio disponible
                if (adjustedHeight > maxAvailableHeight) {
                  adjustedHeight = maxAvailableHeight;
                  // Centrar verticalmente
                  y = shelfTop + topMargin;
                }
              }
              
              // Verificación final para asegurar que el producto se mantiene dentro del estante
              if (y + adjustedHeight > shelfBottom - bottomMargin) {
                // Si aún sobresale, reducir altura para que encaje
                adjustedHeight = shelfBottom - bottomMargin - y;
              }
            }
          }
          
          // Color basado en tipo de discrepancia - colores más intensos
          let overlayColor;
          if (hasDiscrepancy) {
            const disc = discrepancyMap.get(key);
            if (disc.encontrado === 'vacío') {
              overlayColor = 'rgba(227, 6, 19, 0.40)'; // Rojo OXXO - Falta producto
            } else if (disc.esperado === 'vacío') {
              overlayColor = 'rgba(255, 165, 0, 0.40)'; // Naranja - Producto no esperado
            } else {
              overlayColor = 'rgba(255, 205, 0, 0.40)'; // Amarillo - Producto incorrecto
            }
          } else {
            // Colorear mejor productos correctos
            overlayColor = barcode === 'EMPTY' ? 
              'rgba(200, 200, 200, 0.30)' : // Gris claro para vacíos
              'rgba(0, 170, 0, 0.30)';      // Verde para productos correctos
          }
          
          // Dibujar overlay con bordes más gruesos y redondeados
          ctx.fillStyle = overlayColor;
          ctx.beginPath();
          const cornerRadius = 4; // Bordes redondeados ligeramente más grandes
          ctx.roundRect(x, y, adjustedWidth, adjustedHeight, cornerRadius);
          ctx.fill();
          
          // Dibujar borde más grueso con mayor contraste
          const borderColor = hasDiscrepancy ? 
            'rgba(227, 6, 19, 0.90)' : // Rojo OXXO con mayor opacidad
            (barcode === 'EMPTY' ? 'rgba(150, 150, 150, 0.80)' : 'rgba(0, 150, 0, 0.80)'); // Mayor opacidad
          
          // Dibujar borde con efecto de doble línea para mayor visibilidad
          // Primero un contorno exterior más oscuro
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.lineWidth = hasDiscrepancy ? 4.5 : 3.5; // Líneas considerablemente más gruesas
          ctx.stroke();
          
          // Luego el contorno interior con el color original
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = hasDiscrepancy ? 3.5 : 2.5;
          ctx.stroke();
          
          // Mostrar etiqueta
          if (showLabels) {
            // Etiquetas más pequeñas y adaptativas al tamaño
            const labelPadding = 2;
            const labelX = x + labelPadding;
            const labelY = y + labelPadding;
            // Ajustar ancho de la etiqueta según el tamaño disponible
            const maxLabelWidth = Math.min(adjustedWidth - (labelPadding * 2), 100);
            
            // Estimar si hay espacio suficiente para la etiqueta
            if (maxLabelWidth > 35 && adjustedHeight > 25) {
              // Tamaño de etiqueta basado en espacio disponible
              const labelHeight = hasDiscrepancy ? 25 : (barcode === 'EMPTY' ? 18 : 18);
              
              // Background con opacidad adaptativa según tamaño
              const bgOpacity = Math.min(0.80, 0.65 + (maxLabelWidth / 200)); // Mayor opacidad
              ctx.fillStyle = `rgba(0, 0, 0, ${bgOpacity})`;
              
              // Dibujar fondo con esquinas redondeadas
              ctx.beginPath();
              ctx.roundRect(labelX, labelY, maxLabelWidth, labelHeight, 2);
              ctx.fill();
              
              // Texto en tamaño adaptativo
              const fontSize = Math.max(9, Math.min(12, maxLabelWidth / 10));
              ctx.font = `bold ${fontSize}px Arial`; // Texto en negrita para mayor visibilidad
              ctx.fillStyle = 'white';
              
              if (hasDiscrepancy) {
                const disc = discrepancyMap.get(key);
                
                // Truncar textos largos
                const truncateText = (text, maxChars) => {
                  if (!text) return "N/A";
                  return text.length > maxChars ? text.substring(0, maxChars) + '...' : text;
                };
                
                const maxChars = Math.floor(maxLabelWidth / (fontSize * 0.6));
                
                if (maxLabelWidth > 60) {
                  // Mostrar esperado y encontrado
                  ctx.fillText(`Esp: ${truncateText(disc.esperado, maxChars)}`, labelX + 2, labelY + fontSize + 1);
                  ctx.fillText(`Enc: ${truncateText(disc.encontrado, maxChars)}`, labelX + 2, labelY + (fontSize * 2) + 2);
                } else {
                  // Texto compacto para etiquetas pequeñas
                  ctx.fillText(disc.encontrado === 'vacío' ? '❌ Falta' : '⚠️ Error', labelX + 2, labelY + fontSize + 2);
                }
              } else if (barcode === 'EMPTY') {
                ctx.fillText('Vacío', labelX + 2, labelY + fontSize + 2);
              } else {
                // Truncar código de producto
                const displayText = barcode.length > Math.floor(maxLabelWidth / (fontSize * 0.6)) ? 
                  barcode.substring(0, Math.floor(maxLabelWidth / (fontSize * 0.6))) + '...' : barcode;
                ctx.fillText(displayText, labelX + 2, labelY + fontSize + 2);
              }
            } else if (labelX > 15) {
              // Para etiquetas muy pequeñas, mostrar solo indicador de estado
              const miniSize = Math.min(10, Math.max(5, adjustedWidth / 6)); // Ligeramente más grande
              const miniX = x + adjustedWidth / 2;
              const miniY = y + adjustedHeight / 2;
              
              ctx.beginPath();
              ctx.arc(miniX, miniY, miniSize, 0, Math.PI * 2);
              
              // Color según estado con mayor contraste
              if (hasDiscrepancy) {
                ctx.fillStyle = 'rgba(227, 6, 19, 0.95)'; // Rojo OXXO para error
              } else if (barcode === 'EMPTY') {
                ctx.fillStyle = 'rgba(150, 150, 150, 0.85)'; // Gris para vacío
              } else {
                ctx.fillStyle = 'rgba(0, 150, 0, 0.85)'; // Verde para correcto
              }
              
              ctx.fill();
              
              // Añadir borde para mayor visibilidad
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
              ctx.lineWidth = 1.5;
              ctx.stroke();
            }
          }
        });
      });
    }
  }, [visualMode, showDetectionBoxes, showLabels, colorByDiscrepancy]);

  // Handle tienda selection
  const handleTiendaChange = useCallback((e) => {
    setSelectedTienda(e.target.value);
    setSelectedPlanograma('');
    setResult(null);
    setError(null);
  }, []);

  // Handle planograma selection
  const handlePlanogramaChange = useCallback((e) => {
    setSelectedPlanograma(e.target.value);
    setResult(null);
    setError(null);
  }, []);

  // Upload image to Firebase Storage and get download URL with progress tracking
  const uploadImageAndGetUrl = useCallback(async (file) => {
    // Generate a unique filename with timestamp and random string
    const randomId = Math.random().toString(36).substring(2, 10);
    const filename = `planogram_${Date.now()}_${randomId}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    // Optimizar imagen antes de subir para reducir tamaño pero mantener calidad
    const optimizedImageBlob = await optimizeImageForUpload(file);
    
    const storageRef = ref(storage, `planogram_images/${filename}`);
    
    // Reset progress
    setUploadProgress(0);
    
    // Upload file to Firebase Storage with better error handling
    const uploadTask = uploadBytesResumable(storageRef, optimizedImageBlob || file);
    
    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Update progress state
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress(progress);
        },
        (error) => {
          // Handle specific error types
          let errorMessage = 'Error al subir la imagen.';
          
          switch (error.code) {
            case 'storage/unauthorized':
              errorMessage = 'No tiene permiso para subir imágenes.';
              break;
            case 'storage/canceled':
              errorMessage = 'La subida fue cancelada.';
              break;
            case 'storage/server-file-wrong-size':
              errorMessage = 'Error en el servidor al procesar la imagen.';
              break;
            case 'storage/quota-exceeded':
              errorMessage = 'Se ha excedido la cuota de almacenamiento.';
              break;
            case 'storage/unknown':
            default:
              errorMessage = 'Error desconocido al subir la imagen. Intente con una imagen más pequeña.';
              break;
          }
          
          console.error('Error uploading image:', error);
          reject(new Error(errorMessage));
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('Imagen subida exitosamente:', downloadURL);
            resolve(downloadURL);
          } catch (error) {
            console.error('Error getting download URL:', error);
            reject(new Error('Error al obtener la URL de la imagen.'));
          }
        }
      );
    });
  }, []);

  // Optimiza la imagen para subida a Firebase sin comprometer la calidad para el análisis
  const optimizeImageForUpload = async (file) => {
    // Si el archivo es muy grande (>5MB), comprimirlo
    if (file.size <= 5 * 1024 * 1024) {
      // Para archivos pequeños, usa el original
      return null;
    }
    
    try {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            // Mantener dimensiones pero reducir calidad para almacenamiento
            canvas.width = img.width;
            canvas.height = img.height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, img.width, img.height);
            
            // Usar un formato más eficiente para almacenamiento (calidad 0.8)
            canvas.toBlob((blob) => {
              if (blob) {
                console.log(`Imagen optimizada: original ${(file.size / 1024 / 1024).toFixed(2)}MB, optimizada ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
                resolve(blob);
              } else {
                // Si falla la compresión, usar el original
                resolve(null);
              }
            }, 'image/jpeg', 0.8);
          };
          img.src = e.target.result;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error('Error optimizando imagen:', error);
      return null;
    }
  };

  // Convert image data URL to base64 string without prefix
  const convertDataURLToBase64 = useCallback((dataURL) => {
    if (!dataURL) return '';
    const parts = dataURL.split(',');
    return parts.length > 1 ? parts[1] : '';
  }, []);

  // Algoritmo para encontrar la mejor alineación entre dos arrays de productos
  const encontrarMejorAlineacion = (arrayPlan, arrayReal) => {
    // Inicializar resultado
    const resultado = [];
    
    // Si alguno de los arrays está vacío, manejar caso especial
    if (!arrayPlan.length || !arrayReal.length) {
      if (arrayPlan.length) {
        // Todos los productos del plan faltan
        arrayPlan.forEach((producto, pos) => {
          resultado.push({
            tipo: 'discrepancia',
            posicionPlan: pos,
            productoPlan: producto,
            productoReal: null
          });
        });
      } else if (arrayReal.length) {
        // Todos los productos reales son extras
        arrayReal.forEach((producto, pos) => {
          if (producto !== 'EMPTY') {
            resultado.push({
              tipo: 'discrepancia',
              posicionPlan: null,
              productoPlan: 'vacío',
              productoReal: producto
            });
          }
        });
      }
      return resultado;
    }
    
    // Crear mapa para productos reales
    const productosRealMap = new Map();
    arrayReal.forEach((producto, pos) => {
      if (!productosRealMap.has(producto)) {
        productosRealMap.set(producto, []);
      }
      productosRealMap.get(producto).push(pos);
    });
    
    // Para cada producto en el plan, buscar la mejor coincidencia
    arrayPlan.forEach((productoPlan, posPlan) => {
      if (productoPlan === 'EMPTY') {
        // Si es vacío, buscar vacío en real
        const posicionesEmpty = productosRealMap.get('EMPTY') || [];
        if (posicionesEmpty.length > 0) {
          // Encontrar el vacío más cercano
          const posReal = posicionesEmpty.shift(); // Tomar el primero disponible
          resultado.push({
            tipo: 'coincidencia',
            posicionPlan: posPlan,
            productoPlan,
            posicionReal: posReal,
            productoReal: 'EMPTY'
          });
        } else {
          // No hay vacío correspondiente
          resultado.push({
            tipo: 'discrepancia',
            posicionPlan: posPlan,
            productoPlan,
            productoReal: null
          });
        }
      } else {
        // Buscar coincidencia exacta para producto
        const posiciones = productosRealMap.get(productoPlan) || [];
        
        if (posiciones.length > 0) {
          // Encontrar la posición más cercana
          const posReal = posiciones.sort((a, b) => 
            Math.abs(a - posPlan) - Math.abs(b - posPlan)
          )[0];
          
          // Eliminar esta posición para que no se reutilice
          productosRealMap.set(
            productoPlan, 
            posiciones.filter(p => p !== posReal)
          );
          
          resultado.push({
            tipo: 'coincidencia',
            posicionPlan: posPlan,
            productoPlan,
            posicionReal: posReal,
            productoReal: productoPlan
          });
        } else {
          // No hay coincidencia para este producto
          resultado.push({
            tipo: 'discrepancia',
            posicionPlan: posPlan,
            productoPlan,
            productoReal: null
          });
        }
      }
    });
    
    // Verificar productos reales no asignados
    const posicionesRealesUsadas = new Set(
      resultado
        .filter(item => item.tipo === 'coincidencia')
        .map(item => item.posicionReal)
    );
    
    // Añadir discrepancias para productos reales no asignados
    arrayReal.forEach((productoReal, posReal) => {
      if (!posicionesRealesUsadas.has(posReal) && productoReal !== 'EMPTY') {
        resultado.push({
          tipo: 'discrepancia',
          posicionPlan: null,
          productoPlan: 'vacío',
          posicionReal: posReal,
          productoReal
        });
      }
    });
    
    return resultado;
  };

  // Calcular área de solapamiento entre dos predicciones (función simple sin useCallback)
  const calculateOverlap = (pred1, pred2) => {
    // Calcular coordenadas del solapamiento
    const overlapX1 = Math.max(pred1.x1, pred2.x1);
    const overlapY1 = Math.max(pred1.y1, pred2.y1);
    const overlapX2 = Math.min(pred1.x2, pred2.x2);
    const overlapY2 = Math.min(pred1.y2, pred2.y2);
    
    // Verificar si hay solapamiento
    if (overlapX1 < overlapX2 && overlapY1 < overlapY2) {
      return (overlapX2 - overlapX1) * (overlapY2 - overlapY1);
    }
    
    return 0; // No hay solapamiento
  };

  // Función para agrupar predicciones que se solapan (función simple sin useCallback)
  const groupOverlappingPredictions = (predictions) => {
    if (!predictions || !Array.isArray(predictions) || predictions.length === 0) {
      return [];
    }
    
    // Clonar las predicciones para no modificar las originales
    const predictionsCopy = [...predictions];
    const groups = [];
    
    // Umbral de solapamiento (área solapada / área mínima)
    const overlapThreshold = 0.5;
    
    while (predictionsCopy.length > 0) {
      const current = predictionsCopy.shift();
      const group = [current];
      
      // Comprobar solapamiento con las predicciones restantes
      let i = 0;
      while (i < predictionsCopy.length) {
        const other = predictionsCopy[i];
        
        // Calcular solapamiento
        const overlapArea = calculateOverlap(current, other);
        const area1 = (current.x2 - current.x1) * (current.y2 - current.y1);
        const area2 = (other.x2 - other.x1) * (other.y2 - other.y1);
        const minArea = Math.min(area1, area2);
        
        // Verificar si hay solapamiento significativo y es el mismo producto
        if (overlapArea / minArea > overlapThreshold && current.class === other.class) {
          group.push(other);
          predictionsCopy.splice(i, 1);
        } else {
          i++;
        }
      }
      
      groups.push(group);
    }
    
    return groups;
  };

  // Función para combinar resultados de múltiples modelos (función simple sin useCallback)
  const combineResults = (results) => {
    if (results.length === 0) return null;
    if (results.length === 1) return results[0];
    
    // Extraer los metadatos del primer resultado
    const metadata = results[0].metadata;
    
    // Obtener todas las comparaciones y predicciones
    const comparaciones = results.map(res => res.comparacion);
    const allPredictions = results.filter(res => res.predictions && res.predictions.length > 0)
                                  .flatMap(res => res.predictions);
    
    // Calcular estadísticas
    const estadisticas = {
      modelos: results.length,
      totalDiscrepancias: comparaciones.reduce((sum, comp) => sum + (comp?.discrepancias?.length || 0), 0),
      discrepanciasPorModelo: comparaciones.map(comp => comp?.discrepancias?.length || 0),
      mejorModelo: results.reduce((best, current) => {
        const currentDiscrepancias = current.comparacion?.discrepancias?.length || Infinity;
        const bestDiscrepancias = best.comparacion?.discrepancias?.length || Infinity;
        return currentDiscrepancias < bestDiscrepancias ? current : best;
      }, results[0]),
      modelosInfo: results.map(res => ({
        modelId: res.metadata.modelId,
        modelName: res.metadata.modelName,
        discrepancias: res.comparacion?.discrepancias?.length || 0
      }))
    };
    
    // Seleccionar el resultado con menos discrepancias como "mejor resultado"
    const mejorResultado = estadisticas.mejorModelo;
    
    // Crear mapa de frecuencia para productos detectados por estante
    const productosPorEstanteMap = new Map();
    
    // Procesar barcodesArray de cada modelo
    results.forEach(result => {
      if (!result.barcodesArray || !Array.isArray(result.barcodesArray)) return;
      
      result.barcodesArray.forEach((shelf, shelfIndex) => {
        if (!shelf || !Array.isArray(shelf)) return;
        
        if (!productosPorEstanteMap.has(shelfIndex)) {
          productosPorEstanteMap.set(shelfIndex, new Map());
        }
        
        const shelfMap = productosPorEstanteMap.get(shelfIndex);
        
        shelf.forEach((barcode, position) => {
          // Verificar que el código de barras sea válido
          if (typeof barcode !== 'string') return;
          
          const key = `${position}:${barcode}`;
          if (!shelfMap.has(key)) {
            shelfMap.set(key, 0);
          }
          shelfMap.set(key, shelfMap.get(key) + 1);
        });
      });
    });
    
    // Construir barcodesArray consensuado (el producto más detectado en cada posición)
    const consensusBarcodesArray = [];
    
    // Ordenar los estantes por índice para mantener consistencia
    const shelfIndices = [...productosPorEstanteMap.keys()].sort((a, b) => a - b);
    
    shelfIndices.forEach(shelfIndex => {
      const shelfMap = productosPorEstanteMap.get(shelfIndex);
      
      // Agrupar por posición
      const positionMap = new Map();
      
      shelfMap.forEach((count, key) => {
        const parts = key.split(':');
        if (parts.length !== 2) return;
        
        const position = parts[0];
        const barcode = parts[1];
        
        if (!positionMap.has(position)) {
          positionMap.set(position, []);
        }
        positionMap.get(position).push({ barcode, count });
      });
      
      // Ordenar por posición y seleccionar el barcode más frecuente para cada posición
      const shelf = [];
      const positions = [...positionMap.keys()].sort((a, b) => Number(a) - Number(b));
      
      positions.forEach(position => {
        const barcodes = positionMap.get(position);
        // Ordenar por frecuencia (descendente)
        barcodes.sort((a, b) => b.count - a.count);
        // Seleccionar el más frecuente
        shelf.push(barcodes[0].barcode);
      });
      
      consensusBarcodesArray.push(shelf);
    });
    
    // Combinar predicciones de todos los modelos, eliminando duplicados
    const combinedPredictions = [];
    if (allPredictions && allPredictions.length > 0) {
      // Agrupar predicciones por áreas solapadas
      const groupedPredictions = groupOverlappingPredictions(allPredictions);
      
      // Para cada grupo, seleccionar la predicción con mayor confianza
      groupedPredictions.forEach(group => {
        // Ordenar por confianza (descendente)
        group.sort((a, b) => b.confidence - a.confidence);
        // Tomar la predicción con mayor confianza
        combinedPredictions.push(group[0]);
      });
    }
    
    // Crear resultado combinado
    return {
      barcodesArray: consensusBarcodesArray.length > 0 ? consensusBarcodesArray : mejorResultado.barcodesArray,
      comparacion: mejorResultado.comparacion,
      predictions: combinedPredictions.length > 0 ? combinedPredictions : mejorResultado.predictions,
      imageSize: mejorResultado.imageSize,
      metadata: {
        ...metadata,
        combinacion: true,
        estadisticas
      },
      multiModelResults: results.map(res => ({
        modelId: res.metadata.modelId,
        modelName: res.metadata.modelName,
        discrepancias: res.comparacion?.discrepancias?.length || 0,
        barcodesArray: res.barcodesArray
      }))
    };
  };

  // Algoritmo de coincidencia avanzada para arrays anidados con pesos adaptativos
  const advancedArrayComparison = (arrayPlan, arrayReal) => {
    if (!arrayPlan || !arrayReal || !arrayPlan.length || !arrayReal.length) {
      return {
        similitud: 0,
        discrepancias: []
      };
    }

    // Calcular matriz de coincidencia entre ambos arrays
    const matrizCoincidencia = [];
    let coincidenciasMaximas = 0;
    let totalProductos = 0;

    // Análisis preliminar: calcular longitudes mínimas, máximas y promedios para alineación
    const shelfLengthsReal = arrayReal.map(shelf => shelf.length);
    const shelfLengthsPlan = arrayPlan.map(shelf => shelf.length);
    
    const avgLengthReal = shelfLengthsReal.reduce((a, b) => a + b, 0) / arrayReal.length;
    const avgLengthPlan = shelfLengthsPlan.reduce((a, b) => a + b, 0) / arrayPlan.length;
    
    // Calcular factor de escala entre planograma y realograma
    // Esto ayuda a ajustar mejor cuando hay diferencia en la densidad de productos
    const scaleFactor = avgLengthReal / avgLengthPlan || 1;
    
    // Matriz de distancias para el algoritmo DTW (Dynamic Time Warping)
    // Permite alinear secuencias con diferentes longitudes
    const dtwMatrix = Array(arrayPlan.length).fill().map(() => 
      Array(arrayReal.length).fill(Number.MAX_SAFE_INTEGER));
    
    // Para cada nivel en el plan
    for (let i = 0; i < arrayPlan.length; i++) {
      matrizCoincidencia[i] = [];
      
      // Calcular posible rango de búsqueda con tolerancia adaptativa
      // Mayor tolerancia para estantes más alejados entre sí
      const tolerancia = Math.max(1, Math.floor(arrayPlan.length * 0.2));
      const rangoBusqueda = [];
      
      for (let j = Math.max(0, i - tolerancia); 
           j <= Math.min(arrayReal.length - 1, i + tolerancia); j++) {
        rangoBusqueda.push(j);
      }
      
      // Para cada posible nivel en rango de búsqueda
      for (const j of rangoBusqueda) {
        const nivelPlan = arrayPlan[i] || [];
        const nivelReal = arrayReal[j] || [];
        
        // Calcular métricas de similitud
        let coincidencias = 0;
        let totalNivel = nivelPlan.length;
        
        // Crear mapa de frecuencia para productos en nivel real
        const productosRealMap = new Map();
        nivelReal.forEach(producto => {
          if (producto === 'EMPTY') return; // Ignorar vacíos para el mapa
          productosRealMap.set(producto, (productosRealMap.get(producto) || 0) + 1);
        });

        // Buscar cada producto del plan en el nivel real
        nivelPlan.forEach(producto => {
          if (producto === 'EMPTY') {
            // Buscar espacio vacío explícito
            if (nivelReal.includes('EMPTY')) {
              coincidencias += 0.5; // Dar medio punto por coincidencia de vacío
            }
          } else {
            // Para productos reales, verificar en el mapa
            if (productosRealMap.has(producto) && productosRealMap.get(producto) > 0) {
              coincidencias += 1;
              productosRealMap.set(producto, productosRealMap.get(producto) - 1);
            }
          }
        });
        
        // Similitud de secuencia usando algoritmo de Levenshtein
        const levenshteinDistance = calculateLevenshteinDistance(nivelPlan, nivelReal);
        const maxLength = Math.max(nivelPlan.length, nivelReal.length);
        const sequenceSimilarity = maxLength > 0 ? 
          (1 - levenshteinDistance / maxLength) * 100 : 0;
          
        // Similitud de longitud (qué tan similares son en términos de número de productos)
        const lengthDiff = Math.abs(nivelPlan.length - nivelReal.length);
        const lengthSimilarity = Math.max(nivelPlan.length, nivelReal.length) > 0 ?
          (1 - lengthDiff / Math.max(nivelPlan.length, nivelReal.length)) * 100 : 0;
          
        // Factor de similitud combinado
        // Ponderación: 60% coincidencia de productos, 25% similitud de secuencia, 15% similitud de longitud
        const factorSimilitud = (
          (totalNivel > 0 ? (coincidencias / totalNivel) * 0.6 : 0) +
          (sequenceSimilarity * 0.0025) +
          (lengthSimilarity * 0.0015)
        ) * 100;
        
        // Almacenar en matriz de coincidencia
        matrizCoincidencia[i][j] = {
          coincidencias,
          totalNivel,
          factorSimilitud,
          sequenceSimilarity,
          lengthSimilarity,
          nivelPlan: i,
          nivelReal: j
        };
        
        // También almacenar en matriz DTW para alineamiento global
        dtwMatrix[i][j] = 100 - factorSimilitud; // Convertir similitud a distancia
        
        // Actualizar estadísticas globales
        coincidenciasMaximas += coincidencias;
        totalProductos += totalNivel;
      }
    }
    
    // Calcular alineamiento óptimo usando DTW (Dynamic Time Warping)
    const shelfAlignment = findOptimalShelfAlignment(dtwMatrix, arrayPlan.length, arrayReal.length);
    
    // Calcular porcentaje de similitud global
    const similitud = totalProductos > 0 ? (coincidenciasMaximas / totalProductos) * 100 : 0;
    
    // Procesar discrepancias con algoritmo mejorado
    let discrepancias = [];
    
    // Para cada nivel del plan, encontrar discrepancias específicas basadas en el alineamiento óptimo
    for (let i = 0; i < arrayPlan.length; i++) {
      // Obtener el nivel real correspondiente según el alineamiento calculado
      const j = shelfAlignment[i];
      
      if (j === undefined || j < 0 || j >= arrayReal.length) {
        // Este nivel del plan no tiene correspondencia en el realograma
        // Todos los productos son faltantes
        const nivelPlan = arrayPlan[i] || [];
        nivelPlan.forEach((producto, columna) => {
          if (producto !== 'EMPTY') {
            discrepancias.push({
              fila: i,
              columna,
              esperado: producto,
              encontrado: 'vacío'
            });
          }
        });
        continue;
      }
      
      const nivelPlan = arrayPlan[i] || [];
      const nivelReal = arrayReal[j] || [];
      
      // Algoritmo de alineación para encontrar mejor correspondencia
      const alineacion = encontrarMejorAlineacion(nivelPlan, nivelReal);
      
      // Procesar discrepancias basadas en la alineación
      alineacion.forEach(item => {
        if (item.tipo === 'discrepancia') {
          discrepancias.push({
            fila: i,
            columna: item.posicionPlan !== null ? item.posicionPlan : 
                     (item.posicionReal !== null ? item.posicionReal : 0),
            esperado: item.productoPlan || 'vacío',
            encontrado: item.productoReal || 'vacío'
          });
        }
      });
    }
    
    // Verificar niveles reales no mapeados
    const nivelesMapeados = new Set(shelfAlignment);
    for (let j = 0; j < arrayReal.length; j++) {
      if (!nivelesMapeados.has(j)) {
        // Este nivel real no tiene correspondencia en el planograma
        const nivelReal = arrayReal[j] || [];
        nivelReal.forEach((producto, pos) => {
          if (producto !== 'EMPTY') {
            discrepancias.push({
              fila: arrayPlan.length, // Indicar que es un nivel extra
              columna: pos,
              esperado: 'vacío',
              encontrado: producto
            });
          }
        });
      }
    }
    
    return {
      similitud,
      coincidencias: coincidenciasMaximas,
      total: totalProductos,
      discrepancias,
      alineamiento: shelfAlignment // Incluir el alineamiento para uso en visualización
    };
  };
  
  // Función auxiliar para calcular la distancia de Levenshtein entre dos arrays
  const calculateLevenshteinDistance = (arr1, arr2) => {
    if (!arr1.length) return arr2.length;
    if (!arr2.length) return arr1.length;
    
    const matrix = Array(arr1.length + 1).fill().map(() => 
      Array(arr2.length + 1).fill(0)
    );
    
    // Inicializar primera fila y columna
    for (let i = 0; i <= arr1.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= arr2.length; j++) matrix[0][j] = j;
    
    // Rellenar matriz
    for (let i = 1; i <= arr1.length; i++) {
      for (let j = 1; j <= arr2.length; j++) {
        // Costo de sustitución: 0 si son iguales, 1 si son diferentes
        // Para productos vacíos, usar un costo menor para alinear mejor
        let cost;
        if (arr1[i-1] === arr2[j-1]) {
          cost = 0; // Igual
        } else if (arr1[i-1] === 'EMPTY' || arr2[j-1] === 'EMPTY') {
          cost = 0.5; // Uno es vacío
        } else {
          cost = 1; // Diferentes productos
        }
        
        matrix[i][j] = Math.min(
          matrix[i-1][j] + 1, // Eliminación
          matrix[i][j-1] + 1, // Inserción
          matrix[i-1][j-1] + cost // Sustitución
        );
      }
    }
    
    return matrix[arr1.length][arr2.length];
  };
  
  // Función para obtener nombres de productos a partir de códigos
  const fetchProductNames = async (productIds) => {
    if (!productIds || productIds.length === 0) return;
    
    try {
      console.log('Obteniendo nombres de productos...');
      const uniqueIds = [...new Set(productIds.filter(id => id !== 'EMPTY' && id !== 'vacío'))];
      
      // Crear un objeto para almacenar los nombres
      const names = {};
      
      // Obtener los nombres de cada producto
      for (const id of uniqueIds) {
        try {
          const producto = await obtenerProducto(id);
          if (producto && producto.nombre) {
            names[id] = producto.nombre;
          } else {
            names[id] = id; // Si no se encuentra el nombre, usar el ID
          }
        } catch (err) {
          console.warn(`Error al obtener producto ${id}:`, err);
          names[id] = id; // En caso de error, usar el ID
        }
      }
      
      // Añadir entradas para EMPTY y vacío
      names['EMPTY'] = 'Vacío';
      names['vacío'] = 'Vacío';
      
      console.log('Nombres de productos obtenidos:', names);
      setProductNames(names);
      
    } catch (error) {
      console.error('Error al obtener nombres de productos:', error);
      // Si falla, continuar con la operación normal pero sin nombres
    }
  };
  
  // Función para encontrar el alineamiento óptimo entre estantes usando Dynamic Time Warping
  const findOptimalShelfAlignment = (dtwMatrix, planLength, realLength) => {
    if (planLength === 0 || realLength === 0) return [];
    
    // Inicializar matriz acumulativa
    const accMatrix = Array(planLength).fill().map(() => 
      Array(realLength).fill(Number.MAX_SAFE_INTEGER));
    
    // Rellenar la primera celda
    accMatrix[0][0] = dtwMatrix[0][0];
    
    // Rellenar primera columna
    for (let i = 1; i < planLength; i++) {
      accMatrix[i][0] = accMatrix[i-1][0] + dtwMatrix[i][0];
    }
    
    // Rellenar primera fila
    for (let j = 1; j < realLength; j++) {
      accMatrix[0][j] = accMatrix[0][j-1] + dtwMatrix[0][j];
    }
    
    // Rellenar el resto de la matriz
    for (let i = 1; i < planLength; i++) {
      for (let j = 1; j < realLength; j++) {
        accMatrix[i][j] = dtwMatrix[i][j] + Math.min(
          accMatrix[i-1][j],   // Inserción
          accMatrix[i][j-1],   // Eliminación
          accMatrix[i-1][j-1]  // Diagonal (alineamiento)
        );
      }
    }
    
    // Reconstruir el camino óptimo
    const alignment = Array(planLength).fill(-1);
    let i = planLength - 1;
    let j = realLength - 1;
    
    // El último elemento siempre está alineado
    alignment[i] = j;
    
    // Recorrer la matriz desde el final hasta el principio
    while (i > 0 || j > 0) {
      if (i === 0) {
        j--;
      } else if (j === 0) {
        i--;
        alignment[i] = 0; // Alinear con el primer estante real
      } else {
        // Determinar la dirección óptima
        const minValue = Math.min(
          accMatrix[i-1][j],
          accMatrix[i][j-1],
          accMatrix[i-1][j-1]
        );
        
        if (minValue === accMatrix[i-1][j-1]) {
          // Movimiento diagonal - alineamiento entre i y j
          i--;
          j--;
          alignment[i] = j;
        } else if (minValue === accMatrix[i-1][j]) {
          // Movimiento hacia arriba - producto del plan sin correspondencia
          i--;
          // No asignar alineamiento para este nivel del plan
          alignment[i] = -1;
        } else {
          // Movimiento hacia la izquierda - producto real sin correspondencia
          j--;
        }
      }
    }
    
    // Validar alineamiento para niveles del plan sin correspondencia asignada
    for (let k = 0; k < alignment.length; k++) {
      if (alignment[k] === -1) {
        // Buscar el nivel real más cercano que no esté ya asignado
        let bestDistance = Number.MAX_SAFE_INTEGER;
        let bestRealIndex = -1;
        
        for (let j = 0; j < realLength; j++) {
          if (!alignment.includes(j)) {
            const distance = Math.abs(k - j);
            if (distance < bestDistance) {
              bestDistance = distance;
              bestRealIndex = j;
            }
          }
        }
        
        // Si encontramos un nivel no asignado y está a una distancia razonable
        if (bestRealIndex !== -1 && bestDistance <= 2) {
          alignment[k] = bestRealIndex;
        }
      }
    }
    
    return alignment;
  };

  // Procesar imagen con un solo modelo
  const processSingleModel = useCallback(async (base64Data, planogramData, modelConfig) => {
    try {
      // Process image with messi.js and custom options
      const processOptions = {
        apiKey: modelConfig.apiKey,
        emptyThresholdMultiplier: modelConfig.emptyThresholdMultiplier,
        shelfThreshold: modelConfig.shelfThreshold,
        confidence: modelConfig.confidence || 0.35, // Umbral de confianza
        enableProductSizing: true, // Habilitar ajuste de tamaño por tipo de producto
        productAspectRatios: {
          // Definir proporciones aproximadas para tipos de productos comunes
          default: { width: 1, height: 1.8 }, // Proporción por defecto para productos
          bottle: { width: 1, height: 3 },    // Botellas (más altas que anchas)
          box: { width: 1.5, height: 2 },     // Cajas
          can: { width: 1, height: 1.2 },     // Latas
          packet: { width: 1.3, height: 1.7 } // Paquetes
        }
      };
      
      const processResult = await processImageAndCompare(
        base64Data,
        planogramData,
        processOptions
      );
      
      if (processResult.error) {
        throw new Error(processResult.error);
      }
      
      // Si está habilitado el modo de alta precisión, usar algoritmo avanzado de comparación
      if (highPrecisionMode && processResult.barcodesArray && planogramData) {
        try {
          // Usar algoritmo avanzado en lugar del comparador simple
          const advancedCompResult = advancedArrayComparison(planogramData, processResult.barcodesArray);
          
          // Mantener las predicciones y otras propiedades, pero actualizar la comparación
          processResult.comparacion = {
            discrepancias: advancedCompResult.discrepancias,
            similitud: advancedCompResult.similitud,
            coincidencias: advancedCompResult.coincidencias,
            total: advancedCompResult.total,
            // Mantener los movimientos originales por ahora
            movimientos: processResult.comparacion?.movimientos || []
          };
          
          // Añadir metadatos adicionales sobre la comparación
          processResult.advancedAnalysis = {
            method: 'adaptive_weighted_alignment',
            similarityScore: advancedCompResult.similitud,
            precision: (advancedCompResult.coincidencias / advancedCompResult.total * 100) || 0
          };
        } catch (advError) {
          console.error('Error en comparación avanzada:', advError);
          // Si falla la comparación avanzada, mantener la comparación original
        }
      }
      
      return processResult;
    } catch (error) {
      console.error(`Error procesando imagen con ${modelConfig.name}:`, error);
      throw error;
    }
  }, [highPrecisionMode]);


  
  // Función para procesar el planograma data que viene del json o de una prueba
  const processExpectedArray = (planogramData) => {
    // Verificar si es un array
    if (!Array.isArray(planogramData)) {
      console.error('El planogramData no es un array válido:', planogramData);
      return [];
    }
    
    // Si el array está vacío, devolver un array vacío
    if (planogramData.length === 0) {
      return [];
    }
    
    // Para comprobar si el array está en el formato esperado (array de arrays de strings)
    const isArrayOfArrays = planogramData.every(item => Array.isArray(item));
    
    // Si no está en el formato correcto, intentar convertirlo
    if (!isArrayOfArrays) {
      console.warn('El planogramData no es un array de arrays, intentando convertir...');
      // Convertir planogramData a un array de arrays si es posible
      try {
        if (typeof planogramData === 'string') {
          // Si es una cadena, intentar parsearlo como JSON
          const parsed = JSON.parse(planogramData);
          if (Array.isArray(parsed) && parsed.every(item => Array.isArray(item))) {
            planogramData = parsed;
          } else {
            throw new Error('El formato JSON no es válido para un planograma');
          }
        } else {
          // Si no es un array de arrays ni una cadena, devolver array vacío
          return [];
        }
      } catch (e) {
        console.error('Error al procesar el planogramData:', e);
        return [];
      }
    }
    
    // Comprobar si el array está invertido (nivel más alto primero)
    // Normalmente queremos que el nivel 0 (el más bajo) esté primero
    const possiblyInverted = planogramData.length > 1 && 
      planogramData[0].length >= planogramData[planogramData.length - 1].length;
    
    let processedArray = [...planogramData];
    
    // Si parece invertido, invertirlo (copiar y voltear el array)
    if (possiblyInverted) {
      processedArray = [...planogramData].reverse();
      console.log('Array del planograma invertido para coincidir con el formato del modelo');
    }
    
    // Filtrar cualquier valor no válido, convertir todo a cadenas
    return processedArray.map(shelf => 
      shelf.map(product => 
        product ? String(product) : 'EMPTY'
      )
    );
  };

  // Process the image and compare with planogram using multiple models
  const handleProcessImage = useCallback(async () => {
    // Validate inputs
    if (!selectedTienda) {
      setError('Por favor seleccione una tienda.');
      return;
    }
    
    if (!selectedPlanograma) {
      setError('Por favor seleccione un planograma.');
      return;
    }
    
    if (!imageFile || !imagePreview) {
      setError('Por favor suba una imagen del planograma.');
      return;
    }

    try {
      setProcessingImage(true);
      setError(null);
      setResult(null);
      
      // Update model configs to reset processing state
      setModelConfigs(prev => prev.map(config => ({
        ...config,
        processing: config.enabled,
        result: null,
        error: null
      })));
      
      // Get planogram data from service with timeout
      const planogramPromise = planogramTaskService.getProductIdsByLevel(selectedTienda, selectedPlanograma);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Tiempo de espera agotado al obtener datos del planograma.')), 20000)
      );
      
      let planogramData;
      try {
        planogramData = await Promise.race([planogramPromise, timeoutPromise]);
        
        if (!planogramData || !Array.isArray(planogramData) || planogramData.length === 0) {
          throw new Error('No se encontraron datos del planograma seleccionado.');
        }
        
        console.log('Planogram data:', planogramData);
        
        // Procesar el planogramData para asegurar que esté en el formato correcto
        planogramData = processExpectedArray(planogramData);
        
        // Fetch product names for all product IDs in the planogram
        await fetchProductNames(planogramData.flat());
        
      } catch (planogramError) {
        throw new Error(`Error al obtener datos del planograma: ${planogramError.message}`);
      }
      
      // Get base64 data from compressed image
      const base64Data = convertDataURLToBase64(imagePreview);
      
      if (!base64Data) {
        throw new Error('Error al procesar la imagen. Formato incorrecto.');
      }

      // Metadata para los resultados
      const metadata = {
        tiendaId: selectedTienda,
        tiendaNombre: tiendas.find(t => t.id === selectedTienda)?.nombre || '',
        planogramaId: selectedPlanograma,
        planogramaNombre: planogramas.find(p => p.id === selectedPlanograma)?.nombre || '',
        timestamp: new Date().toISOString(),
        fileName: imageFile.name,
        highPrecisionEnabled: highPrecisionMode,
        imageResolution: {
          width: imageRef.current?.naturalWidth || 0,
          height: imageRef.current?.naturalHeight || 0
        }
      };
      
      if (useMultipleModels) {
        // Procesamiento con múltiples modelos en paralelo
        const enabledModels = modelConfigs.filter(model => model.enabled);
        
        // Si no hay modelos habilitados, mostrar error
        if (enabledModels.length === 0) {
          throw new Error('No hay modelos habilitados para el procesamiento.');
        }
        
        // Procesar con todos los modelos habilitados en paralelo
        const modelPromises = enabledModels.map(async (modelConfig) => {
          try {
            // Actualizar estado para indicar que este modelo está procesando
            setModelConfigs(prev => prev.map(config => 
              config.id === modelConfig.id 
                ? { ...config, processing: true } 
                : config
            ));
            
            const result = await processSingleModel(base64Data, planogramData, modelConfig);
            
            // Actualizar el resultado de este modelo
            setModelConfigs(prev => prev.map(config => 
              config.id === modelConfig.id 
                ? { 
                    ...config, 
                    processing: false, 
                    result: {
                      ...result,
                      metadata: {
                        ...metadata,
                        modelId: modelConfig.id,
                        modelName: modelConfig.name,
                        modelConfig: {
                          apiKey: modelConfig.apiKey,
                          emptyThresholdMultiplier: modelConfig.emptyThresholdMultiplier,
                          shelfThreshold: modelConfig.shelfThreshold,
                          confidence: modelConfig.confidence
                        }
                      }
                    } 
                  } 
                : config
            ));
            
            return {
              modelId: modelConfig.id,
              result: {
                ...result,
                metadata: {
                  ...metadata,
                  modelId: modelConfig.id,
                  modelName: modelConfig.name
                }
              }
            };
          } catch (error) {
            console.error(`Error en modelo ${modelConfig.name}:`, error);
            // Actualizar error para este modelo
            setModelConfigs(prev => prev.map(config => 
              config.id === modelConfig.id 
                ? { ...config, processing: false, error: error.message || 'Error desconocido' } 
                : config
            ));
            
            // No detenemos el proceso completo, solo marcamos este modelo como fallido
            return {
              modelId: modelConfig.id,
              error: error.message || 'Error desconocido'
            };
          }
        });
        
        // Esperar a que todos los modelos terminen
        const modelResults = await Promise.allSettled(modelPromises);
        
        // Filtrar resultados exitosos
        const successfulResults = modelResults
          .filter(res => res.status === 'fulfilled')
          .map(res => res.value)
          .filter(res => !res.error);
        
        if (successfulResults.length === 0) {
          const errorMessages = modelResults
            .filter(res => res.status === 'fulfilled' && res.value && res.value.error)
            .map(res => `${res.value.modelId}: ${res.value.error}`)
            .join(', ');
          
          throw new Error(`Todos los modelos fallaron en el procesamiento de la imagen. ${errorMessages || ''}`);
        }
        
        // Combinar resultados
        let combinedResult;
        try {
          combinedResult = combineResults(successfulResults.map(res => res.result));
        } catch (combineError) {
          console.error('Error al combinar resultados:', combineError);
          // Si falla la combinación, usar el mejor modelo individual
          combinedResult = successfulResults[0].result;
        }
        
        // Añadir el array esperado al resultado
        combinedResult.expectedArray = planogramData;
        
        // Aplicar visualización avanzada
        if (combinedResult && (combinedResult.predictions || combinedResult.barcodesArray)) {
          try {
            visualizeResults(combinedResult);
          } catch (visError) {
            console.error('Error en visualización:', visError);
            // No mostrar error al usuario por problemas de visualización
          }
        }
        
        setResult(combinedResult);
        
      } else {
        // Procesamiento con un solo modelo (el primero habilitado)
        const activeModel = modelConfigs.find(model => model.enabled);
        
        if (!activeModel) {
          throw new Error('No hay modelos habilitados para el procesamiento.');
        }
        
        const processResult = await processSingleModel(base64Data, planogramData, activeModel);
        
        // Enhance result with additional metadata and add expectedArray
        const enhancedResult = {
          ...processResult,
          expectedArray: planogramData,
          metadata: {
            ...metadata,
            modelId: activeModel.id,
            modelName: activeModel.name
          }
        };
        
        // Aplicar visualización avanzada
        if (processResult && (processResult.predictions || processResult.barcodesArray)) {
          try {
            visualizeResults(enhancedResult);
          } catch (visError) {
            console.error('Error en visualización:', visError);
            // No mostrar error al usuario por problemas de visualización
          }
        }
        
        setResult(enhancedResult);
      }
      
    } catch (error) {
      console.error('Error processing image:', error);
      setError(error.message || 'Error al procesar la imagen. Intente nuevamente.');
    } finally {
      setProcessingImage(false);
      setUploadProgress(0);
    }
  }, [
    selectedTienda, 
    selectedPlanograma, 
    imageFile, 
    imagePreview, 
    tiendas, 
    planogramas, 
    convertDataURLToBase64, 
    modelConfigs, 
    useMultipleModels, 
    processSingleModel, 
    highPrecisionMode, 
    visualizeResults, 
    imageRef
  ]);

  // Render function for displaying discrepancies with memoization
  const renderDiscrepancies = useMemo(() => {
    if (!result || !result.comparacion || !result.comparacion.discrepancias) {
      return null;
    }

    const { discrepancias } = result.comparacion;
    
    if (discrepancias.length === 0) {
      return (
        <div className="success-message">
          <span className="material-icons">check_circle</span>
          <p>¡No se encontraron discrepancias! El planograma está correctamente implementado.</p>
        </div>
      );
    }
    
    // Función para obtener el nombre del producto
    const getProductName = (productCode) => {
      if (productCode === 'EMPTY' || productCode === 'vacío') {
        return 'Vacío';
      }
      return productNames[productCode] || productCode;
    };

    return (
      <div className="discrepancies-section">
        <h3>
          <span className="material-icons">warning</span>
          Discrepancias Encontradas ({discrepancias.length})
        </h3>
        <div className="discrepancies-list">
          {discrepancias.map((disc, index) => (
            <div key={index} className="discrepancy-item">
              <div className="disc-location">
                <span className="disc-label">Estante {disc.fila + 1}, Posición {disc.columna + 1}:</span>
              </div>
              <div className="disc-details">
                <div className="disc-expected">
                  <span className="disc-sublabel">Esperado:</span> 
                  <span className="disc-value">{getProductName(disc.esperado)}</span>
                </div>
                <div className="disc-found">
                  <span className="disc-sublabel">Encontrado:</span> 
                  <span className="disc-value">{getProductName(disc.encontrado)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }, [result, productNames]);

  // Render function for displaying corrective movements with memoization
  const renderMovements = useMemo(() => {
    if (!result || !result.comparacion || !result.comparacion.movimientos) {
      return null;
    }

    const { movimientos } = result.comparacion;
    
    if (movimientos.length === 0) {
      return null;
    }
    
    // Función para obtener el nombre del producto
    const getProductName = (productCode) => {
      if (productCode === 'EMPTY' || productCode === 'vacío') {
        return 'Vacío';
      }
      return productNames[productCode] || productCode;
    };

    // Group movements by type for better organization
    const groupedMovements = {
      mover: movimientos.filter(m => m.tipo === 'mover'),
      añadir: movimientos.filter(m => m.tipo === 'añadir'),
      remover: movimientos.filter(m => m.tipo === 'remover')
    };

    return (
      <div className="movements-section">
        <h3>
          <span className="material-icons">build</span>
          Acciones Correctivas Recomendadas ({movimientos.length})
        </h3>
        
        {Object.entries(groupedMovements).map(([tipo, moves]) => {
          if (moves.length === 0) return null;
          
          let tipoLabel = '';
          let icon = '';
          
          switch(tipo) {
            case 'mover':
              tipoLabel = 'Mover';
              icon = 'swap_horiz';
              break;
            case 'añadir':
              tipoLabel = 'Añadir';
              icon = 'add_circle';
              break;
            case 'remover':
              tipoLabel = 'Remover';
              icon = 'remove_circle';
              break;
            default:
              tipoLabel = tipo;
              icon = 'build';
          }
          
          return (
            <div key={tipo} className="movement-group">
              <h4 className={`movement-group-title movement-${tipo}`}>
                <span className="material-icons">{icon}</span>
                {tipoLabel} ({moves.length})
              </h4>
              <div className="movements-list">
                {moves.map((mov, index) => {
                  let description = '';
                  const productName = getProductName(mov.producto);
                  
                  if (mov.tipo === 'mover') {
                    description = `Mover "${productName}" de Estante ${mov.origen.fila + 1}, Posición ${mov.origen.columna + 1} 
                                  a Estante ${mov.destino.fila + 1}, Posición ${mov.destino.columna + 1}`;
                  } else if (mov.tipo === 'añadir') {
                    description = `Añadir "${productName}" en Estante ${mov.destino.fila + 1}, Posición ${mov.destino.columna + 1}`;
                  } else if (mov.tipo === 'remover') {
                    description = `Remover "${productName}" de Estante ${mov.origen.fila + 1}, Posición ${mov.origen.columna + 1}`;
                  }
                  
                  return (
                    <div key={index} className={`movement-item movement-${mov.tipo}`}>
                      <span className="movement-type">{index + 1}</span>
                      <span className="movement-desc">{description}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [result, productNames]);

  // Render detected shelves with barcodes with memoization
  const renderDetectedBarcodes = useMemo(() => {
    if (!result || !result.barcodesArray || result.barcodesArray.length === 0) {
      return null;
    }
    
    // Create a reversed copy of the array to display estante 1 at the bottom
    const reversedForDisplay = [...result.barcodesArray].reverse();
    
    // Función para obtener el nombre del producto
    const getProductName = (productCode) => {
      if (productCode === 'EMPTY' || productCode === 'vacío') {
        return 'Vacío';
      }
      return productNames[productCode] || productCode;
    };
    
    return (
      <div className="barcodes-section">
        <h3>
          <span className="material-icons">view_module</span>
          Productos Detectados
        </h3>
        <div className="shelves-container">
          {reversedForDisplay.map((shelf, visualIndex) => {
            // Calculate the real shelf index (estante 1 is the last element in the original array)
            const realShelfIndex = result.barcodesArray.length - 1 - visualIndex;
            
            return (
              <div key={visualIndex} className="shelf-row">
                <div className="shelf-label">
                  <span className="shelf-number">Estante {realShelfIndex + 1}</span>
                  <span className="shelf-count">({shelf.length} productos)</span>
                </div>
                <div className="products-container">
                  {shelf.map((barcode, productIndex) => (
                    <div 
                      key={productIndex} 
                      className={`product-item ${barcode === 'EMPTY' ? 'empty-slot' : ''}`}
                      title={barcode === 'EMPTY' ? 'Espacio vacío' : `Producto: ${barcode}`}
                    >
                      <span className="product-position">{productIndex + 1}</span>
                      <span className="product-code">
                        {getProductName(barcode)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [result, productNames]);
  
  // Componente para visualizar la comparación entre arrays
  const renderArrayComparison = useMemo(() => {
    if (!result || !result.barcodesArray || !result.expectedArray) {
      return null;
    }
    
    // Calcular una puntuación de similitud entre los arrays
    const calculateSimilarityScore = () => {
      const detected = result.barcodesArray;
      const expected = result.expectedArray;
      
      // Inicializar contadores
      let totalProducts = 0;
      let matchingProducts = 0;
      
      // Determinar el número máximo de estantes a comparar
      const maxShelves = Math.max(detected.length, expected.length);
      
      // Comparar cada estante
      for (let i = 0; i < maxShelves; i++) {
        const detectedShelf = i < detected.length ? detected[i] : [];
        const expectedShelf = i < expected.length ? expected[i] : [];
        
        // Determinar el número máximo de productos a comparar en este estante
        const maxProducts = Math.max(detectedShelf.length, expectedShelf.length);
        totalProducts += maxProducts;
        
        // Comparar cada producto
        for (let j = 0; j < maxProducts; j++) {
          const detectedProduct = j < detectedShelf.length ? detectedShelf[j] : null;
          const expectedProduct = j < expectedShelf.length ? expectedShelf[j] : null;
          
          // Si ambos son iguales (incluidos los vacíos), contar como coincidencia
          if (detectedProduct === expectedProduct) {
            matchingProducts++;
          } 
          // Si ambos son vacíos pero con diferentes representaciones, también contar como coincidencia
          else if ((detectedProduct === 'EMPTY' && expectedProduct === 'vacío') || 
                  (detectedProduct === 'vacío' && expectedProduct === 'EMPTY')) {
            matchingProducts++;
          }
        }
      }
      
      // Calcular porcentaje de similitud
      return totalProducts > 0 ? (matchingProducts / totalProducts) * 100 : 0;
    };
    
    // Generar recomendaciones basadas en las diferencias entre arrays
    const generateRecommendations = () => {
      const detected = result.barcodesArray;
      const expected = result.expectedArray;
      const recommendations = [];
      
      // Determinar el número máximo de estantes a comparar
      const maxShelves = Math.max(detected.length, expected.length);
      
      // Para cada estante
      for (let i = 0; i < maxShelves; i++) {
        const detectedShelf = i < detected.length ? detected[i] : [];
        const expectedShelf = i < expected.length ? expected[i] : [];
        
        // Si falta un estante completo
        if (detectedShelf.length === 0 && expectedShelf.length > 0) {
          recommendations.push({
            type: 'add_shelf',
            shelfIndex: i,
            description: `Añadir estante ${i + 1} completo con ${expectedShelf.length} productos`
          });
          continue;
        }
        
        // Si hay un estante extra
        if (expectedShelf.length === 0 && detectedShelf.length > 0) {
          recommendations.push({
            type: 'remove_shelf',
            shelfIndex: i,
            description: `Remover estante ${i + 1} completo (no esperado en el planograma)`
          });
          continue;
        }
        
        // Determinar el número máximo de productos a comparar en este estante
        const maxProducts = Math.max(detectedShelf.length, expectedShelf.length);
        
        // Comparar cada producto en el estante
        for (let j = 0; j < maxProducts; j++) {
          const detectedProduct = j < detectedShelf.length ? detectedShelf[j] : null;
          const expectedProduct = j < expectedShelf.length ? expectedShelf[j] : null;
          
          // Obtener los nombres de los productos
          const detectedName = detectedProduct && productNames[detectedProduct] ? 
                              productNames[detectedProduct] : 
                              (detectedProduct === 'EMPTY' || detectedProduct === 'vacío' ? 'Vacío' : detectedProduct);
                              
          const expectedName = expectedProduct && productNames[expectedProduct] ? 
                              productNames[expectedProduct] : 
                              (expectedProduct === 'EMPTY' || expectedProduct === 'vacío' ? 'Vacío' : expectedProduct);
          
          // Si falta un producto
          if (!detectedProduct && expectedProduct && expectedProduct !== 'EMPTY' && expectedProduct !== 'vacío') {
            recommendations.push({
              type: 'add_product',
              shelfIndex: i,
              productIndex: j,
              productCode: expectedProduct,
              productName: expectedName,
              description: `Añadir ${expectedName} en estante ${i + 1}, posición ${j + 1}`
            });
          }
          // Si hay un producto extra
          else if (detectedProduct && (!expectedProduct || expectedProduct === 'EMPTY' || expectedProduct === 'vacío')) {
            recommendations.push({
              type: 'remove_product',
              shelfIndex: i,
              productIndex: j,
              productCode: detectedProduct,
              productName: detectedName,
              description: `Remover ${detectedName} de estante ${i + 1}, posición ${j + 1}`
            });
          }
          // Si los productos no coinciden
          else if (detectedProduct && expectedProduct && 
                  detectedProduct !== expectedProduct && 
                  !(detectedProduct === 'EMPTY' && expectedProduct === 'vacío') && 
                  !(detectedProduct === 'vacío' && expectedProduct === 'EMPTY')) {
            // Buscar si este producto detectado debería estar en otra posición
            let foundInExpected = false;
            
            // Buscar en todos los estantes esperados
            for (let ei = 0; ei < expected.length; ei++) {
              for (let ej = 0; ej < expected[ei].length; ej++) {
                // Si encontramos el producto en otra posición
                if (expected[ei][ej] === detectedProduct) {
                  recommendations.push({
                    type: 'move_product',
                    shelfIndex: i,
                    productIndex: j,
                    targetShelf: ei,
                    targetIndex: ej,
                    productCode: detectedProduct,
                    productName: detectedName,
                    description: `Mover ${detectedName} de estante ${i + 1}, posición ${j + 1} a estante ${ei + 1}, posición ${ej + 1}`
                  });
                  foundInExpected = true;
                  break;
                }
              }
              if (foundInExpected) break;
            }
            
            // Si no encontramos el producto en ninguna parte, reemplazar
            if (!foundInExpected) {
              recommendations.push({
                type: 'replace_product',
                shelfIndex: i,
                productIndex: j,
                currentProduct: detectedProduct,
                currentProductName: detectedName,
                expectedProduct: expectedProduct,
                expectedProductName: expectedName,
                description: `Reemplazar ${detectedName} con ${expectedName} en estante ${i + 1}, posición ${j + 1}`
              });
            }
          }
        }
      }
      
      return recommendations;
    };
    
    const similarityScore = calculateSimilarityScore();
    const recommendations = generateRecommendations();
    
    // Determinar color basado en la puntuación
    const getScoreColor = (score) => {
      if (score >= 90) return '#4CAF50'; // Verde
      if (score >= 75) return '#8BC34A'; // Verde claro
      if (score >= 60) return '#FFC107'; // Amarillo
      if (score >= 40) return '#FF9800'; // Naranja
      return '#F44336'; // Rojo
    };
    
    // Determinar el icono según el tipo de recomendación
    const getRecommendationIcon = (type) => {
      switch (type) {
        case 'add_shelf':
        case 'add_product':
          return 'add_circle';
        case 'remove_shelf':
        case 'remove_product':
          return 'remove_circle';
        case 'move_product':
          return 'swap_horiz';
        case 'replace_product':
          return 'swap_vertical_circle';
        default:
          return 'build';
      }
    };
    
    // Agrupar recomendaciones por tipo
    const groupedRecommendations = {
      añadir: recommendations.filter(r => r.type.startsWith('add_')),
      remover: recommendations.filter(r => r.type.startsWith('remove_')),
      mover: recommendations.filter(r => r.type === 'move_product'),
      reemplazar: recommendations.filter(r => r.type === 'replace_product')
    };
    
    // Función para obtener el nombre del producto a partir del código
    const getProductName = (productCode) => {
      if (productCode === 'EMPTY' || productCode === 'vacío') {
        return 'Vacío';
      }
      return productNames[productCode] || productCode;
    };
    
    return (
      <div className="array-comparison-section">
        <h3>
          <span className="material-icons">compare_arrows</span>
          Comparación de Arrays
        </h3>
        
        <div className="similarity-score-container">
          <div className="score-label">Puntuación de Similitud:</div>
          <div className="score-value" style={{ color: getScoreColor(similarityScore) }}>
            {similarityScore.toFixed(2)}%
          </div>
        </div>
        
        <div className="arrays-comparison-container">
          <div className="array-column">
            <h4>Planograma Esperado</h4>
            <div className="array-visualization">
              {result.expectedArray.map((shelf, shelfIndex) => (
                <div key={`expected-${shelfIndex}`} className="array-shelf">
                  <div className="shelf-header">Estante {shelfIndex + 1}</div>
                  <div className="shelf-products">
                    {shelf.map((product, productIndex) => (
                      <div 
                        key={`expected-${shelfIndex}-${productIndex}`} 
                        className={`array-product ${product === 'EMPTY' || product === 'vacío' ? 'empty-product' : ''}`}
                        title={product}
                      >
                        {getProductName(product)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="array-column">
            <h4>Productos Detectados</h4>
            <div className="array-visualization">
              {result.barcodesArray.map((shelf, shelfIndex) => (
                <div key={`detected-${shelfIndex}`} className="array-shelf">
                  <div className="shelf-header">Estante {shelfIndex + 1}</div>
                  <div className="shelf-products">
                    {shelf.map((product, productIndex) => {
                      // Verificar si este producto coincide con el esperado
                      const expectedShelf = shelfIndex < result.expectedArray.length ? 
                                          result.expectedArray[shelfIndex] : [];
                      const expectedProduct = productIndex < expectedShelf.length ? 
                                            expectedShelf[productIndex] : null;
                      
                      const isMatch = product === expectedProduct || 
                                    (product === 'EMPTY' && expectedProduct === 'vacío') ||
                                    (product === 'vacío' && expectedProduct === 'EMPTY');
                      
                      return (
                        <div 
                          key={`detected-${shelfIndex}-${productIndex}`} 
                          className={`array-product ${product === 'EMPTY' || product === 'vacío' ? 'empty-product' : ''} ${isMatch ? 'match-product' : 'mismatch-product'}`}
                          title={product}
                        >
                          {getProductName(product)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Recomendaciones basadas en las discrepancias encontradas */}
        {recommendations.length > 0 && (
          <div className="array-recommendations">
            <h4>
              <span className="material-icons">engineering</span>
              Acciones Recomendadas ({recommendations.length})
            </h4>
            
            {Object.entries(groupedRecommendations).map(([tipo, recoms]) => {
              if (recoms.length === 0) return null;
              
              let tipoLabel = '';
              let icon = '';
              
              switch(tipo) {
                case 'mover':
                  tipoLabel = 'Mover Productos';
                  icon = 'swap_horiz';
                  break;
                case 'añadir':
                  tipoLabel = 'Añadir Productos';
                  icon = 'add_circle';
                  break;
                case 'remover':
                  tipoLabel = 'Remover Productos';
                  icon = 'remove_circle';
                  break;
                case 'reemplazar':
                  tipoLabel = 'Reemplazar Productos';
                  icon = 'swap_vertical_circle';
                  break;
                default:
                  tipoLabel = tipo;
                  icon = 'build';
              }
              
              return (
                <div key={tipo} className="recommendation-group">
                  <h5 className={`recommendation-group-title recommendation-${tipo}`}>
                    <span className="material-icons">{icon}</span>
                    {tipoLabel} ({recoms.length})
                  </h5>
                  <div className="recommendations-list">
                    {recoms.map((recom, index) => (
                      <div key={index} className={`recommendation-item recommendation-${tipo}`}>
                        <span className="recommendation-icon">
                          <span className="material-icons">{getRecommendationIcon(recom.type)}</span>
                        </span>
                        <span className="recommendation-desc">{recom.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }, [result, productNames]);
  
  // Add a new function to save the analysis to Firestore
  const saveAnalysisToFirestore = async () => {
    if (!result || !canvasRef.current) {
      setError('No hay análisis para guardar.');
      return null;
    }

    try {
      setIsSaving(true);
      setSaveSuccess(false);
      setError(null);

      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Es necesario iniciar sesión para guardar el análisis.');
      }

      // Upload the visualization image to Storage
      const canvas = canvasRef.current;
      const imageDataUrl = canvas.toDataURL('image/png');
      
      // Create a reference with a unique name
      const imageFileName = `planogram_analysis_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.png`;
      const imageRef = ref(storage, `analysis_images/${imageFileName}`);
      
      // Upload the image
      await uploadString(imageRef, imageDataUrl, 'data_url');
      
      // Get the download URL
      const imageUrl = await getDownloadURL(imageRef);
      setSavedImageUrl(imageUrl);
      
      // Firestore-safe converter - handles nested arrays and complex structures
      const makeFirestoreSafe = (data) => {
        // For null/undefined values
        if (data === null || data === undefined) {
          return null;
        }
        
        // For arrays
        if (Array.isArray(data)) {
          // Convert arrays to objects with numeric string keys
          const obj = {};
          data.forEach((item, index) => {
            obj[`item_${index}`] = makeFirestoreSafe(item);
          });
          return obj;
        }
        
        // For objects (not arrays, not null)
        if (typeof data === 'object') {
          const safeObj = {};
          for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
              safeObj[key] = makeFirestoreSafe(data[key]);
            }
          }
          return safeObj;
        }
        
        // For primitives (string, number, boolean)
        return data;
      };
      
      // Calculate the exact similarity percentage with full precision
      // Prioritize the most accurate measure in this order: advancedAnalysis, comparacion.similitud, calculated from matches
      const getSimilarityPercentage = () => {
        // First try advanced analysis which has the most accurate algorithm
        if (result.advancedAnalysis && typeof result.advancedAnalysis.similarityScore === 'number') {
          return Number(result.advancedAnalysis.similarityScore);
        }
        
        // Next try similarity from comparacion
        if (result.comparacion && typeof result.comparacion.similitud === 'number') {
          return Number(result.comparacion.similitud);
        }
        
        // If no existing calculation, derive from coincidencias/total
        if (result.comparacion && typeof result.comparacion.coincidencias === 'number' && 
            typeof result.comparacion.total === 'number' && result.comparacion.total > 0) {
          return (result.comparacion.coincidencias / result.comparacion.total) * 100;
        }
        
        // Last resort - count products explicitly
        const expectedTotal = result.expectedArray ? result.expectedArray.flat().filter(p => p !== 'EMPTY' && p !== 'vacío').length : 0;
        if (expectedTotal > 0) {
          const discrepanciesCount = result.comparacion?.discrepancias?.length || 0;
          return Math.max(0, Math.min(100, ((expectedTotal - discrepanciesCount) / expectedTotal) * 100));
        }
        
        return 0; // Default if no valid calculation is possible
      };
      
      // Calculate statistics with precision
      const exactSimilarityPercentage = getSimilarityPercentage();
      
      // Safe basic stats (no nested arrays)
      const estadisticas = {
        totalEstantes: result.barcodesArray?.length || 0,
        totalProductos: result.barcodesArray ? result.barcodesArray.flat().filter(p => p !== 'EMPTY').length : 0,
        espaciosVacios: result.barcodesArray ? result.barcodesArray.flat().filter(p => p === 'EMPTY').length : 0,
        discrepancias: result.comparacion?.discrepancias?.length || 0,
        similitud: exactSimilarityPercentage,
        // Add additional precision fields
        similitudExacta: exactSimilarityPercentage,
        similitudFormatted: exactSimilarityPercentage.toFixed(2) + '%',
        precision: result.advancedAnalysis?.precision || 0,
      };
      
      console.log('Guardando análisis con similitud exacta de:', exactSimilarityPercentage);
      
      // Convert model info to a safe format
      let modelosUtilizados = {};
      if (result.metadata?.combinacion && result.metadata.estadisticas?.modelosInfo) {
        result.metadata.estadisticas.modelosInfo.forEach((model, index) => {
          modelosUtilizados[`modelo_${index}`] = model.modelName || `Modelo ${index + 1}`;
        });
      } else {
        modelosUtilizados = { "modelo_0": result.metadata?.modelName || 'Modelo estándar' };
      }
      
      // Generate unique identifier for user identification without leaking info
      const userIdentifier = currentUser.uid + '_' + Date.now();
      
      // Simplify the complete data structure to avoid nested arrays
      const simplifiedData = {
        // Essential data (safe)
        tiendaId: selectedTienda,
        tiendaNombre: tiendas.find(t => t.id === selectedTienda)?.nombre || '',
        planogramaId: selectedPlanograma,
        planogramaNombre: planogramas.find(p => p.id === selectedPlanograma)?.nombre || '',
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email || 'Usuario',
        userIdentifier: userIdentifier,
        createdAt: serverTimestamp(),
        imageUrl: imageUrl,
        fechaAnalisis: new Date().toISOString(),
        
        // Statistics summary with precise similarity value
        ...estadisticas,
        modelosUtilizados,
        
        // Additional data for search/filter capabilities
        seccion: result.metadata?.seccion || '',
        configuracion: {
          highPrecisionMode: highPrecisionMode,
          useMultipleModels: useMultipleModels,
          modelCount: useMultipleModels ? modelConfigs.filter(m => m.enabled).length : 1
        },
        
        // Process complex properties individually to ensure Firestore compatibility
        discrepanciasCount: result.comparacion?.discrepancias?.length || 0,
        discrepancias: makeFirestoreSafe(result.comparacion?.discrepancias || []),
        barcodesArray: makeFirestoreSafe(result.barcodesArray || []),
        expectedArray: makeFirestoreSafe(result.expectedArray || []),
      };
      
      // Save to Firestore
      const docRef = await addDoc(collection(db, "analysis"), simplifiedData);
      
      console.log('Análisis guardado con ID:', docRef.id);
      setSavedAnalysisId(docRef.id);
      setSaveSuccess(true);
      
      return docRef.id;
    } catch (error) {
      console.error('Error al guardar el análisis:', error);
      setError(`Error al guardar el análisis: ${error.message}`);
      return null;
    } finally {
      setIsSaving(false);
    }
  };
  
  // Add this after the results-actions div in the results container
  // Add this after your renderArrayComparison code, inside the return statement
  const renderSaveSection = useMemo(() => {
    return (
      <div className="save-analysis-section">
        <h3>
          <span className="material-icons">save</span>
          Guardar Análisis
        </h3>
        
        <div className="save-description">
          <p>Guarde este análisis en la base de datos para futuras consultas o para compartir con su equipo.</p>
        </div>
        
        <button 
          className={`save-button ${isSaving ? 'saving' : ''} ${saveSuccess ? 'success' : ''}`}
          onClick={saveAnalysisToFirestore}
          disabled={isSaving || !result || saveSuccess}
        >
          {isSaving ? (
            <>
              <span className="spinner"></span>
              Guardando...
            </>
          ) : saveSuccess ? (
            <>
              <span className="material-icons">check_circle</span>
              Guardado Exitosamente
            </>
          ) : (
            <>
              <span className="material-icons">save</span>
              Guardar Análisis
            </>
          )}
        </button>
        
        {saveSuccess && savedAnalysisId && (
          <div className="save-success-info">
            <p>ID de análisis: <strong>{savedAnalysisId}</strong></p>
            <p>Puede acceder a este análisis desde el panel de estadísticas.</p>
            
            {savedImageUrl && (
              <div className="saved-image-preview">
                <p>Imagen guardada:</p>
                <img src={savedImageUrl} alt="Vista previa análisis guardado" className="saved-image-thumbnail" />
              </div>
            )}
          </div>
        )}
        
        {error && error.includes('guardar el análisis') && (
          <div className="save-error">
            <span className="material-icons">error</span>
            <p>{error}</p>
          </div>
        )}
      </div>
    );
  }, [isSaving, saveSuccess, savedAnalysisId, savedImageUrl, result, error]);
  
  // Determinar el tipo de producto basado en sus proporciones y características visuales
  const determineProductType = (prediction, productCode) => {
    // Obtener dimensiones y relación de aspecto
    const width = prediction.x2 - prediction.x1;
    const height = prediction.y2 - prediction.y1;
    const aspectRatio = height / width;
    
    // Clasificar producto según su código si está disponible
    if (productCode) {
      // Patrones comunes en códigos de productos
      if (/agua|bonafont|ciel|bebida|refres|coca/i.test(productCode)) {
        return aspectRatio > 2 ? 'bottle' : 'can';
      }
      if (/leche|polvo|formula|nan/i.test(productCode)) {
        return 'can';
      }
      if (/pañal|huggies|pampers|kleenex|papel/i.test(productCode)) {
        return 'box';
      }
      if (/galleta|chocolate|snack/i.test(productCode)) {
        return 'packet';
      }
    }
    
    // Si no hay código o no se pudo clasificar, usar la relación de aspecto
    if (aspectRatio > 2.5) return 'bottle';     // Muy alto y delgado (botellas)
    if (aspectRatio > 1.7) return 'box';        // Alto (cajas)
    if (aspectRatio < 0.7) return 'flat';       // Ancho y bajo
    if (aspectRatio < 1.1) return 'can';        // Casi cuadrado (latas)
    
    // Si no se puede determinar con certeza
    return 'default';
  };
  
  return (
    <div className="ocr-container">
      <h2>Detección OCR de Planogramas</h2>
      
      <div className="form-section">
        <div className="form-group">
          <label htmlFor="tiendaSelect">Seleccionar Tienda:</label>
          <div className="select-wrapper">
            {loadingTiendas && <div className="mini-loader"></div>}
            <select 
              id="tiendaSelect" 
              value={selectedTienda} 
              onChange={handleTiendaChange}
              disabled={loadingTiendas}
            >
              <option value="">Seleccionar una tienda</option>
              {tiendas.map(tienda => (
                <option key={tienda.id} value={tienda.id}>
                  {tienda.nombre || `Tienda ${tienda.id}`}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="planogramaSelect">Seleccionar Planograma:</label>
          <div className="select-wrapper">
            {loadingPlanogramas && <div className="mini-loader"></div>}
            <select 
              id="planogramaSelect" 
              value={selectedPlanograma} 
              onChange={handlePlanogramaChange}
              disabled={!selectedTienda || loadingPlanogramas}
            >
              <option value="">Seleccionar un planograma</option>
              {planogramas.map(planograma => (
                <option key={planograma.id} value={planograma.id}>
                  {planograma.nombre || `Planograma ${planograma.id}`}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="modelConfig">Configuración de Modelos:</label>
          <div className="model-toggle">
            <div className="toggle-label">Usar múltiples modelos:</div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={useMultipleModels} 
                onChange={() => setUseMultipleModels(!useMultipleModels)}
              />
              <span className="slider round"></span>
            </label>
          </div>
          
          <div className="model-toggle">
            <div className="toggle-label">Modo alta precisión:</div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={highPrecisionMode} 
                onChange={() => {
                  setHighPrecisionMode(!highPrecisionMode);
                  // Actualizar el modelo 3 basado en este estado
                  setModelConfigs(prev => prev.map(model =>
                    model.id === 'model3' ? {...model, enabled: !highPrecisionMode} : model
                  ));
                }}
              />
              <span className="slider round"></span>
            </label>
          </div>
        </div>
      </div>
      
      {/* Controles de visualización */}
      <div className="visualization-controls">
        <h3>
          <span className="material-icons">visibility</span>
          Opciones de Visualización
        </h3>
        
        <div className="control-options">
          <div className="control-group">
            <label>Modo de visualización:</label>
            <div className="control-buttons">
              <button 
                className={visualMode === 'normal' ? 'active' : ''} 
                onClick={() => setVisualMode('normal')}
              >
                Normal
              </button>
              <button 
                className={visualMode === 'bounding-boxes' ? 'active' : ''}
                onClick={() => setVisualMode('bounding-boxes')}
              >
                Bounding Boxes
              </button>
              <button 
                className={visualMode === 'heatmap' ? 'active' : ''}
                onClick={() => setVisualMode('heatmap')}
              >
                Mapa de Calor
              </button>
            </div>
          </div>
          
          <div className="control-group check-options">
            <div className="check-option">
              <input 
                type="checkbox" 
                id="showBoxes"
                checked={showDetectionBoxes} 
                onChange={() => setShowDetectionBoxes(!showDetectionBoxes)}
              />
              <label htmlFor="showBoxes">Mostrar cajas de detección</label>
            </div>
            <div className="check-option">
              <input 
                type="checkbox" 
                id="showLabels"
                checked={showLabels} 
                onChange={() => setShowLabels(!showLabels)}
              />
              <label htmlFor="showLabels">Mostrar etiquetas</label>
            </div>
            <div className="check-option">
              <input 
                type="checkbox" 
                id="colorByDiscrepancy"
                checked={colorByDiscrepancy} 
                onChange={() => setColorByDiscrepancy(!colorByDiscrepancy)}
              />
              <label htmlFor="colorByDiscrepancy">Colorear por discrepancias</label>
            </div>
          </div>
        </div>
      </div>
      
      {/* Sección de configuración avanzada de modelos */}
      <div className="models-section">
        <div className="section-header">
          <h3>
            <span className="material-icons">tune</span>
            Configuración de Modelos
            <button 
              className="collapse-button"
              onClick={() => document.querySelector('.models-config').classList.toggle('collapsed')}
            >
              <span className="material-icons">expand_more</span>
            </button>
          </h3>
        </div>
        
        <div className="models-config collapsed">
          {modelConfigs.map((model, index) => (
            <div key={model.id} className="model-config-card">
              <div className="model-header">
                <div className="model-title">
                  <label className="switch small">
                    <input 
                      type="checkbox" 
                      checked={model.enabled} 
                      onChange={() => {
                        const updatedConfigs = [...modelConfigs];
                        updatedConfigs[index].enabled = !model.enabled;
                        setModelConfigs(updatedConfigs);
                      }}
                    />
                    <span className="slider round"></span>
                  </label>
                  <h4>{model.name}</h4>
                </div>
                {model.processing && <div className="mini-loader"></div>}
                {model.error && (
                  <div className="model-error">
                    <span className="material-icons">error</span>
                    <span className="error-text">{model.error}</span>
                  </div>
                )}
              </div>
              
              <div className="model-params">
                <div className="param-group">
                  <label htmlFor={`apiKey-${model.id}`}>API Key:</label>
                  <input
                    id={`apiKey-${model.id}`}
                    type="text"
                    value={model.apiKey}
                    onChange={(e) => {
                      const updatedConfigs = [...modelConfigs];
                      updatedConfigs[index].apiKey = e.target.value;
                      setModelConfigs(updatedConfigs);
                    }}
                    placeholder="API Key Roboflow"
                  />
                </div>
                
                <div className="param-group">
                  <label htmlFor={`emptyThreshold-${model.id}`}>Umbral de Espacios Vacíos:</label>
                  <input
                    id={`emptyThreshold-${model.id}`}
                    type="number"
                    min="1.0"
                    max="3.0"
                    step="0.1"
                    value={model.emptyThresholdMultiplier}
                    onChange={(e) => {
                      const updatedConfigs = [...modelConfigs];
                      updatedConfigs[index].emptyThresholdMultiplier = parseFloat(e.target.value);
                      setModelConfigs(updatedConfigs);
                    }}
                  />
                </div>
                
                <div className="param-group">
                  <label htmlFor={`shelfThreshold-${model.id}`}>Umbral de Estantes:</label>
                  <input
                    id={`shelfThreshold-${model.id}`}
                    type="number"
                    min="50000"
                    max="150000"
                    step="10000"
                    value={model.shelfThreshold}
                    onChange={(e) => {
                      const updatedConfigs = [...modelConfigs];
                      updatedConfigs[index].shelfThreshold = parseInt(e.target.value);
                      setModelConfigs(updatedConfigs);
                    }}
                  />
                </div>
                
                <div className="param-group">
                  <label htmlFor={`confidence-${model.id}`}>Umbral de Confianza:</label>
                  <input
                    id={`confidence-${model.id}`}
                    type="number"
                    min="0.1"
                    max="0.9"
                    step="0.05"
                    value={model.confidence}
                    onChange={(e) => {
                      const updatedConfigs = [...modelConfigs];
                      updatedConfigs[index].confidence = parseFloat(e.target.value);
                      setModelConfigs(updatedConfigs);
                    }}
                  />
                </div>
              </div>
              
              {model.result && (
                <div className="model-result-summary">
                  <div className="result-item">
                    <span className="result-label">Discrepancias:</span>
                    <span className="result-value">{model.result.comparacion?.discrepancias?.length || 0}</span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">Estantes Detectados:</span>
                    <span className="result-value">{model.result.barcodesArray?.length || 0}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <div className="upload-section">
        <h3>Sube una imagen del planograma real</h3>
        <FileUpload 
          onFileChange={handleFileChange} 
          previewUrl={imagePreview}
          className="planogram-upload"
        />
        
        <button 
          className="process-button" 
          onClick={handleProcessImage}
          disabled={!selectedTienda || !selectedPlanograma || !imageFile || processingImage}
        >
          {processingImage ? (
            <>
              <span className="spinner"></span>
              {uploadProgress > 0 && uploadProgress < 100 
                ? `Subiendo... ${uploadProgress}%` 
                : 'Procesando...'}
            </>
          ) : (
            <>
              <span className="material-icons">analytics</span>
              {useMultipleModels ? 'Procesar con Múltiples Modelos' : 'Procesar Imagen'}
            </>
          )}
        </button>
      </div>
      
      {error && (
        <div className="error-message">
          <span className="material-icons">error</span>
          <p>{error}</p>
        </div>
      )}
      
      {/* Visualización avanzada */}
      <div className="visualization-container">
        {/* Canvas para visualización */}
        <div className="canvas-container">
          <img ref={imageRef} className="hidden-image" alt="" />
          <canvas ref={canvasRef} className="visualization-canvas"></canvas>
        </div>
      </div>
      
      {result && (
        <div className="results-container">
          <div className="results-header">
            <h2>Resultados del Análisis</h2>
            <div className="result-metadata">
              <div className="metadata-item">
                <span className="metadata-label">Tienda:</span>
                <span className="metadata-value">{result.metadata?.tiendaNombre || 'N/A'}</span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">Planograma:</span>
                <span className="metadata-value">{result.metadata?.planogramaNombre || 'N/A'}</span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">Fecha:</span>
                <span className="metadata-value">
                  {result.metadata?.timestamp 
                    ? new Date(result.metadata.timestamp).toLocaleString() 
                    : new Date().toLocaleString()}
                </span>
              </div>
              
              {result.metadata?.combinacion && (
                <div className="metadata-item combinacion">
                  <span className="metadata-label">Análisis:</span>
                  <span className="metadata-value">Múltiples modelos combinados</span>
                </div>
              )}
              
              {result.advancedAnalysis && (
                <div className="metadata-item advanced">
                  <span className="metadata-label">Precisión:</span>
                  <span className="metadata-value">
                    {result.advancedAnalysis.precision.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* Información de modelos múltiples */}
          {result.metadata?.combinacion && (
            <div className="models-comparison">
              <h3>
                <span className="material-icons">compare</span>
                Comparación de Modelos
              </h3>
              
              <div className="models-stats">
                {result.metadata.estadisticas.modelosInfo.map((modelInfo, index) => (
                  <div 
                    key={modelInfo.modelId} 
                    className={`model-stat-card ${
                      result.metadata.estadisticas.mejorModelo.metadata.modelId === modelInfo.modelId 
                        ? 'best-model' 
                        : ''
                    }`}
                  >
                    <div className="model-stat-header">
                      <h4>{modelInfo.modelName}</h4>
                      {result.metadata.estadisticas.mejorModelo.metadata.modelId === modelInfo.modelId && (
                        <div className="best-model-badge">
                          <span className="material-icons">star</span>
                          Mejor Modelo
                        </div>
                      )}
                    </div>
                    
                    <div className="model-stat-value">
                      <span className="stat-number">{modelInfo.discrepancias}</span>
                      <span className="stat-label">discrepancias</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Summary section */}
          {result.comparacion && (
            <div className="analysis-summary">
              <div className={`summary-item ${result.comparacion.discrepancias.length > 0 ? 'warning' : 'success'}`}>
                <span className="material-icons">
                  {result.comparacion.discrepancias.length > 0 ? 'warning' : 'check_circle'}
                </span>
                <div className="summary-content">
                  <span className="summary-label">Discrepancias:</span>
                  <span className="summary-value">{result.comparacion.discrepancias.length}</span>
                </div>
              </div>
              
              <div className="summary-item info">
                <span className="material-icons">view_module</span>
                <div className="summary-content">
                  <span className="summary-label">Estantes:</span>
                  <span className="summary-value">{result.barcodesArray ? result.barcodesArray.length : 0}</span>
                </div>
              </div>
              
              <div className="summary-item info">
                <span className="material-icons">inventory</span>
                <div className="summary-content">
                  <span className="summary-label">Productos:</span>
                  <span className="summary-value">
                    {result.barcodesArray ? result.barcodesArray.flat().filter(p => p !== 'EMPTY').length : 0}
                  </span>
                </div>
              </div>
              
              <div className="summary-item info">
                <span className="material-icons">space_dashboard</span>
                <div className="summary-content">
                  <span className="summary-label">Espacios vacíos:</span>
                  <span className="summary-value">
                    {result.barcodesArray ? result.barcodesArray.flat().filter(p => p === 'EMPTY').length : 0}
                  </span>
                </div>
              </div>
              
              {result.advancedAnalysis && (
                <div className="summary-item advanced">
                  <span className="material-icons">model_training</span>
                  <div className="summary-content">
                    <span className="summary-label">Similitud:</span>
                    <span className="summary-value">{result.advancedAnalysis.similarityScore.toFixed(2)}%</span>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Módulos de resultados - Orden: Mapa de calor (visualización), productos detectados, comparación de arrays y acciones recomendadas */}
          
          {/* La visualización avanzada (mapa de calor) ya está presente en el div "visualization-container" */}
          
          {/* Productos detectados */}
          {renderDetectedBarcodes}
          
          {/* Comparación de arrays y recomendaciones */}
          {renderArrayComparison}
          
          {/* Discrepancias detectadas */}
          {renderDiscrepancies}
          
          {/* Movimientos recomendados por el algoritmo original */}
          {renderMovements}
          
          {/* Add a download/export button if needed */}
          {result && (
            <div className="results-actions">
              <button 
                className="export-button"
                onClick={() => {
                  // Create a Blob with the JSON result
                  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
                  // Create a URL for the Blob
                  const url = URL.createObjectURL(blob);
                  // Create a temporary anchor element
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `analisis_planograma_${new Date().toISOString().replace(/:/g, '-')}.json`;
                  // Trigger a click on the anchor
                  document.body.appendChild(a);
                  a.click();
                  // Clean up
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
              >
                <span className="material-icons">download</span>
                Exportar Resultados
              </button>
              
              <button 
                className="export-button"
                onClick={() => {
                  // Capturar canvas como imagen
                  if (canvasRef.current) {
                    const url = canvasRef.current.toDataURL('image/png');
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `visualizacion_planograma_${new Date().toISOString().replace(/:/g, '-')}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }
                }}
              >
                <span className="material-icons">image</span>
                Exportar Imagen
              </button>
            </div>
          )}
          
          {/* Add the save section before the closing div */}
          {renderSaveSection}
        </div>
      )}
    </div>
  );
};

export default OCR; 