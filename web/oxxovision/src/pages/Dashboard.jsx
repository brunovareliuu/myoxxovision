import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, logoutUser, getUserData } from '../firebase';
import './Dashboard.css';

const Dashboard = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          // Si no hay usuario autenticado, redirigir al login
          navigate('/login');
          return;
        }
        
        // Obtener datos adicionales del usuario desde Firestore
        const data = await getUserData(user.uid);
        setUserData(data);
      } catch (error) {
        console.error('Error al obtener datos del usuario:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>OxxoVision Dashboard</h1>
        <div className="user-info">
          {userData && (
            <span className="user-name">Hola, {userData.nombre}</span>
          )}
          <button className="logout-button" onClick={handleLogout}>
            Cerrar Sesión
          </button>
        </div>
      </header>
      <main className="dashboard-content">
        <h2>Bienvenido/a al sistema</h2>
        <p>Selecciona una opción del menú para comenzar.</p>
        
        <div className="dashboard-cards">
          <div className="dashboard-card">
            <h3>Ventas</h3>
            <p>Consulta y analiza tus ventas</p>
          </div>
          <div className="dashboard-card">
            <h3>Inventario</h3>
            <p>Gestiona tu inventario</p>
          </div>
          <div className="dashboard-card">
            <h3>Empleados</h3>
            <p>Administra a tu personal</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard; 