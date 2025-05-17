import React, { useState, useEffect } from 'react';
import { 
  obtenerInventarioTienda, 
  actualizarStockProducto 
} from '../utils/updateStockUtils';
import './InventarioTienda.css';

const InventarioTienda = ({ tiendaId, onClose }) => {
  const [inventario, setInventario] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingProductId, setEditingProductId] = useState(null);
  const [newStock, setNewStock] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'nombre', direction: 'ascending' });
  const [filteredInventario, setFilteredInventario] = useState([]);
  
  // Cargar inventario al montar el componente
  useEffect(() => {
    const cargarInventario = async () => {
      try {
        setLoading(true);
        const data = await obtenerInventarioTienda(tiendaId);
        setInventario(data);
        setFilteredInventario(data);
      } catch (err) {
        console.error('Error al cargar inventario:', err);
        setError('No se pudo cargar el inventario de la tienda');
      } finally {
        setLoading(false);
      }
    };
    
    cargarInventario();
  }, [tiendaId]);
  
  // Filtrar y ordenar productos cuando cambia el término de búsqueda o el inventario
  useEffect(() => {
    if (!inventario) return;
    
    // Filtrar por término de búsqueda
    let filtered = [...inventario];
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(producto => 
        producto.nombre.toLowerCase().includes(search) || 
        producto.productoId.toLowerCase().includes(search)
      );
    }
    
    // Ordenar según la configuración de ordenamiento
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    
    setFilteredInventario(filtered);
  }, [inventario, searchTerm, sortConfig]);
  
  // Función para cambiar el ordenamiento
  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  // Iniciar edición de un producto
  const handleEditClick = (producto) => {
    setEditingProductId(producto.id);
    setNewStock(producto.stock.toString());
  };
  
  // Cancelar edición
  const handleCancelEdit = () => {
    setEditingProductId(null);
    setNewStock('');
  };
  
  // Guardar cambios de stock
  const handleSaveStock = async (productoId) => {
    if (!newStock || isNaN(parseInt(newStock))) {
      return;
    }
    
    const stockValue = parseInt(newStock);
    if (stockValue < 0) {
      return;
    }
    
    try {
      const success = await actualizarStockProducto(tiendaId, productoId, stockValue);
      if (success) {
        // Actualizar estado local
        setInventario(prev => 
          prev.map(item => 
            item.id === productoId ? { ...item, stock: stockValue } : item
          )
        );
        setEditingProductId(null);
      } else {
        setError('No se pudo actualizar el stock del producto');
      }
    } catch (err) {
      console.error('Error al actualizar stock:', err);
      setError('Error al actualizar el stock');
    }
  };
  
  // Renderizar estado de carga
  if (loading) {
    return (
      <div className="inventario-tienda-container">
        <div className="inventario-header">
          <h3>Inventario de Tienda</h3>
          <button className="close-button" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>
        <div className="inventario-loading">
          <div className="loading-spinner small"></div>
          <span>Cargando inventario...</span>
        </div>
      </div>
    );
  }
  
  // Renderizar error
  if (error) {
    return (
      <div className="inventario-tienda-container">
        <div className="inventario-header">
          <h3>Inventario de Tienda</h3>
          <button className="close-button" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>
        <div className="inventario-error">
          <span className="material-icons">error</span>
          <p>{error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="inventario-tienda-container">
      <div className="inventario-header">
        <h3>
          <span className="material-icons">inventory</span>
          Inventario de Tienda
        </h3>
        <button className="close-button" onClick={onClose}>
          <span className="material-icons">close</span>
        </button>
      </div>
      
      <div className="inventario-controls">
        <div className="search-box">
          <span className="material-icons">search</span>
          <input
            type="text"
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              className="clear-search" 
              onClick={() => setSearchTerm('')}
              title="Limpiar búsqueda"
            >
              <span className="material-icons">close</span>
            </button>
          )}
        </div>
        
        <div className="inventario-info">
          {filteredInventario.length} productos {searchTerm ? 'encontrados' : 'en inventario'}
        </div>
      </div>
      
      <div className="inventario-table-container">
        <table className="inventario-table">
          <thead>
            <tr>
              <th onClick={() => requestSort('nombre')} className={sortConfig.key === 'nombre' ? sortConfig.direction : ''}>
                Producto
                <span className="material-icons sort-icon">
                  {sortConfig.key === 'nombre' 
                    ? (sortConfig.direction === 'ascending' ? 'arrow_upward' : 'arrow_downward') 
                    : 'unfold_more'}
                </span>
              </th>
              <th onClick={() => requestSort('precio')} className={sortConfig.key === 'precio' ? sortConfig.direction : ''}>
                Precio
                <span className="material-icons sort-icon">
                  {sortConfig.key === 'precio' 
                    ? (sortConfig.direction === 'ascending' ? 'arrow_upward' : 'arrow_downward') 
                    : 'unfold_more'}
                </span>
              </th>
              <th onClick={() => requestSort('stock')} className={sortConfig.key === 'stock' ? sortConfig.direction : ''}>
                Stock
                <span className="material-icons sort-icon">
                  {sortConfig.key === 'stock' 
                    ? (sortConfig.direction === 'ascending' ? 'arrow_upward' : 'arrow_downward') 
                    : 'unfold_more'}
                </span>
              </th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventario.length === 0 ? (
              <tr>
                <td colSpan="4" className="no-products">
                  <span className="material-icons">inventory_2</span>
                  <p>No hay productos en el inventario</p>
                </td>
              </tr>
            ) : (
              filteredInventario.map(producto => (
                <tr key={producto.id}>
                  <td className="product-name" title={producto.nombre}>
                    {producto.nombre}
                  </td>
                  <td className="product-price">${producto.precio.toFixed(2)}</td>
                  <td className={`product-stock ${producto.stock < 10 ? 'low-stock' : ''}`}>
                    {editingProductId === producto.id ? (
                      <input 
                        type="number" 
                        className="stock-input"
                        value={newStock}
                        onChange={(e) => setNewStock(e.target.value)}
                        min="0"
                        autoFocus
                      />
                    ) : (
                      <div className="stock-display">
                        <span className={`stock-value ${producto.stock < 10 ? 'low-stock-value' : ''}`}>
                          {producto.stock}
                        </span>
                        <span className="stock-units">unidades</span>
                        {producto.stock < 10 && (
                          <span className="stock-warning" title="Stock bajo">
                            <span className="material-icons">warning</span>
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="product-actions">
                    {editingProductId === producto.id ? (
                      <div className="edit-actions">
                        <button 
                          onClick={() => handleSaveStock(producto.id)}
                          className="save-button"
                          title="Guardar cambios"
                        >
                          <span className="material-icons">check</span>
                        </button>
                        <button 
                          onClick={handleCancelEdit}
                          className="cancel-button"
                          title="Cancelar"
                        >
                          <span className="material-icons">close</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEditClick(producto)}
                        className="edit-button"
                        title="Editar stock"
                      >
                        <span className="material-icons">edit</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventarioTienda; 