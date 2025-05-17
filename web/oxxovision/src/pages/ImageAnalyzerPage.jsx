import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, logoutUser, getUserData } from '../firebase';
import Sidebar from '../components/Sidebar';
import ImageAnalyzer from '../components/ImageAnalyzer';
import './Dashboard.css'; // Reusing Dashboard styles

const ImageAnalyzerPage = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setLoading(true);
        
        // Use Firebase Auth directly if available
        const user = auth.currentUser;
        
        // If no authenticated user, check localStorage
        if (!user) {
          console.log('No authenticated user in Firebase, checking localStorage');
          
          // If no session in localStorage, redirect to login
          const sessionToken = localStorage.getItem('oxxoSessionToken');
          if (!sessionToken) {
            console.log('No session in localStorage, redirecting to login');
            navigate('/login');
            return;
          }
          
          // Use session data from localStorage
          console.log('Using session data from localStorage');
          
          // Try to load user data from localStorage
          const userRole = localStorage.getItem('oxxoUserRole') || 'usuario';
          const userName = localStorage.getItem('oxxoUserName') || 'Usuario';
          const userId = localStorage.getItem('oxxoUserId');
          
          if (userId) {
            // Set basic data from localStorage
            setUserData({
              uid: userId,
              nombre: userName,
              rol: userRole
            });
          }
        } else {
          // Load user data from Firestore if authenticated
          const userDataFromDB = await getUserData(user.uid);
          if (userDataFromDB) {
            setUserData(userDataFromDB);
            
            // Update localStorage to maintain session
            localStorage.setItem('oxxoSessionToken', 'true');
            localStorage.setItem('oxxoUserId', user.uid);
            localStorage.setItem('oxxoUserRole', userDataFromDB.rol || 'usuario');
            localStorage.setItem('oxxoUserName', userDataFromDB.nombre || 'Usuario');
          } else {
            // If no data, use minimal data from Firebase user
            setUserData({
              uid: user.uid,
              email: user.email,
              nombre: user.displayName || 'Usuario',
              rol: 'usuario'
            });
          }
        }
      } catch (err) {
        console.error('Error loading user data:', err);
        setError('Error loading user data');
      } finally {
        setLoading(false);
      }
    };
    
    loadUserData();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
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

  // Get user name and role
  const userName = userData?.nombre || localStorage.getItem('oxxoUserName') || 'Usuario';
  const userRole = userData?.rol || localStorage.getItem('oxxoUserRole') || 'usuario';

  return (
    <div className="layout-container">
      <Sidebar userData={userData} />
      
      <div className="main-content">
        <header className="content-header">
          <h1>Analizador de Imágenes</h1>
          <div className="header-actions">
            <span className="user-header-info">
              {userName} ({userRole})
            </span>
            <button className="logout-button" onClick={handleLogout}>
              <span className="material-icons">logout</span>
              Cerrar Sesión
            </button>
          </div>
        </header>
        
        <div className="dashboard-content">
          <ImageAnalyzer />
        </div>
      </div>
    </div>
  );
};

export default ImageAnalyzerPage; 