import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import RegistroTienda from './pages/RegistroTienda';
import BusquedaTienda from './pages/BusquedaTienda';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/registro-tienda" 
          element={
            <ProtectedRoute>
              <RegistroTienda />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/busqueda-tienda" 
          element={
            <ProtectedRoute>
              <BusquedaTienda />
            </ProtectedRoute>
          } 
        />
        {/* Ruta para planogramas (pendiente de implementar) */}
        <Route 
          path="/planogramas" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        {/* Redirigir al login por defecto */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
