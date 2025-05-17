import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import RegistroTienda from './pages/RegistroTienda';
import BusquedaTienda from './pages/BusquedaTienda';
import TiendaInfo from './pages/TiendaInfo';
import CrearPlanograma from './pages/CrearPlanograma';
import ProductosPage from './pages/ProductosPage';
import EditarProducto from './pages/EditarProducto';
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
        {/* Rutas para productos */}
        <Route 
          path="/productos" 
          element={
            <ProtectedRoute>
              <ProductosPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/productos/nuevo" 
          element={
            <ProtectedRoute>
              <EditarProducto />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/productos/editar/:productoId" 
          element={
            <ProtectedRoute>
              <EditarProducto />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/productos/:productoId" 
          element={
            <ProtectedRoute>
              <ProductosPage />
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
        {/* Ruta para crear planogramas */}
        <Route 
          path="/planogramas/crear/:tiendaId" 
          element={
            <ProtectedRoute>
              <CrearPlanograma />
            </ProtectedRoute>
          } 
        />
        {/* Ruta para ver detalles de tienda */}
        <Route 
          path="/tienda/:tiendaId" 
          element={
            <ProtectedRoute>
              <TiendaInfo />
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
