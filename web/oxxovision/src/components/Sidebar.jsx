import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Sidebar.css';
import logo from '../assets/logo.svg';

const Sidebar = ({ userData }) => {
  const [collapsed, setCollapsed] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Get role from userData or localStorage as fallback
  const userRole = userData?.rol || localStorage.getItem('oxxoUserRole') || 'usuario';
  const userName = userData?.nombre || localStorage.getItem('oxxoUserName') || 'Usuario';
  const canManageStores = userRole === 'admin' || userRole === 'gerente';

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  // Definición de los elementos de navegación
  const menuItems = [
    {
      title: 'Dashboard',
      icon: 'dashboard',
      path: '/dashboard',
      visible: true
    },
    {
      title: 'Registrar Tienda',
      icon: 'store',
      path: '/registro-tienda',
      visible: canManageStores
    },
    {
      title: 'Buscar Tienda',
      icon: 'store_search',
      path: '/busqueda-tienda',
      visible: true
    },
    {
      title: 'Productos',
      icon: 'inventory_2',
      path: '/productos',
      visible: true
    },
    {
      title: 'Fotos Planogramas',
      icon: 'photo_camera',
      path: '/fotos-planogramas',
      visible: true
    },
    {
      title: 'Verificar Planogramas',
      icon: 'document_scanner',
      path: '/ocr',
      visible: true
    },
    {
      title: 'Asistente IA',
      icon: 'support_agent',
      path: '/assistant',
      visible: true
    }
  ];

  const handleNavigation = (path) => {
    navigate(path);
  };

  // Verificar si estamos en la ruta de fotos de planogramas
  const isActivePath = (path) => {
    if (path === '/fotos-planogramas' && location.pathname.startsWith('/fotos-planogramas')) {
      return true;
    }
    return location.pathname === path;
  };

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="brand">
          {!collapsed ? (
            <img src={logo} alt="OXXO Vision Logo" className="logo-full" />
          ) : (
            <img src={logo} alt="OXXO Vision Logo" className="logo-mini" />
          )}
        </div>
        <button className="toggle-button" onClick={toggleSidebar}>
          <span className="material-icons">
            {collapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>
      </div>
      
      <div className="user-profile">
        <div className="avatar">
          <span className="material-icons">account_circle</span>
        </div>
        {!collapsed && (
          <div className="user-info">
            <p className="user-name">{userName}</p>
            <p className="user-role">{userRole}</p>
          </div>
        )}
      </div>
      
      <div className="sidebar-menu">
        {menuItems
          .filter(item => item.visible)
          .map((item, index) => (
            <div 
              key={index}
              className={`menu-item ${isActivePath(item.path) ? 'active' : ''}`}
              onClick={() => handleNavigation(item.path)}
            >
              <span className="material-icons">{item.icon}</span>
              {!collapsed && <span className="menu-title">{item.title}</span>}
            </div>
          ))
        }
      </div>
      
      <div className="sidebar-footer">
        {!collapsed && <p className="app-version">v1.0.0</p>}
        <div className="footer-logo">
          {collapsed ? 'OV' : 'OXXOVision'}
        </div>
      </div>
    </div>
  );
};

export default Sidebar; 