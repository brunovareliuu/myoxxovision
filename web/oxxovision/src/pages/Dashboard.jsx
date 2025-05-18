import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, logoutUser, getUserData, obtenerProductos } from '../firebase';
import { actualizarStockTiendas } from '../utils/updateStockUtils';
import Sidebar from '../components/Sidebar';
import MisTiendas from '../components/MisTiendas';
import './Dashboard.css';

const Dashboard = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [productos, setProductos] = useState([]);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [actualizandoStock, setActualizandoStock] = useState(false);
  const [mensajeStock, setMensajeStock] = useState(null);
  const navigate = useNavigate();

  // URL de la documentación
  const documentationUrl = 'https://terromn.github.io/oxxo-vision-docs/';

  // Simplificado - solo cargar datos una vez al iniciar
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setLoading(true);
        
        // Usar la información de Firebase directamente si está disponible
        const user = auth.currentUser;
        
        // Si no hay usuario autenticado, obtener del localStorage
        if (!user) {
          console.log('No hay usuario autenticado en Firebase, verificando localStorage');
          
          // Si tampoco hay sesión en localStorage, vamos al login
          const sessionToken = localStorage.getItem('oxxoSessionToken');
          if (!sessionToken) {
            console.log('No hay sesión en localStorage, redirigiendo a login');
            navigate('/login');
            return;
          }
          
          // Hay sesión en localStorage, continuamos con los datos en localStorage
          console.log('Usando datos de sesión del localStorage');
          
          // Intentar cargar los datos del usuario de localStorage
          const userRole = localStorage.getItem('oxxoUserRole') || 'usuario';
          const userName = localStorage.getItem('oxxoUserName') || 'Usuario';
          const userId = localStorage.getItem('oxxoUserId');
          
          if (userId) {
            // Configurar datos básicos del localStorage
            setUserData({
              uid: userId,
              nombre: userName,
              rol: userRole
            });
          }
        } else {
          // Cargar datos del usuario desde Firestore si hay usuario autenticado
          const userDataFromDB = await getUserData(user.uid);
          if (userDataFromDB) {
            setUserData(userDataFromDB);
            
            // Actualizar localStorage para mantener la sesión
            localStorage.setItem('oxxoSessionToken', 'true');
            localStorage.setItem('oxxoUserId', user.uid);
            localStorage.setItem('oxxoUserRole', userDataFromDB.rol || 'usuario');
            localStorage.setItem('oxxoUserName', userDataFromDB.nombre || 'Usuario');
          } else {
            // Si no hay datos, usar los datos mínimos del usuario de Firebase
            setUserData({
              uid: user.uid,
              email: user.email,
              nombre: user.displayName || 'Usuario',
              rol: 'usuario'
            });
          }
        }
      } catch (err) {
        console.error('Error al cargar datos del usuario:', err);
        setError('Error al cargar los datos del usuario');
      } finally {
        setLoading(false);
      }
    };
    
    loadUserData();
  }, [navigate]);

  // Cargar productos de Firestore
  useEffect(() => {
    const cargarProductos = async () => {
      try {
        setLoadingProductos(true);
        const productosData = await obtenerProductos();
        // Limitar a mostrar solo los primeros 8 productos
        setProductos(productosData.slice(0, 8));
      } catch (err) {
        console.error('Error al cargar productos:', err);
      } finally {
        setLoadingProductos(false);
      }
    };

    cargarProductos();
  }, []);

  // Función para actualizar el stock de productos en tiendas
  const handleActualizarStock = async () => {
    try {
      setActualizandoStock(true);
      setMensajeStock(null);
      
      console.log('Iniciando actualización de stock en tiendas usando la nueva estructura...');
      const resultado = await actualizarStockTiendas();
      
      if (resultado.success) {
        setMensajeStock({
          tipo: 'exito',
          texto: `${resultado.message}: ${resultado.tiendas.length} tiendas actualizadas con estructura mejorada`
        });
      } else {
        setMensajeStock({
          tipo: 'error',
          texto: resultado.message
        });
      }
    } catch (error) {
      console.error('Error al actualizar stock:', error);
      setMensajeStock({
        tipo: 'error',
        texto: `Error al actualizar stock: ${error.message}`
      });
    } finally {
      setActualizandoStock(false);
      // Ocultar el mensaje después de 5 segundos
      setTimeout(() => {
        setMensajeStock(null);
      }, 5000);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const navigateToRegistroTienda = () => {
    navigate('/registro-tienda');
  };

  const navigateToBusquedaTienda = () => {
    navigate('/busqueda-tienda');
  };

  const navigateToPlanogramas = () => {
    // Pendiente implementar página de planogramas
    console.log('Navegar a planogramas');
    // navigate('/planogramas');
  };

  const navigateToProductos = () => {
    navigate('/productos');
  };

  const navigateToImageAnalyzer = () => {
    navigate('/image-analyzer');
  };

  const navigateToInventario = () => {
    navigate('/inventario');
  };

  const navigateToTareas = () => {
    navigate('/tareas');
  };

  const navigateToAssistant = () => {
    navigate('/assistant');
  };

  const navigateToOCR = () => {
    navigate('/oxxo-vision');
  };

  // Función para abrir la documentación en una nueva pestaña
  const openDocumentation = () => {
    window.open(documentationUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button onClick={handleLogout}>Volver a Iniciar Sesión</button>
      </div>
    );
  }

  // Obtener nombre y rol del usuario
  const userName = userData?.nombre || localStorage.getItem('oxxoUserName') || 'Usuario';
  const userRole = userData?.rol || localStorage.getItem('oxxoUserRole') || 'usuario';
  
  // Verificar si el usuario puede administrar tiendas (admin o gerente)
  const canManageStores = userRole === 'admin' || userRole === 'gerente';

  return (
    <div className="layout-container">
      <Sidebar userData={userData} />
      
            <div className="main-content">        <header className="content-header">          <h1>Panel de Control</h1>          <div className="header-actions">            <button className="docs-button" onClick={openDocumentation}>              <span className="material-icons">menu_book</span>              Documentación            </button>            <span className="user-header-info">              {userName} ({userRole})            </span>            <button className="logout-button" onClick={handleLogout}>              <span className="material-icons">logout</span>              Cerrar Sesión            </button>          </div>        </header>
        
        <div className="dashboard-content">
          <div className="welcome-section">
            <h2>Bienvenido/a, {userName}</h2>
            <p>Sistema de Gestión de Planogramas para tiendas OXXO.</p>
            <div className="documentation-banner">
              <span className="material-icons">menu_book</span>
              <div>
                <h4>¿Necesitas ayuda?</h4>
                <p>Consulta nuestra documentación completa</p>
              </div>
              <button className="docs-button-primary" onClick={openDocumentation}>
                Ver Documentación
              </button>
              
            </div>
            {canManageStores && (
              <div className="main-action-buttons">
                <button className="main-action-button" onClick={navigateToRegistroTienda}>
                  <span className="material-icons">add_business</span>
                  Registrar Nueva Tienda
                </button>
                <button className="main-action-button search-button" onClick={navigateToBusquedaTienda}>
                  <span className="material-icons">search</span>
                  Buscar Tienda
                </button>
                <button className="main-action-button inventory-button" onClick={navigateToInventario}>
                  <span className="material-icons">inventory</span>
                  Gestionar Inventario
                </button>
                <button className="main-action-button ocr-button" onClick={navigateToOCR}>
                  <span className="material-icons">document_scanner</span>
                  Verificar Planogramas (OCR)
                </button>
              </div>
            )}
          </div>
          
          {/* Sección de Mis Tiendas */}
          <MisTiendas />
          
          {/* Sección de Productos Globales */}
          <div className="productos-global-section">
            <div className="section-header">
              <h3>Productos Globales</h3>
              <button className="ver-todos-btn" onClick={navigateToProductos}>
                Ver todos <span className="material-icons">arrow_forward</span>
              </button>
            </div>
            
            {loadingProductos ? (
              <div className="productos-loading">Cargando productos...</div>
            ) : (
              <div className="productos-grid">
                {productos.length > 0 ? (
                  productos.map(producto => (
                    <div 
                      key={producto.id} 
                      className="producto-card"
                      onClick={() => navigate(`/productos/${producto.id}`)}
                    >
                      <div 
                        className="producto-color" 
                        style={{ backgroundColor: producto.color || '#ccc' }}
                      ></div>
                      <div className="producto-info">
                        <h4>{producto.nombre || 'Producto sin nombre'}</h4>
                        {producto.barcode && <p className="producto-barcode">{producto.barcode}</p>}
                        {producto.categoria && <p className="producto-categoria">{producto.categoria}</p>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-productos">
                    <p>No hay productos registrados.</p>
                    <button className="add-producto-btn" onClick={navigateToProductos}>
                      <span className="material-icons">add</span> Agregar Producto
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="quick-actions">
            <h3>Acciones Rápidas</h3>
            <div className="actions-grid">
              {canManageStores && (
                <div className="action-card highlight" onClick={navigateToRegistroTienda}>
                  <span className="material-icons">store</span>
                  <h4>Registrar Tienda</h4>
                  <p>Dar de alta una nueva tienda OXXO en el sistema</p>
                </div>
              )}
              <div className="action-card highlight" onClick={navigateToBusquedaTienda}>
                <span className="material-icons">store_search</span>
                <h4>Buscar Tienda</h4>
                <p>Buscar y consultar información de tiendas por código</p>
              </div>
              <div className="action-card highlight" onClick={navigateToPlanogramas}>
                <span className="material-icons">dashboard_customize</span>
                <h4>Planogramas</h4>
                <p>Gestionar planogramas de tiendas</p>
              </div>
              <div className="action-card highlight" onClick={navigateToProductos}>
                <span className="material-icons">inventory_2</span>
                <h4>Gestionar Productos</h4>
                <p>Administrar catálogo de productos</p>
              </div>
              <div className="action-card highlight" onClick={navigateToInventario}>
                <span className="material-icons">inventory</span>
                <h4>Gestionar Inventario</h4>
                <p>Administrar stock de productos en tiendas</p>
              </div>
              <div className="action-card highlight" onClick={navigateToTareas}>
                <span className="material-icons">assignment</span>
                <h4>Gestionar Tareas</h4>
                <p>Administrar tareas y actividades de las tiendas</p>
              </div>
              <div className="action-card highlight ocr-card" onClick={navigateToOCR}>
                <span className="material-icons">document_scanner</span>
                <h4>Verificar Planogramas (OCR)</h4>
                <p>Analizar imágenes de estantes y comparar con planogramas</p>
              </div>
              <div className="action-card ai-assistant" onClick={navigateToAssistant}>
                <span className="material-icons">support_agent</span>
                <h4>Asistente IA</h4>
                <p>Consulta información sobre planogramas con inteligencia artificial</p>
              </div>
              <div className="action-card documentation-card" onClick={openDocumentation}>
                <span className="material-icons">menu_book</span>
                <h4>Documentación</h4>
                <p>Consulta la documentación completa del sistema Oxxo Vision</p>
              </div>
            </div>
          </div>
          
          {userRole === 'admin' && (
            <div className="admin-section">
              <h3>Administración del Sistema</h3>
              <div className="admin-cards">
                <div className="admin-card">
                  <span className="material-icons">admin_panel_settings</span>
                  <h4>Configuración</h4>
                  <p>Gestionar configuración del sistema</p>
                </div>
                <div className="admin-card">
                  <span className="material-icons">security</span>
                  <h4>Permisos</h4>
                  <p>Administrar roles y permisos</p>
                </div>
                <div 
                  className={`admin-card ${actualizandoStock ? 'disabled' : ''}`}
                  onClick={actualizandoStock ? null : handleActualizarStock}
                >
                  <span className="material-icons">inventory</span>
                  <h4>Actualizar Stock</h4>
                  <p>Generar stock ficticio para todos los productos en tiendas</p>
                  {actualizandoStock && <div className="mini-spinner"></div>}
                </div>
              </div>
              
              {mensajeStock && (
                <div className={`mensaje-stock ${mensajeStock.tipo}`}>
                  <span className="material-icons">
                    {mensajeStock.tipo === 'exito' ? 'check_circle' : 'error'}
                  </span>
                  {mensajeStock.texto}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Floating action button for OCR */}
        <div className="floating-action-button ocr-fab" onClick={navigateToOCR}>
          <span className="material-icons">document_scanner</span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 