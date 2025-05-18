import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { loginUser, getUserData, verificarTareasAutomaticasSiNecesario } from '../firebase';
import './Auth.css';
import oxxoImage from '../assets/oxxo1.png';
import logo from '../assets/logo.svg';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Verificar si hay una ruta a la que redirigir después del inicio de sesión
  const { from } = location.state || { from: { pathname: '/dashboard' } };
  
  useEffect(() => {
    console.log('Login: Redirección esperada después del login:', from.pathname);
    
    // Si hay un estado con la URL de OCR y datos de usuario, mostrar mensaje
    if (from.pathname === '/ocr' && from.state?.usuario) {
      console.log('Login: Detectada redirección desde OCR con datos de solicitud');
      setError('Por favor inicia sesión para continuar evaluando la solicitud');
    }
  }, [from]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      setLoading(true);
      const user = await loginUser(email, password);
      
      // Guardar sesión en localStorage
      localStorage.setItem('oxxoSessionToken', 'true');
      localStorage.setItem('oxxoUserId', user.uid);
      
      // Intentar obtener datos del usuario desde Firestore
      try {
        const userData = await getUserData(user.uid);
        if (userData) {
          // Guardar datos del usuario en localStorage para mejorar persistencia
          localStorage.setItem('oxxoUserRole', userData.rol || 'usuario');
          localStorage.setItem('oxxoUserName', userData.nombre || 'Usuario');
        }
      } catch (firestoreErr) {
        console.error('Error al obtener datos de usuario:', firestoreErr);
        // Continuar con el inicio de sesión aunque falle Firestore
      }
      
      // Verificar y generar tareas automáticas al iniciar sesión
      try {
        // Solo administradores y supervisores verifican tareas al iniciar sesión
        const userRole = localStorage.getItem('oxxoUserRole');
        if (userRole === 'admin' || userRole === 'supervisor') {
          console.log('Verificando tareas automáticas después del inicio de sesión...');
          verificarTareasAutomaticasSiNecesario().catch(err => {
            console.error('Error al verificar tareas automáticas:', err);
          });
        }
      } catch (verificationErr) {
        console.error('Error al verificar tareas automáticas:', verificationErr);
        // No interrumpir inicio de sesión si hay error
      }
      
      // Si estamos redirigiendo a OCR, mantener el estado de navegación
      if (from.pathname === '/ocr' && from.state) {
        // Actualizar el state para incluir datos del usuario actual
        const updatedState = {
          ...from.state,
          usuario: {
            ...from.state.usuario,
            id: user.uid,
            autenticado: true
          }
        };
        
        console.log('Login: Redirigiendo de vuelta a OCR con estado:', updatedState);
        navigate(from.pathname, { state: updatedState, replace: true });
      } else {
        // Login exitoso, redirigir a la página original o dashboard
        navigate(from.pathname || '/dashboard', { replace: true });
      }
    } catch (err) {
      console.error('Error al iniciar sesión:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Correo electrónico o contraseña incorrectos');
      } else if (err.code === 'auth/invalid-email') {
        setError('El correo electrónico no es válido');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Demasiados intentos fallidos. Intenta más tarde');
      } else {
        setError('Error al iniciar sesión. Por favor, intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form-section">
        <div className="auth-card">
          <div className="auth-brand">
            <img src={logo} style={{ width: '100px', height: '100px' }} alt="OXXO Vision" className="auth-image" />
          </div>
          <h2>Iniciar Sesión</h2>
          {error && <p className="error-message">{error}</p>}
          {from.pathname === '/ocr' && (
            <div className="info-message">
              <p>Inicia sesión para continuar evaluando la solicitud</p>
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Correo Electrónico</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="Ingresa tu correo electrónico"
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="Ingresa tu contraseña"
              />
            </div>
            <button 
              type="submit" 
              className="auth-button"
              disabled={loading}
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
          </form>
          <p className="auth-redirect">
            ¿No tienes una cuenta?<Link to="/register">Regístrate</Link>
          </p>
        </div>
      </div>
      <div className="auth-image-section">
        <img src={oxxoImage} alt="OXXO Vision" className="auth-image" />
      </div>
    </div>
  );
};

export default Login; 