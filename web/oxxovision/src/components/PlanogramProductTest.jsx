import React, { useState, useEffect } from 'react';
import { obtenerPlanogramas } from '../firebase';
import planogramTaskService from '../services/PlanogramTaskService';
import './PlanogramProductTest.css';

const PlanogramProductTest = ({ tiendaId }) => {
  const [planogramas, setPlanogramas] = useState([]);
  const [selectedPlanograma, setSelectedPlanograma] = useState('');
  const [productData, setProductData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load planograms when component mounts
  useEffect(() => {
    const loadPlanogramas = async () => {
      try {
        setLoading(true);
        const data = await obtenerPlanogramas(tiendaId);
        setPlanogramas(data || []);
      } catch (err) {
        console.error("Error loading planograms:", err);
        setError("Error al cargar planogramas: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    if (tiendaId) {
      loadPlanogramas();
    }
  }, [tiendaId]);

  // Handle planogram selection
  const handlePlanogramaChange = (e) => {
    setSelectedPlanograma(e.target.value);
    setProductData(null); // Reset product data when selecting a new planogram
  };

  // Load product data for selected planogram
  const loadProductData = async () => {
    if (!selectedPlanograma) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const productsByLevel = await planogramTaskService.getProductIdsByLevel(tiendaId, selectedPlanograma);
      console.log("Products by level:", productsByLevel);
      
      setProductData(productsByLevel);
    } catch (err) {
      console.error("Error loading product data:", err);
      setError("Error al cargar datos de productos: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="planogram-product-test">
      <h2>Test de Extracción de Productos por Nivel</h2>
      
      {error && (
        <div className="error-message">
          <span className="material-icons">error</span>
          {error}
        </div>
      )}
      
      <div className="test-controls">
        <div className="form-group">
          <label htmlFor="planograma">Seleccionar Planograma</label>
          <select 
            id="planograma" 
            value={selectedPlanograma} 
            onChange={handlePlanogramaChange}
            disabled={loading || planogramas.length === 0}
          >
            <option value="">-- Seleccionar planograma --</option>
            {planogramas.map(planograma => (
              <option key={planograma.id} value={planograma.id}>
                {planograma.nombre || `Planograma ${planograma.id.substring(0, 6)}`}
              </option>
            ))}
          </select>
        </div>
        
        <button 
          className="load-button" 
          onClick={loadProductData}
          disabled={loading || !selectedPlanograma}
        >
          {loading ? (
            <>
              <div className="spinner-small"></div>
              Cargando...
            </>
          ) : (
            <>
              <span className="material-icons">download</span>
              Cargar Productos
            </>
          )}
        </button>
      </div>
      
      {productData && (
        <div className="product-data-display">
          <h3>Productos por Nivel</h3>
          
          <div className="info-text">
            <p>
              Los niveles están ordenados de forma que el nivel más alto es el primer elemento del array,
              y el nivel 0 (el más bajo físicamente) es el último elemento. Cada nivel contiene un array de IDs de productos.
            </p>
          </div>
          
          <div className="result-json">
            <pre>{JSON.stringify(productData, null, 2)}</pre>
          </div>
          
          <div className="levels-preview">
            <h4>Vista Previa por Niveles</h4>
            
            <div className="levels-container">
              {productData.length === 0 ? (
                <p className="no-data">No se encontraron productos para este planograma</p>
              ) : (
                productData.map((level, index) => (
                  <div key={index} className="level-item">
                    <h5>Nivel {productData.length - index} (de arriba hacia abajo)</h5>
                    <div className="level-products">
                      {level && level.length > 0 ? (
                        level.map((productId, pidx) => (
                          <div key={pidx} className="product-id">
                            {productId}
                          </div>
                        ))
                      ) : (
                        <p className="no-products">No hay productos en este nivel</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanogramProductTest; 