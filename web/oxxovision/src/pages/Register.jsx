import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../firebase';
import './Auth.css';
import oxxoImage from '../assets/oxxo1.png';
import logo from '../assets/logo.svg';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      setLoading(true);
      console.log("Iniciando proceso de registro para:", email);
      
      // Registrar al usuario con datos mínimos
      const userData = {
        nombre: name,
        email: email,
        rol: 'usuario',
        fechaRegistro: new Date()
      };
      
      console.log("Datos de registro:", { email, name });
      
      const user = await registerUser(email, password, userData);
      console.log("Registro exitoso, usuario creado:", user.uid);
      
      // Guardar datos en localStorage para persistencia
      localStorage.setItem('oxxoSessionToken', 'true');
      localStorage.setItem('oxxoUserId', user.uid);
      localStorage.setItem('oxxoUserRole', 'usuario');
      localStorage.setItem('oxxoUserName', name);
      localStorage.setItem('newUser', 'true');
      
      console.log("Datos guardados en localStorage, redirigiendo a dashboard");
      
      // Redirigir directamente al dashboard en lugar de al login
      navigate('/dashboard');
    } catch (err) {
      console.error('Error al registrar:', err);
      
      // Mensajes de error más detallados
      if (err.code === 'auth/email-already-in-use') {
        setError('El correo electrónico ya está en uso');
      } else if (err.code === 'auth/invalid-email') {
        setError('El correo electrónico no es válido');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña es demasiado débil');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Error de conexión. Verifica tu conexión a internet.');
      } else if (err.message && err.message.includes("permissions")) {
        setError('Error de permisos en Firestore. Por favor contacta al administrador.');
      } else {
        setError(`Error al registrar usuario: ${err.message || 'Error desconocido'}`);
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
          <h2>Registro</h2>
          {error && <p className="error-message">{error}</p>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Nombre Completo</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
                placeholder="Ingresa tu nombre"
              />
            </div>
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
                minLength={6}
                placeholder="Contraseña (mínimo 6 caracteres)"
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirmar Contraseña</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
                placeholder="Confirma tu contraseña"
              />
            </div>
            <button 
              type="submit" 
              className="auth-button"
              disabled={loading}
            >
              {loading ? 'Registrando...' : 'Registrarse'}
            </button>
          </form>
          <p className="auth-redirect">
            ¿Ya tienes una cuenta?<Link to="/login">Inicia sesión</Link>
          </p>
        </div>
      </div>
      <div className="auth-image-section">
        <img src={oxxoImage} alt="OXXO Vision" className="auth-image" />
      </div>
    </div>
  );
};

export default Register; 