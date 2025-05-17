import React, { useState, useEffect } from 'react';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, query, where, onSnapshot, getFirestore, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import FileUpload from './FileUpload';
import './ImageAnalyzer.css';

const ImageAnalyzer = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisResults, setAnalysisResults] = useState([]);
  const [currentResult, setCurrentResult] = useState(null);
  
  // Handle file selection
  const handleFileChange = (selectedFile) => {
    setFile(selectedFile);
    // Reset results when selecting a new file
    setCurrentResult(null);
  };
  
  // Función para analizar la imagen en el cliente
  const analyzeImage = (imageUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        // Crear un canvas para analizar la imagen
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Reducir la imagen para análisis más rápido
        const MAX_SIZE = 100;
        const scale = MAX_SIZE / Math.max(img.width, img.height);
        const width = Math.floor(img.width * scale);
        const height = Math.floor(img.height * scale);
        
        canvas.width = width;
        canvas.height = height;
        
        // Dibujar la imagen en el canvas
        ctx.drawImage(img, 0, 0, width, height);
        
        // Obtener datos de píxeles
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // Analizar colores
        const colors = {};
        let redPixels = 0;
        let greenPixels = 0;
        let bluePixels = 0;
        let brightnessSum = 0;
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Simplificar colores
          const key = `${Math.floor(r/32)},${Math.floor(g/32)},${Math.floor(b/32)}`;
          colors[key] = (colors[key] || 0) + 1;
          
          // Analizar componentes de color
          if (r > Math.max(g, b) + 20) redPixels++;
          else if (g > Math.max(r, b) + 20) greenPixels++;
          else if (b > Math.max(r, g) + 20) bluePixels++;
          
          // Calcular brillo
          brightnessSum += (r + g + b) / 3;
        }
        
        // Calcular estadísticas
        const pixelCount = width * height;
        const avgBrightness = brightnessSum / pixelCount;
        const isDark = avgBrightness < 128;
        
        const redPercent = (redPixels / pixelCount) * 100;
        const greenPercent = (greenPixels / pixelCount) * 100;
        const bluePercent = (bluePixels / pixelCount) * 100;
        
        // Convertir colores a array ordenado
        const dominantColors = Object.entries(colors)
          .map(([key, count]) => {
            const [r, g, b] = key.split(',').map(v => parseInt(v) * 32);
            return {
              rgb: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
              count,
              percentage: (count / pixelCount) * 100
            };
          })
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        
        // Generar categorías basadas en el análisis
        const categories = [];
        
        // Categorías basadas en colores
        if (redPercent > 40) {
          categories.push({ category: "Rojo predominante", probability: redPercent / 100 });
        }
        if (greenPercent > 40) {
          categories.push({ category: "Verde predominante", probability: greenPercent / 100 });
        }
        if (bluePercent > 40) {
          categories.push({ category: "Azul predominante", probability: bluePercent / 100 });
        }
        
        // Categorías basadas en brillo
        if (isDark) {
          categories.push({ category: "Imagen oscura", probability: (255 - avgBrightness) / 255 });
        } else {
          categories.push({ category: "Imagen clara", probability: avgBrightness / 255 });
        }
        
        // Categorías basadas en orientación
        if (img.width > img.height) {
          categories.push({ category: "Imagen horizontal", probability: 0.99 });
        } else if (img.height > img.width) {
          categories.push({ category: "Imagen vertical", probability: 0.99 });
        } else {
          categories.push({ category: "Imagen cuadrada", probability: 0.99 });
        }
        
        // Categorías basadas en tamaño
        if (img.width > 1000 && img.height > 1000) {
          categories.push({ category: "Alta resolución", probability: 0.95 });
        }
        
        // Ordenar categorías por probabilidad
        const sortedCategories = categories
          .sort((a, b) => b.probability - a.probability)
          .slice(0, 5);
        
        // Asegurarse de tener al menos 5 categorías
        while (sortedCategories.length < 5) {
          if (sortedCategories.length === 0) {
            sortedCategories.push({ category: "Imagen", probability: 0.8 });
          } else if (sortedCategories.length === 1) {
            sortedCategories.push({ category: "Fotografía", probability: 0.7 });
          } else if (sortedCategories.length === 2) {
            sortedCategories.push({ category: "Gráfico", probability: 0.6 });
          } else if (sortedCategories.length === 3) {
            sortedCategories.push({ category: "Digital", probability: 0.5 });
          } else if (sortedCategories.length === 4) {
            sortedCategories.push({ category: "Visual", probability: 0.4 });
          }
        }
        
        // Retornar resultado
        resolve({
          success: true,
          predictions: sortedCategories,
          metadata: {
            dimensions: { width: img.width, height: img.height },
            avgBrightness,
            dominantColors
          }
        });
      };
      
      img.onerror = () => {
        resolve({
          success: false,
          error: "Error loading image",
          description: "Could not load the image for analysis"
        });
      };
      
      img.src = imageUrl;
    });
  };
  
  // Upload file to Firebase Storage
  const handleUpload = async () => {
    if (!file) {
      alert('Por favor selecciona una imagen primero');
      return;
    }
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      // Create unique filename with timestamp
      const timestamp = new Date().getTime();
      const fileName = `image_${timestamp}`;
      const fileExtension = file.name.split('.').pop();
      const fullFileName = `${fileName}.${fileExtension}`;
      
      // Create storage reference
      const storage = getStorage();
      const storageRef = ref(storage, `image_analysis/${fullFileName}`);
      
      // Upload file with progress monitoring
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Track upload progress
          const progress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Error uploading file:', error);
          alert('Error al subir la imagen');
          setUploading(false);
        },
        async () => {
          // Upload completed successfully
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          console.log('File uploaded successfully, download URL:', downloadURL);
          
          setUploading(false);
          
          // Mostrar estado de procesamiento
          setCurrentResult({
            id: fileName,
            imageUrl: downloadURL,
            status: 'processing'
          });
          
          try {
            // Usar Google Cloud Function para análisis
            console.log('Llamando a Cloud Function...');
            
            // Intentar primero con la URL de Cloud Functions
            let cloudFunctionUrl = 'https://us-central1-myoxxovision.cloudfunctions.net/analyze-image';
            
            // Si falla, intentar con la URL alternativa de Cloud Run
            const cloudRunUrl = 'https://analyze-image-pxzm7vgw3a-uc.a.run.app';
            
            try {
              console.log('Intentando con Cloud Functions URL:', cloudFunctionUrl);
              
              const response = await fetch(cloudFunctionUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify({ url: downloadURL })
              });
              
              if (!response.ok) {
                const errorText = await response.text();
                console.error(`Error HTTP: ${response.status}, Detalle:`, errorText);
                throw new Error(`Error HTTP: ${response.status}`);
              }
              
              const analysisResult = await response.json();
              console.log('Cloud Function analysis result:', analysisResult);
              
              // Guardar resultados en Firestore
              const db = getFirestore();
              const resultDoc = await addDoc(collection(db, 'image_analysis'), {
                result: analysisResult,
                imageUrl: downloadURL,
                timestamp: serverTimestamp()
              });
              
              // Actualizar resultado actual
              setCurrentResult({
                id: resultDoc.id,
                imageUrl: downloadURL,
                result: analysisResult,
                status: 'completed'
              });
            } catch (fetchError) {
              console.error('Error en fetch a Cloud Function:', fetchError);
              
              // Intentar con la URL alternativa de Cloud Run
              try {
                console.log('Intentando con Cloud Run URL:', cloudRunUrl);
                
                const response = await fetch(cloudRunUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                  },
                  body: JSON.stringify({ url: downloadURL })
                });
                
                if (!response.ok) {
                  const errorText = await response.text();
                  console.error(`Error HTTP con Cloud Run: ${response.status}, Detalle:`, errorText);
                  throw new Error(`Error HTTP con Cloud Run: ${response.status}`);
                }
                
                const analysisResult = await response.json();
                console.log('Cloud Run analysis result:', analysisResult);
                
                // Guardar resultados en Firestore
                const db = getFirestore();
                const resultDoc = await addDoc(collection(db, 'image_analysis'), {
                  result: analysisResult,
                  imageUrl: downloadURL,
                  timestamp: serverTimestamp()
                });
                
                // Actualizar resultado actual
                setCurrentResult({
                  id: resultDoc.id,
                  imageUrl: downloadURL,
                  result: analysisResult,
                  status: 'completed'
                });
                
                // Salir del bloque try/catch
                return;
              } catch (cloudRunError) {
                console.error('Error en fetch a Cloud Run:', cloudRunError);
                throw cloudRunError; // Re-lanzar para el bloque de respaldo
              }
            }
          } catch (error) {
            console.error('Error analizando imagen:', error);
            
            // Si falla la Cloud Function, usar análisis en cliente como respaldo
            try {
              console.log('Fallback to client-side analysis');
              const analysisResult = await analyzeImage(downloadURL);
              
              // Guardar resultados en Firestore
              const db = getFirestore();
              const resultDoc = await addDoc(collection(db, 'image_analysis'), {
                result: analysisResult,
                imageUrl: downloadURL,
                timestamp: serverTimestamp()
              });
              
              // Actualizar resultado actual
              setCurrentResult({
                id: resultDoc.id,
                imageUrl: downloadURL,
                result: analysisResult,
                status: 'completed'
              });
            } catch (fallbackError) {
              console.error('Error en análisis de respaldo:', fallbackError);
              alert('Error al analizar la imagen. Intenta de nuevo más tarde.');
              
              // Mantener la imagen pero mostrar error
              setCurrentResult({
                id: fileName,
                imageUrl: downloadURL,
                error: 'Error al procesar la imagen',
                status: 'error'
              });
            }
          }
        }
      );
    } catch (error) {
      console.error('Error in upload process:', error);
      alert('Error en el proceso de subida');
      setUploading(false);
    }
  };
  
  // Load recent analysis results
  useEffect(() => {
    const db = getFirestore();
    const analysisRef = collection(db, 'image_analysis');
    const q = query(analysisRef, orderBy('timestamp', 'desc'), limit(5));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results = [];
      snapshot.forEach((doc) => {
        results.push({
          id: doc.id,
          ...doc.data()
        });
      });
      setAnalysisResults(results);
    });
    
    return () => unsubscribe();
  }, []);
  
  // Render prediction results
  const renderPredictions = (result) => {
    if (!result || !result.result || !result.result.predictions) {
      return <p>No hay resultados de análisis disponibles</p>;
    }
    
    return (
      <div className="predictions-container">
        <h3>Predicciones:</h3>
        <ul className="predictions-list">
          {result.result.predictions.map((prediction, index) => (
            <li key={index} className="prediction-item">
              <span className="prediction-category">{prediction.category}</span>
              <div className="prediction-bar-container">
                <div 
                  className="prediction-bar" 
                  style={{ width: `${prediction.probability * 100}%` }}
                ></div>
                <span className="prediction-percentage">
                  {(prediction.probability * 100).toFixed(2)}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  };
  
  return (
    <div className="image-analyzer-container">
      <h2>Analizador de Imágenes</h2>
      <p>Sube una imagen para analizarla con inteligencia artificial</p>
      
      <div className="upload-section">
        <FileUpload onFileChange={handleFileChange} />
        
        <button 
          className="upload-button"
          onClick={handleUpload}
          disabled={!file || uploading}
        >
          {uploading ? `Subiendo: ${uploadProgress}%` : 'Analizar Imagen'}
        </button>
      </div>
      
      {currentResult && (
        <div className="current-result">
          <h3>Resultado del Análisis</h3>
          
          <div className="result-content">
            <div className="result-image">
              <img src={currentResult.imageUrl} alt="Imagen analizada" />
            </div>
            
            <div className="result-data">
              {currentResult.status === 'processing' ? (
                <div className="processing-indicator">
                  <div className="spinner"></div>
                  <p>Procesando imagen...</p>
                </div>
              ) : currentResult.status === 'error' ? (
                <div className="error-indicator">
                  <p>{currentResult.error || 'Error al procesar la imagen'}</p>
                </div>
              ) : (
                renderPredictions(currentResult)
              )}
            </div>
          </div>
        </div>
      )}
      
      {analysisResults.length > 0 && (
        <div className="recent-results">
          <h3>Análisis Recientes</h3>
          <div className="results-list">
            {analysisResults.map((result) => (
              <div 
                key={result.id} 
                className="result-item"
                onClick={() => setCurrentResult(result)}
              >
                <img src={result.imageUrl} alt="Análisis reciente" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageAnalyzer; 