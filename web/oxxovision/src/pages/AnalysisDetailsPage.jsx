import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth, getUserData } from '../firebase';
import Sidebar from '../components/Sidebar';
import './AnalysisDetailsPage.css';

const AnalysisDetailsPage = () => {
  const { analysisId } = useParams();
  const navigate = useNavigate();
  
  const [userData, setUserData] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load user data and analysis details
  useEffect(() => {
    const loadUserAndAnalysis = async () => {
      try {
        setLoading(true);
        
        // Get current user
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error('No hay un usuario autenticado');
        }
        
        // Load user data
        const userDataResult = await getUserData(currentUser.uid);
        setUserData(userDataResult);
        
        // Load analysis details
        const docRef = doc(db, "analysis", analysisId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAnalysis({
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date()
          });
        } else {
          setError("No se encontró el análisis solicitado");
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadUserAndAnalysis();
  }, [analysisId]);
  
  // Format date for display
  const formatDate = (date) => {
    return new Date(date).toLocaleString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Render discrepancies list
  const renderDiscrepancias = () => {
    // Ensure discrepancias is always treated as an array, even if it's stored as an object
    const discrepanciasArray = analysis?.discrepancias ? 
      (Array.isArray(analysis.discrepancias) ? analysis.discrepancias : Object.values(analysis.discrepancias)) : [];
    
    if (!discrepanciasArray.length) {
      return (
        <div className="no-discrepancies-message">
          <span className="material-icons">check_circle</span>
          <p>No se encontraron discrepancias en este análisis</p>
        </div>
      );
    }
    
    return (
      <div className="discrepancies-list">
        {discrepanciasArray.map((disc, idx) => (
          <div key={idx} className="discrepancy-item">
            <div className="disc-header">
              <span className="material-icons">error</span>
              <h4>Discrepancia #{idx + 1}</h4>
            </div>
            <div className="disc-details">
              <p><strong>Producto esperado:</strong> {disc.expected_product || "N/A"}</p>
              <p><strong>Producto encontrado:</strong> {disc.found_product || "N/A"}</p>
              <p><strong>Posición:</strong> {disc.position || "N/A"}</p>
              {disc.coordinates && (
                <p><strong>Coordenadas:</strong> X: {disc.coordinates.x}, Y: {disc.coordinates.y}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="analysis-details-page">
      <Sidebar userData={userData} />
      
      <div className="main-content">
        <div className="page-header">
          <button 
            className="back-button" 
            onClick={() => navigate('/statistics')}
            title="Volver a estadísticas"
          >
            <span className="material-icons">arrow_back</span>
            <span>Volver a estadísticas</span>
          </button>
          
          <h1>Detalles del Análisis</h1>
        </div>
        
        {error && (
          <div className="error-message">
            <span className="material-icons">error</span>
            <p>{error}</p>
          </div>
        )}
        
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Cargando detalles del análisis...</p>
          </div>
        ) : analysis ? (
          <div className="analysis-content">
            <div className="analysis-header">
              <div className="analysis-meta">
                <h2>{analysis.planogramaNombre || "Análisis de Planograma"}</h2>
                <p className="analysis-subtitle">
                  <span className="meta-item">
                    <span className="material-icons">store</span>
                    {analysis.tiendaNombre || "N/A"}
                  </span>
                  <span className="meta-item">
                    <span className="material-icons">calendar_today</span>
                    {formatDate(analysis.createdAt)}
                  </span>
                  <span className="meta-item">
                    <span className="material-icons">person</span>
                    {analysis.userName || "Usuario"}
                  </span>
                </p>
              </div>
              
              <div className="analysis-stats">
                <div className="stat-box">
                  <div className="stat-value">{analysis.discrepanciasCount || 0}</div>
                  <div className="stat-label">Discrepancias</div>
                </div>
                
                <div className="stat-box">
                  <div className="stat-value">{typeof analysis.similitud === 'number' ? analysis.similitud.toFixed(1) : '0'}%</div>
                  <div className="stat-label">Similitud</div>
                </div>
                
                <div className="stat-box">
                  <div className="stat-value">{analysis.productosEncontrados || 0}/{analysis.productosEsperados || 0}</div>
                  <div className="stat-label">Productos</div>
                </div>
              </div>
            </div>
            
            <div className="analysis-sections">
              <div className="analysis-section">
                <div className="section-header">
                  <span className="material-icons">info</span>
                  <h3>Información Detallada</h3>
                </div>
                <div className="info-grid">
                  <div className="info-item">
                    <div className="info-label">Tienda</div>
                    <div className="info-value">{analysis.tiendaNombre || "N/A"}</div>
                  </div>
                  
                  <div className="info-item">
                    <div className="info-label">Planograma</div>
                    <div className="info-value">{analysis.planogramaNombre || "N/A"}</div>
                  </div>
                  
                  <div className="info-item">
                    <div className="info-label">Sección</div>
                    <div className="info-value">{analysis.seccion || "N/A"}</div>
                  </div>
                  
                  <div className="info-item">
                    <div className="info-label">Fecha</div>
                    <div className="info-value">{formatDate(analysis.createdAt)}</div>
                  </div>
                  
                  <div className="info-item">
                    <div className="info-label">Usuario</div>
                    <div className="info-value">{analysis.userName || "N/A"}</div>
                  </div>
                  
                  <div className="info-item">
                    <div className="info-label">ID de Análisis</div>
                    <div className="info-value small">{analysisId}</div>
                  </div>
                </div>
              </div>
              
              {analysis.imageUrl && (
                <div className="analysis-section">
                  <div className="section-header">
                    <span className="material-icons">image</span>
                    <h3>Imagen del Análisis</h3>
                  </div>
                  <div className="image-container">
                    <img 
                      src={analysis.imageUrl} 
                      alt="Visualización del análisis" 
                      className="analysis-image"
                    />
                    <a 
                      href={analysis.imageUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="view-full-image-button"
                    >
                      <span className="material-icons">open_in_new</span>
                      Ver imagen completa
                    </a>
                  </div>
                </div>
              )}
              
              <div className="analysis-section">
                <div className="section-header">
                  <span className="material-icons">report_problem</span>
                  <h3>Discrepancias Detectadas</h3>
                </div>
                {renderDiscrepancias()}
              </div>
              
              {analysis.notas && (
                <div className="analysis-section">
                  <div className="section-header">
                    <span className="material-icons">notes</span>
                    <h3>Notas</h3>
                  </div>
                  <div className="notes-content">
                    <p>{analysis.notas}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="error-container">
            <span className="material-icons">sentiment_very_dissatisfied</span>
            <p>No se pudo encontrar el análisis solicitado</p>
            <button 
              className="back-to-stats-button" 
              onClick={() => navigate('/statistics')}
            >
              Volver a Estadísticas
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisDetailsPage; 