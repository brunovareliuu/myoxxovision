import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  obtenerTiendas, 
  obtenerProductos, 
  db
} from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import Sidebar from '../components/Sidebar';
import { 
  actualizarStockTiendas, 
  verificarInventarioTienda, 
  obtenerInventarioTienda,
  actualizarStockProducto
} from '../utils/updateStockUtils';
import './ProductosPage.css'; // Reutilizamos los estilos de productos

const InventarioPage = () => {
  const [tiendas, setTiendas] = useState([]);
  const [tiendaSeleccionada, setTiendaSeleccionada] = useState(null);
  const [productos, setProductos] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingInventario, setLoadingInventario] = useState(false);
  const [actualizandoStock, setActualizandoStock] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [filtro, setFiltro] = useState('');
  const navigate = useNavigate();

  // Cargar tiendas
  useEffect(() => {
    const cargarTiendas = async () => {
      try {
        setLoading(true);
        const tiendasData = await obtenerTiendas();
        setTiendas(tiendasData);
        
        // Cargar productos
        const productosData = await obtenerProductos();
        setProductos(productosData);
      } catch (error) {
        console.error('Error al cargar datos:', error);
        setMensaje({
          tipo: 'error',
          texto: 'Error al cargar los datos. Por favor, intenta de nuevo.'
        });
      } finally {
        setLoading(false);
      }
    };

    cargarTiendas();
  }, []);

  // Cargar inventario cuando se selecciona una tienda
  useEffect(() => {
    const cargarInventario = async () => {
      if (!tiendaSeleccionada) return;
      
      try {
        setLoadingInventario(true);
        
        // Verificar si la tienda tiene inventario
        const tieneInventario = await verificarInventarioTienda(tiendaSeleccionada.id);
        
        if (!tieneInventario) {
          setInventario([]);
          setMensaje({
            tipo: 'info',
            texto: 'Esta tienda no tiene inventario registrado. Puedes generar stock ficticio.'
          });
          return;
        }
        
        // Obtener inventario usando la nueva función
        const inventarioData = await obtenerInventarioTienda(tiendaSeleccionada.id);
        setInventario(inventarioData);
        setMensaje(null);
      } catch (error) {
        console.error('Error al cargar inventario:', error);
        setMensaje({
          tipo: 'error',
          texto: 'Error al cargar el inventario de la tienda.'
        });
      } finally {
        setLoadingInventario(false);
      }
    };

    cargarInventario();
  }, [tiendaSeleccionada]);

  // Filtrar inventario
  const inventarioFiltrado = inventario.filter(item => {
    if (filtro === '') return true;
    
    return (
      (item.nombre && item.nombre.toLowerCase().includes(filtro.toLowerCase())) ||
      (item.categoria && item.categoria.toLowerCase().includes(filtro.toLowerCase()))
    );
  });

  // Generar stock ficticio para la tienda seleccionada
  const handleGenerarStock = async () => {
    if (!tiendaSeleccionada) return;
    
    try {
      setActualizandoStock(true);
      setMensaje(null);
      
      // Actualizar stock para todas las tiendas
      const resultado = await actualizarStockTiendas();
      
      if (resultado.success) {
        // Recargar el inventario con la nueva estructura
        const inventarioActualizado = await obtenerInventarioTienda(tiendaSeleccionada.id);
        setInventario(inventarioActualizado);
        
        setMensaje({
          tipo: 'exito',
          texto: 'Stock generado correctamente.'
        });
      } else {
        setMensaje({
          tipo: 'error',
          texto: resultado.message
        });
      }
    } catch (error) {
      console.error('Error al generar stock:', error);
      setMensaje({
        tipo: 'error',
        texto: `Error: ${error.message}`
      });
    } finally {
      setActualizandoStock(false);
    }
  };

  // Actualizar stock de un producto
  const handleActualizarStock = async (productoId, nuevoStock) => {
    if (!tiendaSeleccionada || !productoId) return;
    
    try {
      const stockValue = parseInt(nuevoStock);
      if (isNaN(stockValue) || stockValue < 0) {
        alert('El stock debe ser un número positivo');
        return;
      }
      
      // Usar la nueva función para actualizar stock
      const actualizado = await actualizarStockProducto(
        tiendaSeleccionada.id, 
        productoId, 
        stockValue
      );
      
      if (actualizado) {
        // Actualizar en el estado local
        setInventario(inventario.map(item => 
          item.id === productoId 
            ? { ...item, stock: stockValue, ultimaActualizacion: new Date().toISOString() } 
            : item
        ));
        
        // Mostrar mensaje temporal
        setMensaje({
          tipo: 'exito',
          texto: 'Stock actualizado correctamente.'
        });
        
        // Ocultar mensaje después de 3 segundos
        setTimeout(() => {
          setMensaje(null);
        }, 3000);
      } else {
        setMensaje({
          tipo: 'error',
          texto: 'No se pudo actualizar el stock del producto.'
        });
      }
    } catch (error) {
      console.error('Error al actualizar stock:', error);
      setMensaje({
        tipo: 'error',
        texto: `Error al actualizar stock: ${error.message}`
      });
    }
  };

  return (
    <div className="layout-container">
      <Sidebar />
      
      <div className="main-content">
        <header className="content-header">
          <h1>Gestión de Inventario</h1>
          <div className="header-actions">
            <button className="back-button" onClick={() => navigate('/dashboard')}>
              <span className="material-icons">arrow_back</span>
              Volver al Dashboard
            </button>
          </div>
        </header>
        
        <div className="productos-page">
          <div className="filtros-container">
            <div className="filtro-tienda">
              <label>Seleccionar Tienda:</label>
              <select 
                value={tiendaSeleccionada?.id || ''} 
                onChange={(e) => {
                  const tiendaId = e.target.value;
                  const tienda = tiendas.find(t => t.id === tiendaId);
                  setTiendaSeleccionada(tienda || null);
                }}
              >
                <option value="">-- Seleccionar tienda --</option>
                {tiendas.map(tienda => (
                  <option key={tienda.id} value={tienda.id}>
                    {tienda.nombre} ({tienda.codigo || tienda.codigoTienda})
                  </option>
                ))}
              </select>
            </div>
            
            {tiendaSeleccionada && (
              <>
                <div className="filtro-busqueda">
                  <span className="material-icons">search</span>
                  <input 
                    type="text"
                    placeholder="Buscar producto..." 
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                  />
                </div>
                
                <button 
                  className={`generar-stock-btn ${actualizandoStock ? 'disabled' : ''}`}
                  onClick={actualizandoStock ? null : handleGenerarStock}
                  disabled={actualizandoStock}
                >
                  <span className="material-icons">autorenew</span>
                  {actualizandoStock ? 'Generando...' : 'Generar Stock Ficticio'}
                </button>
              </>
            )}
          </div>
          
          {mensaje && (
            <div className={`mensaje-inventario ${mensaje.tipo}`}>
              <span className="material-icons">
                {mensaje.tipo === 'exito' ? 'check_circle' : 
                 mensaje.tipo === 'error' ? 'error' : 'info'}
              </span>
              {mensaje.texto}
            </div>
          )}
          
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Cargando datos...</p>
            </div>
          ) : (
            <>
              {tiendaSeleccionada ? (
                <>
                  <div className="tienda-header">
                    <h2>{tiendaSeleccionada.nombre}</h2>
                    <p>
                      <strong>Código:</strong> {tiendaSeleccionada.codigoTienda} | 
                      <strong> Dirección:</strong> {tiendaSeleccionada.direccion || 'No especificada'}
                    </p>
                  </div>
                  
                  {loadingInventario ? (
                    <div className="loading-container">
                      <div className="loading-spinner"></div>
                      <p>Cargando inventario...</p>
                    </div>
                  ) : (
                    <>
                      {inventarioFiltrado.length > 0 ? (
                        <div className="tabla-inventario">
                          <table>
                            <thead>
                              <tr>
                                <th>ID</th>
                                <th>Producto</th>
                                <th>Categoría</th>
                                <th>Stock</th>
                                <th>Precio</th>
                                <th>Última Actualización</th>
                                <th>Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inventarioFiltrado.map(item => (
                                <tr key={item.id}>
                                  <td>{item.id.substring(0, 6)}...</td>
                                  <td>{item.nombre}</td>
                                  <td>{item.categoria || 'General'}</td>
                                  <td>
                                    <input 
                                      type="number" 
                                      min="0"
                                      value={item.stock || 0}
                                      onChange={(e) => {
                                        const newStock = e.target.value;
                                        // Actualizar localmente para UI
                                        setInventario(inventario.map(p => 
                                          p.id === item.id ? {...p, stock: parseInt(newStock) || 0} : p
                                        ));
                                      }}
                                      onBlur={(e) => handleActualizarStock(item.id, e.target.value)}
                                    />
                                  </td>
                                  <td>${item.precio || 0}</td>
                                  <td>{new Date(item.ultimaActualizacion).toLocaleString()}</td>
                                  <td>
                                    <button 
                                      className="accion-btn"
                                      onClick={() => handleActualizarStock(item.id, item.stock)}
                                    >
                                      <span className="material-icons">save</span>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="no-productos">
                          <p>No hay inventario registrado para esta tienda.</p>
                          <button 
                            className="add-producto-btn"
                            onClick={handleGenerarStock}
                            disabled={actualizandoStock}
                          >
                            <span className="material-icons">inventory</span>
                            Generar Stock Ficticio
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="seleccionar-tienda">
                  <div className="icono-seleccionar">
                    <span className="material-icons">store</span>
                  </div>
                  <h3>Selecciona una tienda para gestionar su inventario</h3>
                  <p>Podrás ver y editar el stock de productos en cada tienda</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InventarioPage; 