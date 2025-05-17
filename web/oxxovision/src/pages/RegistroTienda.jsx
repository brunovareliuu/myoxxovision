import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, registrarTienda, generarCodigoTienda, getUserData } from '../firebase';
import Sidebar from '../components/Sidebar';
import './RegistroTienda.css';

// Lista de estados de México
const ESTADOS_MEXICO = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 
  'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango',
  'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco',
  'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca',
  'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa',
  'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz',
  'Yucatán', 'Zacatecas'
];

const RegistroTienda = () => {
  const [nombre, setNombre] = useState('');
  const [estado, setEstado] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [telefono, setTelefono] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [exito, setExito] = useState(false);
  const [codigoGenerado, setCodigoGenerado] = useState('');
  const [userData, setUserData] = useState(null);
  const [debug, setDebug] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const comprobarAuth = async () => {
      try {
        setLoading(true);
        setDebug('Comprobando autenticación...');
        
        // Check local storage for session and user data first
        const sessionToken = localStorage.getItem('oxxoSessionToken');
        const userId = localStorage.getItem('oxxoUserId');
        const userRole = localStorage.getItem('oxxoUserRole');
        
        // Verificar si el usuario está autenticado (Firebase o localStorage)
        const user = auth.currentUser;
        
        if (!user && !sessionToken) {
          setDebug('No hay sesión activa, redirigiendo a login');
          navigate('/login');
          return;
        }
        
        // Si tenemos Firebase auth, usamos eso. Si no, usamos localStorage.
        const uid = user?.uid || userId;
        
        if (uid) {
          setDebug(`Usuario con ID: ${uid}`);
          
          // Intentar obtener datos desde Firestore
          try {
            const data = await getUserData(uid);
            if (data) {
              setUserData(data);
              setDebug(`Rol de usuario: ${data.rol || 'No definido'}`);
              
              // Si no es admin o gerente, redirigir
              if (data.rol !== 'admin' && data.rol !== 'gerente') {
                setDebug('Usuario sin permisos, redirigiendo al dashboard');
                navigate('/dashboard');
                return;
              }
            } else {
              // Si no hay datos en Firestore pero hay un rol en localStorage
              if (userRole && (userRole === 'admin' || userRole === 'gerente')) {
                setDebug(`Usando rol de localStorage: ${userRole}`);
                setUserData({ rol: userRole });
              } else {
                setDebug('No se encontraron datos de usuario y no hay rol en localStorage');
                navigate('/dashboard');
                return;
              }
            }
          } catch (error) {
            // Si hay error al obtener datos pero tenemos rol en localStorage
            if (userRole && (userRole === 'admin' || userRole === 'gerente')) {
              setDebug(`Error al obtener datos, usando rol de localStorage: ${userRole}`);
              setUserData({ rol: userRole });
            } else {
              throw error;
            }
          }
        } else {
          setDebug('No se pudo determinar el ID de usuario');
          navigate('/login');
          return;
        }
        
        // Generar un código de muestra
        const codigo = generarCodigoTienda();
        setCodigoGenerado(codigo);
        setDebug(`Código de tienda generado: ${codigo}`);
        
      } catch (error) {
        console.error('Error al comprobar autenticación:', error);
        setDebug(`Error de autenticación: ${error.message}`);
        setError(`Error de autenticación: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    comprobarAuth();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setExito(false);
    setDebug('Iniciando registro de tienda...');
    
    if (!nombre || !estado || !ciudad || !direccion) {
      setError('Por favor, completa todos los campos obligatorios.');
      setDebug('Faltan campos obligatorios');
      return;
    }
    
    try {
      setLoading(true);
      
      // Verificar si el usuario sigue autenticado
      const user = auth.currentUser;
      const sessionToken = localStorage.getItem('oxxoSessionToken');
      
      if (!user && !sessionToken) {
        setError('Tu sesión ha expirado. Por favor, vuelve a iniciar sesión.');
        setDebug('Sesión expirada');
        navigate('/login');
        return;
      }
      
      // Si tenemos al usuario en Firebase
      if (user) {
        setDebug(`Usuario actual: ${user.email}, UID: ${user.uid}`);
      } else {
        setDebug('Usando sesión de localStorage');
      }
      
      // Datos de la tienda a registrar
      const datosTienda = {
        nombre,
        estado,
        ciudad,
        direccion,
        codigoPostal,
        telefono,
        activo: true
      };
      
      setDebug(`Datos de tienda a registrar: ${JSON.stringify(datosTienda)}`);
      
      // Registrar la tienda
      setDebug('Llamando a registrarTienda()...');
      const tiendaRegistrada = await registrarTienda(datosTienda);
      
      setDebug(`Tienda registrada con éxito: ${JSON.stringify(tiendaRegistrada)}`);
      
      // Mostrar el código generado
      setCodigoGenerado(tiendaRegistrada.codigoTienda);
      setExito(true);
      
      // Limpiar el formulario después de registrar
      setNombre('');
      setEstado('');
      setCiudad('');
      setDireccion('');
      setCodigoPostal('');
      setTelefono('');
      
      setDebug(`Tienda registrada correctamente: ${tiendaRegistrada.nombre} (${tiendaRegistrada.codigoTienda})`);
      
      // Desplazarse al principio para ver el mensaje de éxito
      window.scrollTo(0, 0);
      
    } catch (error) {
      console.error('Error al registrar tienda:', error);
      setError(`Error al registrar tienda: ${error.message}`);
      setDebug(`Error en registro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Agregar shortcut de teclado para regresar al dashboard
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Si presiona Escape, regresar al dashboard
      if (e.key === 'Escape') {
        navigate('/dashboard');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigate]);

  if (loading && !userData) {
    return (
      <div className="loading-container">
        <p>Cargando...</p>
        <p className="debug-info">{debug}</p>
      </div>
    );
  }

  return (
    <div className="layout-container">
      <Sidebar userData={userData} />
      
      <div className="main-content">
        <header className="content-header">
          <h1>Registro de Tienda OXXO</h1>
          <div className="header-actions">
            <button 
              className="back-button" 
              onClick={() => navigate('/dashboard')}
            >
              <span className="material-icons">arrow_back</span>
              Volver al Dashboard
            </button>
          </div>
        </header>
        
        <div className="registro-tienda-content">
          <div className="form-container">
            <div className="codigo-tienda-preview">
              <h3>Código de Tienda</h3>
              <div className="codigo-display">
                {codigoGenerado}
              </div>
              <p className="codigo-info">
                Se generará automáticamente un código único para cada tienda registrada.
              </p>
              <div className="user-info">
                <p>Usuario: {userData?.email || localStorage.getItem('oxxoUserId') || 'Desconocido'}</p>
                <p>Rol: {userData?.rol || localStorage.getItem('oxxoUserRole') || 'Usuario'}</p>
              </div>
            </div>
            
            <div className="registro-tienda-form-container">
              {exito && (
                <div className="success-message">
                  <p>¡Tienda registrada exitosamente!</p>
                  <p>El código de la tienda es: <strong>{codigoGenerado}</strong></p>
                  <p className="store-assignment">Esta tienda ha sido asignada a tu cuenta y aparecerá en tu lista de "Mis Tiendas" en el panel principal.</p>
                </div>
              )}
              
              {error && <p className="error-message">{error}</p>}
              
              <form onSubmit={handleSubmit} className="registro-tienda-form">
                <div className="form-group">
                  <label htmlFor="nombre">Nombre de la Tienda *</label>
                  <input
                    type="text"
                    id="nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="Ej: OXXO Centro"
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="estado">Estado *</label>
                    <select
                      id="estado"
                      value={estado}
                      onChange={(e) => setEstado(e.target.value)}
                      required
                      disabled={loading}
                    >
                      <option value="">Selecciona un estado</option>
                      {ESTADOS_MEXICO.map((estado) => (
                        <option key={estado} value={estado}>
                          {estado}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="ciudad">Ciudad *</label>
                    <input
                      type="text"
                      id="ciudad"
                      value={ciudad}
                      onChange={(e) => setCiudad(e.target.value)}
                      required
                      disabled={loading}
                      placeholder="Ej: Monterrey"
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="direccion">Dirección *</label>
                  <input
                    type="text"
                    id="direccion"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="Ej: Av. Principal #123, Col. Centro"
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="codigoPostal">Código Postal</label>
                    <input
                      type="text"
                      id="codigoPostal"
                      value={codigoPostal}
                      onChange={(e) => setCodigoPostal(e.target.value)}
                      disabled={loading}
                      placeholder="Ej: 64000"
                      maxLength="5"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="telefono">Teléfono</label>
                    <input
                      type="tel"
                      id="telefono"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      disabled={loading}
                      placeholder="Ej: 8181234567"
                    />
                  </div>
                </div>
                
                <div className="form-actions">
                  <button
                    type="submit"
                    className="submit-button"
                    disabled={loading}
                  >
                    {loading ? 'Registrando...' : 'Registrar Tienda'}
                  </button>
                </div>
              </form>
              
              <div className="debug-panel">
                <p className="debug-info">{debug}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistroTienda; 