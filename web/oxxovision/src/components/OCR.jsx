import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { processImageAndCompare } from '../messi';
import planogramTaskService from '../services/PlanogramTaskService';
import { 
  obtenerTiendas,
  obtenerPlanogramas,
  obtenerProducto,
  storage
} from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
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
    
    // Crear mapa de discrepancias para colorear
    const discrepancyMap = new Map();
    discrepancias.forEach(disc => {
      const key = `${disc.fila}-${disc.columna}`;
      discrepancyMap.set(key, disc);
    });
    
    // Dibujar bounding boxes si están disponibles y habilitados
    if (showDetectionBoxes && predictions && predictions.length > 0) {
      // Dibujar cada predicción
      predictions.forEach(pred => {
        const { x1, y1, x2, y2, class: className, confidence } = pred;
        
        // Determinar color basado en confianza o discrepancia
        let boxColor;
        if (colorByDiscrepancy) {
          // Buscar si el producto está en discrepancias
          const isDiscrepancy = discrepancias.some(d => 
            d.encontrado === className || d.esperado === className
          );
          boxColor = isDiscrepancy ? 'rgba(255, 0, 0, 0.7)' : 'rgba(0, 255, 0, 0.7)';
        } else {
          // Color basado en confianza
          const alpha = 0.7;
          if (confidence > 0.7) {
            boxColor = `rgba(0, 255, 0, ${alpha})`;  // Verde para alta confianza
          } else if (confidence > 0.5) {
            boxColor = `rgba(255, 255, 0, ${alpha})`;  // Amarillo para confianza media
          } else {
            boxColor = `rgba(255, 165, 0, ${alpha})`;  // Naranja para baja confianza
          }
        }
        
        // Dibujar rectángulo
        ctx.strokeStyle = boxColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        
        // Dibujar fondo para etiqueta
        if (showLabels) {
          ctx.fillStyle = boxColor;
          ctx.fillRect(x1, y1 - 20, 120, 20);
          
          // Dibujar texto
          ctx.fillStyle = 'white';
          ctx.font = '12px Arial';
          ctx.fillText(`${className} (${Math.round(confidence * 100)}%)`, x1 + 5, y1 - 5);
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
        
        // Calcular ancho de cada producto
        const productWidth = canvas.width / shelf.length;
        
        // Redimensionar para mejor precisión por producto
        // Para ajustar el tamaño y dar una mejor representación visual de los productos
        const productPadding = Math.max(2, Math.floor(productWidth * 0.05)); // 5% de padding
        const productHeight = Math.max(shelfHeight * 0.85, 10); // 85% de altura, mínimo 10px
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
            // Calcular el rango horizontal para este producto
            const prodLeft = productIndex * productWidth;
            const prodRight = (productIndex + 1) * productWidth;
            // Verificar si el centro de la predicción está dentro del rango
            return predCenter >= prodLeft && predCenter < prodRight;
          });
          
          // Si hay predicciones para este producto, ajustar dimensiones
          let x = productIndex * productWidth + productPadding;
          let y = visualIndex * shelfHeight + productTopPadding;
          let adjustedWidth = productWidth - (productPadding * 2);
          let adjustedHeight = productHeight;
          
          if (productPredictions.length > 0) {
            // Usar dimensiones más precisas si hay predicciones disponibles
            // Calcular promedio de todas las predicciones que caen en esta posición
            const avgX1 = productPredictions.reduce((sum, p) => sum + p.x1, 0) / productPredictions.length;
            const avgY1 = productPredictions.reduce((sum, p) => sum + p.y1, 0) / productPredictions.length;
            const avgX2 = productPredictions.reduce((sum, p) => sum + p.x2, 0) / productPredictions.length;
            const avgY2 = productPredictions.reduce((sum, p) => sum + p.y2, 0) / productPredictions.length;
            
            // Restringir a los límites del producto en el estante
            const prodLeft = productIndex * productWidth;
            const prodRight = (productIndex + 1) * productWidth;
            const shelfTop = visualIndex * shelfHeight;
            const shelfBottom = (visualIndex + 1) * shelfHeight;
            
            // Aplicar límites y ajustar tamaños
            x = Math.max(prodLeft + productPadding, avgX1);
            y = Math.max(shelfTop + productPadding, avgY1);
            const x2 = Math.min(prodRight - productPadding, avgX2);
            const y2 = Math.min(shelfBottom - productPadding, avgY2);
            
            adjustedWidth = Math.max(10, x2 - x); // Mínimo 10px de ancho
            adjustedHeight = Math.max(10, y2 - y); // Mínimo 10px de alto
          }
          
          // Color basado en tipo de discrepancia
          let overlayColor;
          if (hasDiscrepancy) {
            const disc = discrepancyMap.get(key);
            if (disc.encontrado === 'vacío') {
              overlayColor = 'rgba(255, 0, 0, 0.3)'; // Rojo - Falta producto
            } else if (disc.esperado === 'vacío') {
              overlayColor = 'rgba(255, 165, 0, 0.3)'; // Naranja - Producto no esperado
            } else {
              overlayColor = 'rgba(255, 255, 0, 0.3)'; // Amarillo - Producto incorrecto
            }
          } else {
            // Colorear mejor productos correctos
            overlayColor = barcode === 'EMPTY' ? 
              'rgba(200, 200, 200, 0.2)' : // Gris claro para vacíos
              'rgba(0, 255, 0, 0.1)';      // Verde para productos correctos
          }
          
          // Dibujar overlay con bordes más claros y redondeados
          ctx.fillStyle = overlayColor;
          ctx.beginPath();
          const cornerRadius = 4;
          ctx.roundRect(x, y, adjustedWidth, adjustedHeight, cornerRadius);
          ctx.fill();
          
          // Dibujar borde
          ctx.strokeStyle = hasDiscrepancy ? 
            'rgba(255, 0, 0, 0.6)' : 
            (barcode === 'EMPTY' ? 'rgba(150, 150, 150, 0.4)' : 'rgba(0, 200, 0, 0.4)');
          ctx.lineWidth = hasDiscrepancy ? 2 : 1;
          ctx.stroke();
          
          // Mostrar etiqueta
          if (showLabels) {
            // Fondo de etiqueta
            const labelPadding = 5;
            const labelX = x + labelPadding;
            const labelY = y + labelPadding;
            const labelWidth = Math.min(adjustedWidth - (labelPadding * 2), 120);
            const labelHeight = barcode === 'EMPTY' ? 25 : 40;
            
            // Solo mostrar etiqueta si hay suficiente espacio
            if (labelWidth > 30 && adjustedHeight > 30) {
              ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
              ctx.beginPath();
              ctx.roundRect(labelX, labelY, labelWidth, labelHeight, 3);
              ctx.fill();
              
              // Texto
              ctx.fillStyle = 'white';
              ctx.font = '12px Arial';
              
              if (hasDiscrepancy) {
                const disc = discrepancyMap.get(key);
                
                if (labelWidth > 100) {
                  // Si hay espacio suficiente, mostrar ambos valores
                  ctx.fillText(`Esp: ${disc.esperado.substring(0, 10)}`, labelX + 5, labelY + 18);
                  ctx.fillText(`Enc: ${disc.encontrado.substring(0, 10)}`, labelX + 5, labelY + 38);
                } else {
                  // Espacio limitado, mostrar solo uno
                  ctx.fillText(disc.encontrado === 'vacío' ? '❌ Falta' : '⚠️ Incorrecto', labelX + 5, labelY + 18);
                }
              } else if (barcode === 'EMPTY') {
                ctx.fillText('Vacío', labelX + 5, labelY + 18);
              } else {
                // Truncar barcode si es muy largo
                const displayText = barcode.length > 10 ? barcode.substring(0, 10) + '...' : barcode;
                ctx.fillText(displayText, labelX + 5, labelY + 18);
              }
            } else if (labelWidth > 20) {
              // Para etiquetas muy pequeñas, mostrar solo un indicador
              const miniLabelX = x + adjustedWidth/2 - 10;
              const miniLabelY = y + adjustedHeight/2 - 10;
              
              ctx.fillStyle = hasDiscrepancy ? 'rgba(255, 0, 0, 0.7)' : 
                             (barcode === 'EMPTY' ? 'rgba(150, 150, 150, 0.7)' : 'rgba(0, 150, 0, 0.7)');
              ctx.beginPath();
              ctx.arc(miniLabelX + 10, miniLabelY + 10, 10, 0, Math.PI * 2);
              ctx.fill();
              
              ctx.fillStyle = 'white';
              ctx.font = '12px Arial';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              
              if (hasDiscrepancy) {
                ctx.fillText('!', miniLabelX + 10, miniLabelY + 10);
              } else if (barcode === 'EMPTY') {
                ctx.fillText('V', miniLabelX + 10, miniLabelY + 10);
              } else {
                ctx.fillText('✓', miniLabelX + 10, miniLabelY + 10);
              }
              
              // Restablecer alineación de texto
              ctx.textAlign = 'start';
              ctx.textBaseline = 'alphabetic';
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
        confidence: modelConfig.confidence || 0.35 // Umbral de confianza
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
        </div>
      )}
    </div>
  );
};

export default OCR; 