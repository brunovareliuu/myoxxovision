import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db, auth, getUserData, obtenerTiendas } from '../firebase';
import Sidebar from '../components/Sidebar';
import './StatisticsPage.css';

// Analysis Details Modal Component
const AnalysisDetailsModal = ({ isOpen, onClose, analysisId }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalysisDetails = async () => {
      if (!analysisId) return;
      
      try {
        setLoading(true);
        const docRef = doc(db, "analysis", analysisId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          
          // Debug the discrepancias structure
          if (data.discrepancias) {
            console.log('Discrepancias data type:', typeof data.discrepancias);
            console.log('Is Array?', Array.isArray(data.discrepancias));
            console.log('Structure:', data.discrepancias);
          }
          
          setAnalysis({
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date()
          });
        } else {
          setError("No se encontró el análisis");
        }
      } catch (err) {
        console.error("Error al obtener detalles del análisis:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    if (isOpen) {
      fetchAnalysisDetails();
    }
  }, [analysisId, isOpen]);

  if (!isOpen) return null;
  
  const formatDate = (date) => {
    return new Date(date).toLocaleString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const renderDiscrepancias = () => {
    // Ensure discrepancias is always treated as an array, even if it's stored as an object
    const discrepanciasArray = analysis?.discrepancias ? 
      (Array.isArray(analysis.discrepancias) ? analysis.discrepancias : Object.values(analysis.discrepancias)) : [];
    
    if (!discrepanciasArray.length) {
      return (
        <div className="no-discrepancies-message">
          <span className="material-icons">check_circle</span>
          <p>No se encontraron discrepancias</p>
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
    <div className="modal-overlay">
      <div className="analysis-modal">
        <div className="modal-header">
          <h3>Detalles del Análisis</h3>
          <button onClick={onClose} className="close-button">
            <span className="material-icons">close</span>
          </button>
        </div>
        
        {loading ? (
          <div className="modal-loading">
            <div className="spinner"></div>
            <p>Cargando detalles...</p>
          </div>
        ) : error ? (
          <div className="error-message">
            <span className="material-icons">error</span>
            <p>{error}</p>
          </div>
        ) : analysis ? (
          <div className="modal-content">
            <div className="analysis-overview">
              <div className="overview-card">
                <div className="overview-header">
                  <span className="material-icons">info</span>
                  <h4>Información General</h4>
                </div>
                <div className="overview-content">
                  <p><strong>Fecha:</strong> {formatDate(analysis.createdAt)}</p>
                  <p><strong>Tienda:</strong> {analysis.tiendaNombre || "N/A"}</p>
                  <p><strong>Planograma:</strong> {analysis.planogramaNombre || "N/A"}</p>
                  <p><strong>Sección:</strong> {analysis.seccion || "N/A"}</p>
                  <p><strong>Usuario:</strong> {analysis.userName || "N/A"}</p>
                </div>
              </div>
              
              <div className="overview-card">
                <div className="overview-header">
                  <span className="material-icons">assessment</span>
                  <h4>Métricas</h4>
                </div>
                <div className="overview-content stats-grid">
                  <div className="stat-item">
                    <div className="stat-circle">
                      <span>{analysis.discrepanciasCount || 0}</span>
                    </div>
                    <p>Discrepancias</p>
                  </div>
                  
                  <div className="stat-item">
                    <div className="stat-circle">
                      <span>{typeof analysis.similitud === 'number' ? analysis.similitud.toFixed(1) : '0'}%</span>
                    </div>
                    <p>Similitud</p>
                  </div>
                  
                  <div className="stat-item">
                    <div className="stat-circle">
                      <span>{analysis.productosEncontrados || 0}</span>
                    </div>
                    <p>Encontrados</p>
                  </div>
                  
                  <div className="stat-item">
                    <div className="stat-circle">
                      <span>{analysis.productosEsperados || 0}</span>
                    </div>
                    <p>Esperados</p>
                  </div>
                </div>
              </div>
            </div>
            
            {analysis.imageUrl && (
              <div className="analysis-image-section">
                <h4>Imagen del Análisis</h4>
                <div className="analysis-image-container">
                  <img src={analysis.imageUrl} alt="Visualización del análisis" />
                </div>
              </div>
            )}
            
            <div className="discrepancies-section">
              <h4>Discrepancias Detectadas</h4>
              {renderDiscrepancias()}
            </div>
            
            <div className="modal-actions">
              <button onClick={onClose} className="close-modal-button">
                Cerrar
              </button>
              <a 
                href={`/analysis/${analysis.id}`} 
                className="view-full-button"
                target="_blank" 
                rel="noopener noreferrer"
              >
                <span className="material-icons">open_in_new</span>
                Ver página completa
              </a>
            </div>
          </div>
        ) : (
          <div className="error-message">
            <span className="material-icons">sentiment_dissatisfied</span>
            <p>No se pudo cargar la información del análisis</p>
          </div>
        )}
      </div>
    </div>
  );
};

const StatisticsPage = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analyses, setAnalyses] = useState([]);
  const [tiendas, setTiendas] = useState([]);
  
  // Filters
  const [selectedTienda, setSelectedTienda] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Stats
  const [stats, setStats] = useState({
    totalAnalyses: 0,
    avgDiscrepancies: 0,
    avgSimilarity: 0,
    storeWithMostAnalyses: { name: '', count: 0 },
    recentTrend: 'stable'
  });

  const [selectedAnalysisId, setSelectedAnalysisId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load user data and analyses on component mount
  useEffect(() => {
    const loadUserAndData = async () => {
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
        
        // Load tiendas
        const tiendasData = await obtenerTiendas();
        setTiendas(tiendasData);
        
        // Load analyses
        await loadAnalyses();
        
      } catch (error) {
        console.error('Error loading data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadUserAndData();
  }, []);
  
  // Load analyses based on filters
  const loadAnalyses = async () => {
    try {
      setLoading(true);
      
      // Build query
      let analysisQuery = collection(db, 'analysis');
      let constraints = [];
      
      // Add tienda filter if selected
      if (selectedTienda) {
        constraints.push(where('tiendaId', '==', selectedTienda));
      }
      
      // Add date range filter
      if (dateRange !== 'all') {
        const today = new Date();
        let dateLimit;
        
        switch (dateRange) {
          case 'today':
            dateLimit = new Date(today.setHours(0, 0, 0, 0));
            break;
          case 'week':
            dateLimit = new Date(today.setDate(today.getDate() - 7));
            break;
          case 'month':
            dateLimit = new Date(today.setMonth(today.getMonth() - 1));
            break;
          default:
            dateLimit = null;
        }
        
        if (dateLimit) {
          constraints.push(where('createdAt', '>=', dateLimit));
        }
      }
      
      // Add sorting
      constraints.push(orderBy(sortBy === 'date' ? 'createdAt' : 'discrepanciasCount', sortOrder));
      
      // Execute query
      const q = query(analysisQuery, ...constraints);
      const querySnapshot = await getDocs(q);
      
      // Process results
      const analysesData = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Only include if it matches search term (if any)
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          const tiendaNombre = (data.tiendaNombre || '').toLowerCase();
          const planogramaNombre = (data.planogramaNombre || '').toLowerCase();
          
          if (!tiendaNombre.includes(searchLower) && !planogramaNombre.includes(searchLower)) {
            return;
          }
        }
        
        analysesData.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
        });
      });
      
      // Update analyses state
      setAnalyses(analysesData);
      
      // Calculate statistics
      calculateStatistics(analysesData);
      
    } catch (error) {
      console.error('Error loading analyses:', error);
      setError('Error al cargar los análisis: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Calculate statistics based on loaded analyses
  const calculateStatistics = (analysesData) => {
    if (!analysesData.length) {
      setStats({
        totalAnalyses: 0,
        avgDiscrepancies: 0,
        avgSimilarity: 0,
        storeWithMostAnalyses: { name: '', count: 0 },
        recentTrend: 'stable'
      });
      return;
    }
    
    // Total number of analyses
    const totalAnalyses = analysesData.length;
    
    // Average discrepancies
    const totalDiscrepancies = analysesData.reduce((sum, analysis) => 
      sum + (analysis.discrepanciasCount || 0), 0);
    const avgDiscrepancies = totalDiscrepancies / totalAnalyses;
    
    // Average similarity - only include valid numeric values
    let validSimilarityCount = 0;
    const totalSimilarity = analysesData.reduce((sum, analysis) => {
      if (typeof analysis.similitud === 'number') {
        validSimilarityCount++;
        return sum + analysis.similitud;
      }
      return sum;
    }, 0);
    const avgSimilarity = validSimilarityCount > 0 ? totalSimilarity / validSimilarityCount : 0;
    
    // Store with most analyses
    const storeCount = {};
    analysesData.forEach(analysis => {
      const storeId = analysis.tiendaId;
      const storeName = analysis.tiendaNombre || storeId;
      storeCount[storeId] = { 
        count: (storeCount[storeId]?.count || 0) + 1,
        name: storeName
      };
    });
    
    let storeWithMostAnalyses = { name: '', count: 0 };
    Object.keys(storeCount).forEach(storeId => {
      if (storeCount[storeId].count > storeWithMostAnalyses.count) {
        storeWithMostAnalyses = {
          name: storeCount[storeId].name,
          count: storeCount[storeId].count
        };
      }
    });
    
    // Recent trend (last 10 vs previous 10)
    let recentTrend = 'stable';
    if (analysesData.length >= 20) {
      const sortedByDate = [...analysesData].sort((a, b) => 
        b.createdAt.getTime() - a.createdAt.getTime());
      
      const recent10 = sortedByDate.slice(0, 10);
      const previous10 = sortedByDate.slice(10, 20);
      
      const avgDiscRecent = recent10.reduce((sum, a) => sum + (a.discrepanciasCount || 0), 0) / 10;
      const avgDiscPrevious = previous10.reduce((sum, a) => sum + (a.discrepanciasCount || 0), 0) / 10;
      
      if (avgDiscRecent < avgDiscPrevious * 0.9) {
        recentTrend = 'improving';
      } else if (avgDiscRecent > avgDiscPrevious * 1.1) {
        recentTrend = 'worsening';
      }
    }
    
    // Update stats state
    setStats({
      totalAnalyses,
      avgDiscrepancies,
      avgSimilarity,
      storeWithMostAnalyses,
      recentTrend
    });
  };
  
  // Handle filter changes
  const handleFilterChange = () => {
    setCurrentPage(1);
    loadAnalyses();
  };
  
  // Pagination
  const totalPages = Math.ceil(analyses.length / itemsPerPage);
  const paginatedAnalyses = analyses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
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
  
  // Handle opening the modal with analysis details
  const openAnalysisDetails = (analysisId) => {
    setSelectedAnalysisId(analysisId);
    setIsModalOpen(true);
  };
  
  // Handle closing the modal
  const closeAnalysisDetails = () => {
    setIsModalOpen(false);
  };
  
  return (
    <div className="statistics-page">
      <Sidebar userData={userData} />
      
      <div className="main-content">
        <h1>Estadísticas de Análisis de Planogramas</h1>
        
        {error && (
          <div className="error-message">
            <span className="material-icons">error</span>
            <p>{error}</p>
          </div>
        )}
        
        {/* Statistics Summary */}
        <div className="statistics-summary">
          <div className="stat-card">
            <div className="stat-icon">
              <span className="material-icons">analytics</span>
            </div>
            <div className="stat-content">
              <div className="stat-title">Total de Análisis</div>
              <div className="stat-value">{stats.totalAnalyses}</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <span className="material-icons">warning</span>
            </div>
            <div className="stat-content">
              <div className="stat-title">Discrepancias Promedio</div>
              <div className="stat-value">{stats.avgDiscrepancies.toFixed(2)}</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <span className="material-icons">compare</span>
            </div>
            <div className="stat-content">
              <div className="stat-title">Similitud Promedio</div>
              <div className="stat-value">{stats.avgSimilarity.toFixed(2)}%</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <span className="material-icons">store</span>
            </div>
            <div className="stat-content">
              <div className="stat-title">Tienda con Más Análisis</div>
              <div className="stat-value">{stats.storeWithMostAnalyses.name || 'N/A'}</div>
              <div className="stat-subtitle">{stats.storeWithMostAnalyses.count} análisis</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className={`stat-icon ${stats.recentTrend}`}>
              <span className="material-icons">
                {stats.recentTrend === 'improving' ? 'trending_up' : 
                 stats.recentTrend === 'worsening' ? 'trending_down' : 'trending_flat'}
              </span>
            </div>
            <div className="stat-content">
              <div className="stat-title">Tendencia Reciente</div>
              <div className="stat-value">
                {stats.recentTrend === 'improving' ? 'Mejorando' : 
                 stats.recentTrend === 'worsening' ? 'Empeorando' : 'Estable'}
              </div>
            </div>
          </div>
        </div>
        
        {/* Filters Section */}
        <div className="filters-section">
          <h2>Filtros</h2>
          
          <div className="filters-grid">
            <div className="filter-group">
              <label htmlFor="tiendaSelect">Tienda:</label>
              <select 
                id="tiendaSelect" 
                value={selectedTienda} 
                onChange={(e) => setSelectedTienda(e.target.value)}
              >
                <option value="">Todas las tiendas</option>
                {tiendas.map((tienda) => (
                  <option key={tienda.id} value={tienda.id}>
                    {tienda.nombre || `Tienda ${tienda.id}`}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label htmlFor="dateRangeSelect">Período:</label>
              <select 
                id="dateRangeSelect" 
                value={dateRange} 
                onChange={(e) => setDateRange(e.target.value)}
              >
                <option value="all">Todo el tiempo</option>
                <option value="today">Hoy</option>
                <option value="week">Última semana</option>
                <option value="month">Último mes</option>
              </select>
            </div>
            
            <div className="filter-group">
              <label htmlFor="sortBySelect">Ordenar por:</label>
              <select 
                id="sortBySelect" 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="date">Fecha</option>
                <option value="discrepancies">Discrepancias</option>
              </select>
            </div>
            
            <div className="filter-group">
              <label htmlFor="sortOrderSelect">Orden:</label>
              <select 
                id="sortOrderSelect" 
                value={sortOrder} 
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="desc">Descendente</option>
                <option value="asc">Ascendente</option>
              </select>
            </div>
            
            <div className="filter-group search-group">
              <label htmlFor="searchInput">Buscar:</label>
              <div className="search-input-wrapper">
                <input 
                  id="searchInput" 
                  type="text" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por tienda o planograma"
                />
                <span className="material-icons">search</span>
              </div>
            </div>
            
            <div className="filter-group button-group">
              <button 
                className="apply-filters-button" 
                onClick={handleFilterChange}
                disabled={loading}
              >
                {loading ? (
                  <span className="spinner"></span>
                ) : (
                  <>
                    <span className="material-icons">filter_list</span>
                    Aplicar Filtros
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Results Section */}
        <div className="results-section">
          <h2>Resultados ({analyses.length})</h2>
          
          {analyses.length === 0 ? (
            <div className="no-results">
              <span className="material-icons">sentiment_dissatisfied</span>
              <p>No se encontraron análisis con los filtros seleccionados.</p>
            </div>
          ) : (
            <>
              <div className="analysis-table-wrapper">
                <table className="analysis-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tienda</th>
                      <th>Planograma</th>
                      <th>Discrepancias</th>
                      <th>Similitud</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAnalyses.map((analysis) => (
                      <tr key={analysis.id} className="analysis-row">
                        <td>{formatDate(analysis.createdAt)}</td>
                        <td>{analysis.tiendaNombre || 'N/A'}</td>
                        <td>{analysis.planogramaNombre || 'N/A'}</td>
                        <td className={analysis.discrepanciasCount > 0 ? 'has-discrepancies' : 'no-discrepancies'}>
                          {analysis.discrepanciasCount || 0}
                        </td>
                        <td className="similarity-cell">
                          <div className="similarity-bar-container">
                            <div 
                              className="similarity-bar" 
                              style={{ width: `${typeof analysis.similitud === 'number' ? analysis.similitud : 0}%` }}
                            ></div>
                            <span className="similarity-value">
                              {typeof analysis.similitud === 'number' ? analysis.similitud.toFixed(1) : '0'}%
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button 
                              className="view-button" 
                              onClick={() => openAnalysisDetails(analysis.id)}
                              title="Ver detalles"
                            >
                              <span className="material-icons">visibility</span>
                            </button>
                            {analysis.imageUrl && (
                              <button 
                                className="image-button" 
                                onClick={() => window.open(analysis.imageUrl, '_blank')}
                                title="Ver imagen"
                              >
                                <span className="material-icons">image</span>
                              </button>
                            )}
                            <a 
                              href={`/analysis/${analysis.id}`}
                              className="full-page-button"
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Ver página completa"
                            >
                              <span className="material-icons">open_in_new</span>
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="pagination-button"
                  >
                    <span className="material-icons">first_page</span>
                  </button>
                  
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="pagination-button"
                  >
                    <span className="material-icons">chevron_left</span>
                  </button>
                  
                  <span className="page-info">
                    Página {currentPage} de {totalPages}
                  </span>
                  
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="pagination-button"
                  >
                    <span className="material-icons">chevron_right</span>
                  </button>
                  
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="pagination-button"
                  >
                    <span className="material-icons">last_page</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Analysis Details Modal */}
      <AnalysisDetailsModal 
        isOpen={isModalOpen}
        onClose={closeAnalysisDetails}
        analysisId={selectedAnalysisId}
      />
    </div>
  );
};

export default StatisticsPage; 