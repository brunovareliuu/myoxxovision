import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
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
import ImageAnalyzerPage from './pages/ImageAnalyzerPage';
import InventarioPage from './pages/InventarioPage';
import PlanogramasPage from './pages/TasksPage';
import OxxoAssistant from './pages/OxxoAssistant';
import OCRPage from './pages/OCRPage';
import StatisticsPage from './pages/StatisticsPage';
import AnalysisDetailsPage from './pages/AnalysisDetailsPage';
import ProtectedRoute from './components/ProtectedRoute';
import { verificarTareasAutomaticasSiNecesario } from './firebase';
import { initDebugUtils } from './utils/debugUtils';

function App() {
  // Verificar y generar tareas automáticas cuando la aplicación inicia
  useEffect(() => {
    // Inicializar utilidades de depuración
    if (process.env.NODE_ENV === 'development') {
      initDebugUtils();
    }
    
    const verificarTareas = async () => {
      try {
        console.log('Verificando tareas automáticas al iniciar...');
        const tareasGeneradas = await verificarTareasAutomaticasSiNecesario();
        
        if (tareasGeneradas > 0) {
          console.log(`Se generaron ${tareasGeneradas} tareas automáticas`);
        }
      } catch (err) {
        console.error('Error al verificar tareas automáticas:', err);
      }
    };
    
    // Ejecutar verificación
    verificarTareas();
    
    // Programar verificación periódica cada 15 segundos para pruebas
    const intervalo = setInterval(() => {
      verificarTareas();
    }, 15000); // 15 segundos en milisegundos
    
    // Limpiar intervalo cuando el componente se desmonte
    return () => clearInterval(intervalo);
  }, []);

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
        {/* Ruta para gestión de inventario */}
        <Route 
          path="/inventario" 
          element={
            <ProtectedRoute>
              <InventarioPage />
            </ProtectedRoute>
          } 
        />
        {/* Rutas para solicitudes de fotos */}
        <Route 
          path="/fotos-planogramas" 
          element={
            <ProtectedRoute>
              <BusquedaTienda redirectPath="/fotos-planogramas" />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/fotos-planogramas/:tiendaId" 
          element={
            <ProtectedRoute>
              <PlanogramasPage />
            </ProtectedRoute>
          } 
        />
        {/* Ruta para planogramas */}
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
        {/* Ruta para el analizador de imágenes */}
        <Route 
          path="/image-analyzer" 
          element={
            <ProtectedRoute>
              <ImageAnalyzerPage />
            </ProtectedRoute>
          } 
        />
        {/* Ruta para el asistente OXXO Vision */}
        <Route 
          path="/assistant" 
          element={
            <ProtectedRoute>
              <OxxoAssistant />
            </ProtectedRoute>
          } 
        />
        {/* Ruta para la detección OCR de planogramas */}
        <Route 
          path="/oxxo-vision" 
          element={
            <ProtectedRoute>
              <OCRPage />
            </ProtectedRoute>
          } 
        />
        {/* Ruta para OCR (detección desde solicitudes) */}
        <Route 
          path="/ocr" 
          element={
            <ProtectedRoute>
              <OCRPage />
            </ProtectedRoute>
          } 
        />
        {/* Ruta para las estadísticas de análisis */}
        <Route 
          path="/statistics" 
          element={
            <ProtectedRoute>
              <StatisticsPage />
            </ProtectedRoute>
          } 
        />
        {/* Ruta para ver detalles de un análisis específico */}
        <Route 
          path="/analysis/:analysisId" 
          element={
            <ProtectedRoute>
              <AnalysisDetailsPage />
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
