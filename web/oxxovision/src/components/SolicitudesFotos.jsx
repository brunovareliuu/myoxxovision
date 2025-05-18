import React, { useState, useEffect, useRef } from 'react';
import './SolicitudesFotos.css';
import { getFirestore, collection, addDoc, updateDoc, doc, getDoc, query, where, getDocs, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useNavigate } from 'react-router-dom';

// URL base64 para imagen de fallback
const FALLBACK_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAACWCAYAAAA8AXHiAAADmElEQVR4Xu3dsW4UQRAG4JnV+RL0dDQ8LW9ATUtFScsTUF6HgpegoKNBVKGjo2JpJEtGshFaZWfndvbLFbG83rn5b/6aWe/tHR4O/kFAQODw8N7/QX9/+PDLZ28vLi72d3d3n5yfnz86OTm5c3R09MDHhMD19fXVzc3Nr/Pz8x9nZ2ffLy8vf798+fLvXcR7FmSWlb3SB44ABa7LC+9ZrxUpXA2umVmvI9bQIbzXbkXKVlWoqrEKW2KrmqqxJbZQVON3VmLrVnY9U2x1s0Kwu1Jh68QqHE5n2aoa/9b23Rt9lZJvTAkMK3JzCjcfhZNXpC55ZQuV2PoNWS9b1+fvWbYuLy8/v3v37seKrVFKsX1ZsVXb0FWsJrTqkM1i6/T09P3r16/fvHr16nuxNcbT+OZqM9lCZZStN2/evH379u1HZYX/m9WfPWuErfEW5V1ybr0lVoAK1/7e3t4wfQjvMtKjh7TrllgMnpkZseYLJrFyLBErx0KsHAuxciwmdWKFWIgVYiFWiIVYIRZpFWLlWIiVYyFWjoVYORZi5VhM6pS4Z8VWjoVYORZi5ViIlWMhVo6FWDkWk7rG3Dt5I+/aYivHQqwcC7FyLMTKsRArx0KsHIt5V/JG3rXFVo6FWDkWYuVYiJVjMfEad0vebcuZ8WQrx0KsHAuxcizEyrEQK8dCrByLSd3m3cg7eaLSNcRWjoVYORZi5ViIlWMhVo6FWDkWk7qTbdyNvJO3KF1DbOVYiJVjIVaOhVg5FmLlWIiVYzGpa9wtebctZ8aTrRwLsXIsxMqxECvHQqwcC7FyLCZ1m3cj7+SJmqIqXENs5ViIlWMhVo6FWDkWYuVYiJVjIVaORb9r5I28xbAotg60mBeZzOfT+jVmgGnXKraKIi2q0mxViLWBUFGr6mBThDV9UleMEBvEGn8NmPGLQLE1WMXWrL9kLpjQtcuXcmRTsBpYU8dZiWW1qqaqxk3Nl49iK8cWimpkZYjvWf/hXz3VntWGK7HKZ2OIqxCrgLXCVUkWbw3/qCtcje0rXIPPDN8TW8P31nh3lv8AzStKV/A0+8QAAAAASUVORK5CYII=';

// Función simple para formatear fecha
const formatearFecha = (fechaISOString) => {
  try {
    if (!fechaISOString) return 'Fecha desconocida';
    
    // Si es un timestamp de Firestore, convertirlo a fecha
    if (fechaISOString.toDate && typeof fechaISOString.toDate === 'function') {
      fechaISOString = fechaISOString.toDate().toISOString();
    }
    
    const fecha = new Date(fechaISOString);
    return fecha.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric'
    });
  } catch (error) {
    return 'Error en fecha';
  }
};

// Función para registrar cuando se recibe una foto
const logFotoRecibida = (solicitud) => {
  console.log(`📸 Nueva foto recibida - ${new Date().toLocaleString()}`);
  console.log(`  • Solicitud: ${solicitud.titulo}`);
  console.log(`  • Planograma: ${solicitud.planogramaNombre}`);
  console.log(`  • Completada por: ${solicitud.completadaPor}`);
  console.log(`  • URL: ${solicitud.fotoUrl.substring(0, 50)}...`);
};

const SolicitudesFotos = ({ tiendaId, esAdmin, usuarioActual }) => {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nuevaSolicitud, setNuevaSolicitud] = useState({
    titulo: '',
    planogramaNombre: '',
    planogramaId: '',
    fechaLimite: '',
    descripcion: ''
  });
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [planogramas, setPlanogramas] = useState([]);
  const [cargandoPlanogramas, setCargandoPlanogramas] = useState(false);
  const [mostrarImagenCompleta, setMostrarImagenCompleta] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [solicitudActiva, setSolicitudActiva] = useState(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // Cargar solicitudes y planogramas al montar el componente
  useEffect(() => {
    const unsubscribe = configurarSolicitudesListener();
    cargarPlanogramas();
    
    // Limpieza al desmontar
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [tiendaId, esAdmin]);

  // Diagnóstico de imágenes para depuración
  useEffect(() => {
    if (solicitudes.length > 0) {
      const solicitudesConFotos = solicitudes.filter(s => s.fotoUrl);
      if (solicitudesConFotos.length > 0) {
        console.log(`🖼️ Diagnóstico: ${solicitudesConFotos.length} solicitudes con fotos detectadas`);
        
        // Tipos de URLs que hemos encontrado
        const urlsHttp = solicitudesConFotos.filter(s => s.fotoUrl.startsWith('http')).length;
        const urlsFirebase = solicitudesConFotos.filter(s => s.fotoUrl.includes('firebasestorage')).length;
        const urlsRelativas = solicitudesConFotos.filter(s => !s.fotoUrl.startsWith('http')).length;
        
        console.log(`- URLs HTTP(S): ${urlsHttp}`);
        console.log(`- URLs Firebase Storage: ${urlsFirebase}`);
        console.log(`- Rutas relativas: ${urlsRelativas}`);
        
        // Mostrar ejemplos de cada tipo para diagnóstico
        if (urlsHttp > 0) {
          const ejemplo = solicitudesConFotos.find(s => s.fotoUrl.startsWith('http'));
          console.log(`- Ejemplo URL HTTP: ${ejemplo.fotoUrl.substring(0, 100)}...`);
        }
        
        if (urlsRelativas > 0) {
          const ejemplo = solicitudesConFotos.find(s => !s.fotoUrl.startsWith('http'));
          console.log(`- Ejemplo ruta relativa: ${ejemplo.fotoUrl}`);
        }
        
        // Intentar corregir las URLs relativas en segundo plano
        if (urlsRelativas > 0) {
          console.log(`🔄 Intentando normalizar ${urlsRelativas} URLs relativas...`);
          
          // Solo intenta normalizar las primeras 5 para no sobrecargar
          const solicitudesParaNormalizar = solicitudesConFotos
            .filter(s => !s.fotoUrl.startsWith('http'))
            .slice(0, 5);
          
          solicitudesParaNormalizar.forEach(async (solicitud) => {
            try {
              const normalizedUrl = await normalizeImageUrl(solicitud.fotoUrl);
              if (normalizedUrl) {
                console.log(`✅ URL normalizada para solicitud ${solicitud.id}: ${normalizedUrl.substring(0, 50)}...`);
                
                // Actualizar en Firestore también para corregir permanentemente
                const db = getFirestore();
                const solicitudRef = doc(db, `tiendas/${tiendaId}/solicitudes/${solicitud.id}`);
                await updateDoc(solicitudRef, { 
                  fotoUrl: normalizedUrl,
                  ultimaActualizacion: serverTimestamp()
                });
                
                // Actualizar estado local
                setSolicitudes(prev => 
                  prev.map(s => s.id === solicitud.id ? 
                    {...s, fotoUrl: normalizedUrl, _normalized: true} : s
                  )
                );
              }
            } catch (error) {
              console.error(`❌ Error al normalizar URL para solicitud ${solicitud.id}:`, error);
            }
          });
        }
      }
    }
  }, [solicitudes, tiendaId]);

  // Función para validar URL de imagen
  const isValidImageUrl = (url) => {
    if (!url) return false;
    
    // Comprobar si la URL ya es una URL completa
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Para URLs de Firebase Storage, verificar que contenga los componentes necesarios
      if (url.includes('firebasestorage.googleapis.com')) {
        // Validar que la URL tenga los componentes esenciales de Firebase Storage
        const hasToken = url.includes('token=') || url.includes('alt=media');
        const hasPath = url.includes('/o/');
        
        if (!hasPath) {
          console.warn('⚠️ URL de Firebase Storage sin ruta de objeto válida');
        }
        
        if (!hasToken) {
          console.warn('⚠️ URL de Firebase Storage sin token de acceso o parámetro alt=media');
          // Podría ser un problema, pero aún intentaremos usarla
        }
      }
      
      // Verificar extensión de archivo para asegurar que es una imagen
      const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
      const hasImageExtension = extensions.some(ext => 
        url.toLowerCase().includes(ext) ||
        // También verificar en el nombre del objeto para URLs de Firebase Storage
        (url.includes('/o/') && decodeURIComponent(url.split('/o/')[1].split('?')[0]).toLowerCase().includes(ext))
      );
      
      if (!hasImageExtension) {
        console.warn('⚠️ URL no tiene extensión de imagen reconocible, pero se intentará usar');
        // No rechazamos la URL solo por esto, ya que algunas URLs no incluyen la extensión en la URL
      }
      
      return true;
    }
    
    // Si solo es una ruta relativa de Storage, no es válida en este contexto
    return false;
  };

  // Función para normalizar URL de imagen (para rutas incompletas de Firebase Storage)
  const normalizeImageUrl = async (url) => {
    if (!url) return null;
    
    console.log(`🔍 Normalizando URL: ${url}`);
    
    // Si ya es una URL completa, retornarla directamente
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Verificar si es una URL de Firebase Storage y agregar timestamp para evitar caché
      if (url.includes('firebasestorage.googleapis.com')) {
        // Añadir parámetro para evitar caché si no existe
        const separator = url.includes('?') ? '&' : '?';
        const refreshedUrl = `${url}${separator}_t=${Date.now()}`;
        console.log('✅ URL de Firebase Storage actualizada con timestamp anti-caché');
        return refreshedUrl;
      }
      
      console.log('✅ La URL ya es completa, no necesita normalización');
      return url;
    }
    
    try {
      // Normalizar la ruta de storage
      let storagePath = url;
      
      // Eliminar prefijo gs:// si existe
      if (storagePath.startsWith('gs://')) {
        const bucket = storagePath.split('/')[2];
        storagePath = storagePath.replace(`gs://${bucket}/`, '');
        console.log(`🔄 Convertida URL gs:// a ruta de Storage: ${storagePath}`);
      }
      
      // Limpiar barras iniciales
      storagePath = storagePath.replace(/^\/+/, '');
      
      // Quitar parámetros de consulta si existen
      if (storagePath.includes('?')) {
        storagePath = storagePath.split('?')[0];
      }
      
      console.log(`📂 Ruta normalizada: ${storagePath}`);
      
      // Crear referencia al archivo en Storage
      const storageRef = ref(storage, storagePath);
      
      // Intentar obtener URL de descarga con manejo de timeout
      console.log('⏳ Obteniendo URL de descarga...');
      
      // Crear promesa para getDownloadURL con timeout
      const downloadPromise = getDownloadURL(storageRef);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Tiempo de espera agotado al obtener URL')), 15000)
      );
      
      // Obtener URL con límite de tiempo
      const downloadUrl = await Promise.race([downloadPromise, timeoutPromise]);
      
      if (!downloadUrl) {
        throw new Error('No se pudo obtener la URL de descarga: respuesta vacía');
      }
      
      // Añadir parámetro para evitar caché
      const separator = downloadUrl.includes('?') ? '&' : '?';
      const urlConTimestamp = `${downloadUrl}${separator}_t=${Date.now()}`;
      
      console.log(`✅ URL normalizada obtenida con timestamp anti-caché`);
      return urlConTimestamp;
    } catch (error) {
      console.error(`❌ Error al normalizar URL de imagen: ${url}`, error);
      
      // Información detallada según el tipo de error
      let errorInfo = 'Error desconocido';
      
      if (error.code === 'storage/object-not-found') {
        errorInfo = 'El archivo no existe en Firebase Storage';
      } else if (error.code === 'storage/unauthorized') {
        errorInfo = 'No tienes permisos para acceder a este archivo';
      } else if (error.code === 'storage/invalid-url') {
        errorInfo = 'La URL de Firebase Storage no es válida';
      } else if (error.code === 'storage/quota-exceeded') {
        errorInfo = 'Cuota de Firebase Storage excedida';
      } else if (error.code === 'storage/unauthenticated') {
        errorInfo = 'Usuario no autenticado para acceder a este recurso';
      } else if (error.code === 'storage/retry-limit-exceeded') {
        errorInfo = 'Demasiados intentos de acceso al archivo';
      } else if (error.code === 'storage/canceled') {
        errorInfo = 'Operación cancelada';
      } else if (error.message.includes('timeout') || error.message.includes('agotado')) {
        errorInfo = 'Tiempo de espera agotado al intentar obtener la URL';
      }
      
      console.error(`📛 Detalle del error: ${errorInfo}`);
      
      // Último intento: Si la URL se ve como una ruta de storage, intentar construir una URL directa
      if (url.includes('fotos_planogramas/') || url.includes('/solicitudes/')) {
        try {
          console.log('🛠️ Intentando crear URL directa como última opción...');
          const cleanPath = url.replace(/^\/+/, '').replace(/\?.*$/, '');
          const projectId = window.location.hostname.split('.')[0];
          
          if (projectId && projectId !== 'localhost') {
            const directUrl = `https://firebasestorage.googleapis.com/v0/b/${projectId}.appspot.com/o/${encodeURIComponent(cleanPath)}?alt=media&t=${Date.now()}`;
            console.log(`🔗 URL directa generada: ${directUrl.substring(0, 100)}...`);
            return directUrl;
          }
        } catch (e) {
          console.error('❌ El intento de crear URL directa también falló', e);
        }
      }
      
      // Si todos los intentos fallan, retornar null
      return null;
    }
  };

  // Función para configurar el listener de solicitudes
  const configurarSolicitudesListener = () => {
    try {
      setLoading(true);
      const db = getFirestore();
      let solicitudesRef;
      
      if (esAdmin) {
        // Administradores ven todas las solicitudes de la tienda
        solicitudesRef = collection(db, `tiendas/${tiendaId}/solicitudes`);
      } else {
        // Empleados ven solicitudes asignadas a ellos o sin asignar
        solicitudesRef = query(
          collection(db, `tiendas/${tiendaId}/solicitudes`),
          where('completada', '==', false)
        );
      }
      
      // Configurar un listener en lugar de una carga única
      return onSnapshot(solicitudesRef, async (snapshot) => {
        const solicitudesData = [];
        const cambios = {
          agregadas: [],
          modificadas: [],
          eliminadas: []
        };
        
        // Primero recopilamos todos los documentos
        snapshot.forEach(doc => {
          const solicitudData = {
            id: doc.id,
            ...doc.data(),
            _normalized: false // Flag para saber si la URL ya está normalizada
          };
          solicitudesData.push(solicitudData);
        });
        
        // Actualizamos la UI con los datos básicos inmediatamente
        // Ordenar por fecha límite (las más próximas primero)
        solicitudesData.sort((a, b) => {
          if (!a.fechaLimite) return 1;
          if (!b.fechaLimite) return -1;
          return new Date(a.fechaLimite) - new Date(b.fechaLimite);
        });
        
        setSolicitudes(solicitudesData);
        setLoading(false);

        // Procesar los cambios para logging
        snapshot.docChanges().forEach((change) => {
          const solicitud = {
            id: change.doc.id,
            ...change.doc.data()
          };
          
          if (change.type === 'added') {
            cambios.agregadas.push(solicitud);
          } 
          else if (change.type === 'modified') {
            cambios.modificadas.push(solicitud);
            
            // Verificar si se ha añadido una foto (completada es true y tiene fotoUrl)
            if (solicitud.completada && solicitud.fotoUrl) {
              const solicitudAnterior = solicitudes.find(s => s.id === solicitud.id);
              // Si es una nueva foto o la foto ha cambiado
              if (!solicitudAnterior?.fotoUrl || solicitudAnterior.fotoUrl !== solicitud.fotoUrl) {
                logFotoRecibida(solicitud);
              }
            }
          } 
          else if (change.type === 'removed') {
            cambios.eliminadas.push(solicitud);
          }
        });
        
        // Normalizar las URLs de imágenes en un segundo paso (proceso asíncrono)
        const solicitudesConFotos = solicitudesData.filter(s => s.fotoUrl && !s._normalized);
        if (solicitudesConFotos.length > 0) {
          console.log(`🖼️ Normalizando ${solicitudesConFotos.length} URLs de imágenes...`);
          
          const solicitudesNormalizadas = [...solicitudesData];
          
          // Procesar cada URL en paralelo
          await Promise.all(solicitudesConFotos.map(async (solicitud, index) => {
            try {
              if (!isValidImageUrl(solicitud.fotoUrl)) {
                const normalizedUrl = await normalizeImageUrl(solicitud.fotoUrl);
                if (normalizedUrl) {
                  // Actualizar la URL normalizada en nuestro array
                  const idx = solicitudesNormalizadas.findIndex(s => s.id === solicitud.id);
                  if (idx !== -1) {
                    solicitudesNormalizadas[idx] = {
                      ...solicitudesNormalizadas[idx],
                      fotoUrl: normalizedUrl,
                      _normalized: true
                    };
                  }
                }
              } else {
                // La URL ya está en formato correcto
                const idx = solicitudesNormalizadas.findIndex(s => s.id === solicitud.id);
                if (idx !== -1) {
                  solicitudesNormalizadas[idx]._normalized = true;
                }
              }
            } catch (error) {
              console.error(`Error al normalizar URL para solicitud ${solicitud.id}:`, error);
            }
          }));
          
          // Actualizar el estado con las URLs normalizadas
          setSolicitudes(solicitudesNormalizadas);
        }
        
        // Registrar cambios para debugging
        if (cambios.agregadas.length > 0) {
          console.log(`📩 ${cambios.agregadas.length} solicitudes nuevas recibidas`);
        }
        if (cambios.modificadas.length > 0) {
          console.log(`🔄 ${cambios.modificadas.length} solicitudes actualizadas`);
        }
      }, (error) => {
        console.error("Error en el listener de solicitudes:", error);
        setLoading(false);
      });
      
    } catch (error) {
      console.error("Error al configurar listener de solicitudes:", error);
      setLoading(false);
      return null;
    }
  };

  // Función para cargar planogramas de la tienda
  const cargarPlanogramas = async () => {
    try {
      setCargandoPlanogramas(true);
      const db = getFirestore();
      
      // Referencia a planogramas en la tienda
      const planogramasRef = collection(db, `tiendas/${tiendaId}/planogramas`);
      const snapshot = await getDocs(planogramasRef);
      
      const planogramasData = [];
      snapshot.forEach(doc => {
        planogramasData.push({
          id: doc.id,
          nombre: doc.data().nombre || 'Planograma sin nombre',
          ...doc.data()
        });
      });
      
      // Ordenar planogramas por nombre
      planogramasData.sort((a, b) => a.nombre.localeCompare(b.nombre));
      
      setPlanogramas(planogramasData);
      console.log(`Cargados ${planogramasData.length} planogramas`);
    } catch (error) {
      console.error("Error al cargar planogramas:", error);
    } finally {
      setCargandoPlanogramas(false);
    }
  };

  // Manejar cambios en el formulario
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNuevaSolicitud({
      ...nuevaSolicitud,
      [name]: value
    });
    
    // Si selecciona un planograma, actualizar también el nombre
    if (name === 'planogramaId') {
      const planogramaSeleccionado = planogramas.find(p => p.id === value);
      if (planogramaSeleccionado) {
        setNuevaSolicitud(prev => ({
          ...prev,
          planogramaId: value,
          planogramaNombre: planogramaSeleccionado.nombre || 'Planograma sin nombre'
        }));
      }
    }
  };

  // Crear nueva solicitud
  const crearSolicitud = async (e) => {
    e.preventDefault();
    try {
      setEnviando(true);
      const db = getFirestore();
      
      // Preparar datos de la solicitud
      const solicitudData = {
        titulo: nuevaSolicitud.titulo,
        planogramaNombre: nuevaSolicitud.planogramaNombre,
        planogramaId: nuevaSolicitud.planogramaId,
        fechaLimite: nuevaSolicitud.fechaLimite,
        descripcion: nuevaSolicitud.descripcion,
        fechaCreacion: new Date(),
        completada: false,
        fotoUrl: '', // Inicializar campo vacío
        creadaPor: usuarioActual?.nombre || 'Administrador',
        usuarioId: usuarioActual?.uid || 'admin'
      };
      
      // Guardar en Firestore
      const docRef = await addDoc(collection(db, `tiendas/${tiendaId}/solicitudes`), solicitudData);
      
      // Limpiar formulario
      setNuevaSolicitud({
        titulo: '',
        planogramaNombre: '',
        planogramaId: '',
        fechaLimite: '',
        descripcion: ''
      });
      setMostrarFormulario(false);
      
      // No es necesario recargar manualmente, el snapshot listener actualizará automáticamente
      
    } catch (error) {
      console.error("Error al crear solicitud:", error);
      alert("Error al crear la solicitud. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  // Configurar el modal para ver la imagen completa
  const abrirImagenCompleta = (solicitud) => {
    setMostrarImagenCompleta(solicitud);
  };

  // Función para completar solicitud con foto
  const completarSolicitud = (solicitud) => {
    setSolicitudActiva(solicitud);
    
    // Abrir selector de archivos
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Función para procesar la subida de la foto
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !solicitudActiva) return;
    
    try {
      setSubiendoFoto(true);
      
      // Validación del tipo de archivo
      if (!file.type.startsWith('image/')) {
        throw new Error('El archivo seleccionado no es una imagen válida');
      }

      // Validación de tamaño (máximo 5MB)
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
      if (file.size > MAX_SIZE) {
        throw new Error(`La imagen es demasiado grande. Máximo 5MB permitido.`);
      }
      
      // Generar un nombre de archivo único para evitar colisiones
      const timestamp = Date.now();
      const uniqueFilename = `foto_${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      
      // Ruta en Storage para la evidencia específica de la tienda y solicitud
      const storagePath = `evidencias/${tiendaId}/solicitudes/${solicitudActiva.id}/${uniqueFilename}`;
      
      // 1. Crear referencia al Storage
      const storage = getStorage();
      const storageRef = ref(storage, storagePath);
      
      // Crear una copia temporal de la solicitud con estado pendiente
      const solicitudTemporal = {
        ...solicitudActiva,
        _pendiente: true  // Flag para indicar subida en proceso
      };
      
      // Actualizar UI con estado pendiente
      setSolicitudes(prevSolicitudes => 
        prevSolicitudes.map(s => 
          s.id === solicitudActiva.id ? solicitudTemporal : s
        )
      );
      
      // Subir archivo con metadatos para mejorar CORS
      const metadata = {
        contentType: file.type,
        customMetadata: {
          'uploaded-by': usuarioActual?.nombre || 'Usuario',
          'solicitud-id': solicitudActiva.id,
          'timestamp': timestamp.toString(),
          'filename': uniqueFilename
        }
      };
      
      console.log(`Iniciando subida de archivo a: ${storagePath}`);
      
      // 2. Subir archivo
      const snapshot = await uploadBytes(storageRef, file, metadata);
      console.log('Archivo subido exitosamente a:', snapshot.ref.fullPath);
      
      // 3. Obtener URL de descarga
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('URL de descarga obtenida:', downloadURL);
      
      if (!downloadURL) {
        throw new Error('No se pudo obtener la URL de descarga');
      }
      
      // 4. Actualizar documento en Firestore con la URL completa
      const db = getFirestore();
      const solicitudRef = doc(db, `tiendas/${tiendaId}/solicitudes/${solicitudActiva.id}`);
      
      const updateData = {
        completada: true,
        completadaPor: usuarioActual?.nombre || 'Usuario',
        fechaCompletada: serverTimestamp(),
        fotoUrl: downloadURL, // Guardamos la URL completa, no solo la referencia
        ultimaActualizacion: serverTimestamp(),
        // Guardar metadatos adicionales para troubleshooting
        fotoDatos: {
          rutaStorage: snapshot.ref.fullPath,
          nombreArchivo: uniqueFilename,
          tipoContenido: file.type,
          timestamp: timestamp
        }
      };
      
      await updateDoc(solicitudRef, updateData);
      
      console.log('Solicitud completada exitosamente con URL de foto:', downloadURL);
      
      // 5. Verificación adicional: comprobar que la URL se guardó correctamente
      const solicitudActualizada = await getDoc(solicitudRef);
      if (solicitudActualizada.exists()) {
        const datosActualizados = solicitudActualizada.data();
        if (datosActualizados.fotoUrl !== downloadURL) {
          console.warn('⚠️ La URL guardada no coincide con la URL generada:');
          console.warn('- URL generada:', downloadURL);
          console.warn('- URL guardada:', datosActualizados.fotoUrl);
        } else {
          console.log('✅ Verificación exitosa: La URL se guardó correctamente');
        }
      }
      
      // Limpiar estado
      e.target.value = '';
    } catch (error) {
      console.error('Error al subir foto:', error);
      alert(`Error al subir la imagen: ${error.message || 'Inténtalo de nuevo.'}`);
      
      // Restaurar estado original
      setSolicitudes(prevSolicitudes => 
        prevSolicitudes.map(s => 
          s.id === solicitudActiva.id ? solicitudActiva : s
        )
      );
    } finally {
      setSubiendoFoto(false);
      setSolicitudActiva(null);
    }
  };

  // Función super simplificada para evaluar una solicitud con OCR
  const evaluarSolicitud = (solicitud) => {
    if (!solicitud.fotoUrl || !solicitud.planogramaId) {
      alert('No se puede evaluar esta solicitud porque no tiene imagen o planograma asociado.');
      return;
    }
    
    // Mensaje para el usuario
    alert('Preparando imagen para análisis... Espera un momento.');
    
    try {
      // Paso 1: Crear una imagen temporal para descargar la imagen
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      // Paso 2: Configurar el evento onload para procesar la imagen cuando se cargue
      img.onload = () => {
        try {
          // Paso 3: Crear un canvas para convertir la imagen a base64
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          
          // Paso 4: Dibujar la imagen en el canvas
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          
          // Paso 5: Convertir a base64
          const base64 = canvas.toDataURL('image/jpeg', 0.9);
          
          // Paso 6: Navegar a OCR con la imagen en base64
          const ocrParams = {
            tiendaId: tiendaId,
            planogramaId: solicitud.planogramaId,
            planogramaNombre: solicitud.planogramaNombre,
            // Enviar la imagen como base64
            fotoUrl: base64,
            solicitudId: solicitud.id,
            solicitudTitulo: solicitud.titulo,
            esBase64: true,
            cargarDirecto: false,
            timestamp: Date.now()
          };
          
          console.log('✅ Imagen convertida a base64 exitosamente');
          
          // Navegar a OCR con los parámetros
          navigate('/ocr', { state: ocrParams, replace: false });
        } catch (error) {
          console.error('Error al convertir imagen:', error);
          intentarMetodoAlternativo();
        }
      };
      
      // Paso 7: Configurar el evento onerror para manejar errores de carga
      img.onerror = () => {
        console.error('Error al cargar la imagen original');
        intentarMetodoAlternativo();
      };
      
      // Función para intentar método alternativo si falla el principal
      const intentarMetodoAlternativo = () => {
        try {
          // Intentar obteniendo una URL fresca de Firebase (si aplica)
          if (solicitud.fotoUrl.includes('firebasestorage.googleapis.com')) {
            // Extraer la ruta del storage
            const pathMatch = solicitud.fotoUrl.match(/\/o\/([^?]+)/);
            if (pathMatch && pathMatch[1]) {
              const decodedPath = decodeURIComponent(pathMatch[1]);
              console.log('Intentando método Firebase directo');
              
              // Obtener Storage y crear referencia
              const storage = getStorage();
              const storageRef = ref(storage, decodedPath);
              
              // Obtener URL de descarga fresca
              getDownloadURL(storageRef)
                .then(freshUrl => {
                  console.log('URL fresca obtenida:', freshUrl);
                  navegarDirecto(freshUrl);
                })
                .catch(error => {
                  console.error('Error al obtener URL fresca:', error);
                  navegarDirecto(solicitud.fotoUrl);
                });
            } else {
              navegarDirecto(solicitud.fotoUrl);
            }
          } else {
            navegarDirecto(solicitud.fotoUrl);
          }
        } catch (error) {
          console.error('Error en método alternativo:', error);
          navegarDirecto(solicitud.fotoUrl);
        }
      };
      
      // Función para navegar directamente con la URL
      const navegarDirecto = (url) => {
        console.log('Navegando con URL directa');
        
        // Agregar timestamp para evitar caché
        const timestamp = Date.now();
        const urlConTimestamp = url.includes('?') ? 
          `${url}&t=${timestamp}` : 
          `${url}?t=${timestamp}`;
        
        // Navegar a OCR con la URL
        navigate('/ocr', { 
          state: {
            tiendaId: tiendaId,
            planogramaId: solicitud.planogramaId,
            planogramaNombre: solicitud.planogramaNombre,
            fotoUrl: urlConTimestamp,
            solicitudId: solicitud.id,
            solicitudTitulo: solicitud.titulo,
            cargarDirecto: true,
            timestamp: timestamp
          },
          replace: false
        });
      };
      
      // Paso 8: Cargar la imagen con un parámetro para evitar caché
      const timestamp = Date.now();
      const urlConTimestamp = solicitud.fotoUrl.includes('?') ? 
        `${solicitud.fotoUrl}&t=${timestamp}` : 
        `${solicitud.fotoUrl}?t=${timestamp}`;
      
      console.log('Cargando imagen:', urlConTimestamp);
      img.src = urlConTimestamp;
      
      // Establecer un tiempo máximo de espera (15 segundos)
      setTimeout(() => {
        if (!img.complete) {
          console.log('Timeout de carga de imagen, intentando método alternativo');
          img.src = ''; // Detener la carga
          intentarMetodoAlternativo();
        }
      }, 15000);
    } catch (error) {
      console.error('Error general:', error);
      
      // En caso de cualquier error, intentar con URL directa
      const timestamp = Date.now();
      const urlFallback = solicitud.fotoUrl.includes('?') ?
        `${solicitud.fotoUrl}&t=${timestamp}` :
        `${solicitud.fotoUrl}?t=${timestamp}`;
      
      // Navegar con la URL directamente como último recurso
      navigate('/ocr', { 
        state: {
          tiendaId: tiendaId,
          planogramaId: solicitud.planogramaId,
          planogramaNombre: solicitud.planogramaNombre,
          fotoUrl: urlFallback,
          solicitudId: solicitud.id,
          solicitudTitulo: solicitud.titulo,
          timestamp: timestamp
        }, 
        replace: false
      });
    }
  };

  return (
    <div className="solicitudes-container">
      {/* Input oculto para subir archivos */}
      <input 
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handleFileUpload}
      />
      
      <div className="solicitudes-header">
        <h3>Visualización de Fotos de Planogramas</h3>
        
        {esAdmin && (
          <button 
            className="nueva-solicitud-btn"
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
          >
            {mostrarFormulario ? 'Cancelar' : 'Nueva Solicitud'}
          </button>
        )}
      </div>
      
      {/* Formulario para crear nueva solicitud */}
      {mostrarFormulario && (
        <div className="solicitud-form-container">
          <form onSubmit={crearSolicitud} className="solicitud-form">
            <div className="form-group">
              <label>Título:</label>
              <input 
                type="text" 
                name="titulo" 
                value={nuevaSolicitud.titulo} 
                onChange={handleInputChange}
                placeholder="Ej: Verificar planograma de bebidas"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Seleccionar Planograma:</label>
              {cargandoPlanogramas ? (
                <div className="loading-planogramas">Cargando planogramas...</div>
              ) : planogramas.length > 0 ? (
                <select
                  name="planogramaId"
                  value={nuevaSolicitud.planogramaId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">-- Seleccionar planograma --</option>
                  {planogramas.map(planograma => (
                    <option key={planograma.id} value={planograma.id}>
                      {planograma.nombre}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="no-planogramas-warning">
                  No hay planogramas disponibles. 
                  <input 
                    type="text" 
                    name="planogramaNombre" 
                    value={nuevaSolicitud.planogramaNombre} 
                    onChange={handleInputChange}
                    placeholder="Escribe manualmente el nombre del planograma"
                    required
                  />
                </div>
              )}
            </div>
            
            <div className="form-group">
              <label>Fecha Límite:</label>
              <input 
                type="date" 
                name="fechaLimite" 
                value={nuevaSolicitud.fechaLimite} 
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Descripción:</label>
              <textarea 
                name="descripcion" 
                value={nuevaSolicitud.descripcion} 
                onChange={handleInputChange}
                placeholder="Proporciona instrucciones detalladas sobre qué necesitas verificar en este planograma"
              />
            </div>
            
            <button 
              type="submit" 
              className="submit-btn"
              disabled={enviando}
            >
              {enviando ? 'Creando...' : 'Crear Solicitud'}
            </button>
          </form>
        </div>
      )}
      
      {/* Modal para ver imagen completa */}
      {mostrarImagenCompleta && (
        <div className="modal-overlay">
          <div className="modal-content imagen-completa-modal">
            <h4>{mostrarImagenCompleta.titulo}</h4>
            <p>Planograma: {mostrarImagenCompleta.planogramaNombre}</p>
            <div className="imagen-completa-contenedor">
              {mostrarImagenCompleta.fotoUrl ? (
                <img 
                  src={mostrarImagenCompleta.fotoUrl} 
                  alt="Foto del planograma"
                  onError={(e) => {
                    console.error('Error al cargar imagen completa:', mostrarImagenCompleta.fotoUrl);
                    e.target.onerror = null;
                    e.target.src = FALLBACK_IMAGE;
                  }}
                />
              ) : (
                <div className="imagen-no-disponible">
                  <span className="material-icons">image_not_supported</span>
                  <p>Imagen no disponible</p>
                </div>
              )}
            </div>
            <div className="detalles-imagen">
              <p>Subida por: {mostrarImagenCompleta.completadaPor || 'No disponible'}</p>
              <p>Fecha: {formatearFecha(mostrarImagenCompleta.fechaCompletada)}</p>
            </div>
            <div className="form-actions">
              <button 
                type="button" 
                className="cancel-btn"
                onClick={() => setMostrarImagenCompleta(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Lista de solicitudes */}
      {loading ? (
        <div className="loading">Cargando solicitudes...</div>
      ) : solicitudes.length === 0 ? (
        <div className="no-solicitudes">
          <p>No hay solicitudes de fotos disponibles</p>
        </div>
      ) : (
        <div className="solicitudes-list">
          {solicitudes.map(solicitud => (
            <div key={solicitud.id} className={`solicitud-item ${solicitud.completada ? 'completada' : 'pendiente'}`}>
              <div className="solicitud-info">
                <h4>{solicitud.titulo}</h4>
                
                <div className="solicitud-details">
                  <div className="solicitud-detail">
                    <i className="material-icons">view_in_ar</i>
                    <span>{solicitud.planogramaNombre}</span>
                  </div>
                  
                  <div className="solicitud-detail">
                    <i className="material-icons">event</i>
                    <span>Fecha límite: {formatearFecha(solicitud.fechaLimite)}</span>
                  </div>
                  
                  <div className="solicitud-detail">
                    <i className="material-icons">person</i>
                    <span>Solicitado por: {solicitud.creadaPor}</span>
                  </div>
                </div>
                
                {solicitud.descripcion && (
                  <p className="solicitud-descripcion">{solicitud.descripcion}</p>
                )}
                
                {solicitud.completada && (
                  <div className="solicitud-status">
                    <i className="material-icons">check_circle</i>
                    <span>Completada por {solicitud.completadaPor} el {formatearFecha(solicitud.fechaCompletada)}</span>
                  </div>
                )}
                
                <div className="solicitud-actions">
                  {!solicitud.completada && !solicitud._pendiente && !esAdmin && (
                    <button 
                      className="completar-btn"
                      onClick={() => completarSolicitud(solicitud)}
                      disabled={subiendoFoto}
                    >
                      <i className="material-icons">add_a_photo</i>
                      Subir Foto
                    </button>
                  )}
                  
                  {/* Botón para evaluar solicitudes completadas con foto */}
                  {solicitud.completada && solicitud.fotoUrl && solicitud.planogramaId && (
                    <button 
                      className="evaluar-btn"
                      onClick={() => evaluarSolicitud(solicitud)}
                    >
                      <i className="material-icons">analytics</i>
                      Evaluar
                    </button>
                  )}
                </div>
              </div>
              
              {solicitud.fotoUrl ? (
                <div className="solicitud-imagen" onClick={() => abrirImagenCompleta(solicitud)}>
                  <img 
                    src={solicitud.fotoUrl} 
                    alt="Foto del planograma" 
                    className={solicitud._pendiente ? 'imagen-pendiente' : ''}
                    onError={(e) => {
                      console.error('Error al cargar miniatura:', solicitud.fotoUrl);
                      e.target.onerror = null;
                      e.target.src = FALLBACK_IMAGE;
                      
                      // Solo intentar normalizar si aún no se ha normalizado
                      if (!solicitud._normalized && !isValidImageUrl(solicitud.fotoUrl)) {
                        normalizeImageUrl(solicitud.fotoUrl).then(normalizedUrl => {
                          if (normalizedUrl) {
                            // Actualizar la imagen con la URL normalizada
                            e.target.src = normalizedUrl;
                            
                            // Actualizar el estado para esta solicitud
                            setSolicitudes(prev => 
                              prev.map(s => s.id === solicitud.id ? 
                                {...s, fotoUrl: normalizedUrl, _normalized: true} : s
                              )
                            );
                          }
                        }).catch(err => {
                          console.error("Error al normalizar URL en fallback:", err);
                        });
                      }
                    }}
                  />
                  {solicitud._pendiente && (
                    <div className="estado-pendiente">
                      <span className="material-icons">hourglass_top</span>
                      <span>Cargando...</span>
                    </div>
                  )}
                  
                  {/* Botón para ver imagen completa */}
                  <div className="imagen-overlay">
                    <span className="material-icons">fullscreen</span>
                  </div>
                </div>
              ) : (
                /* Mostrar placeholder si no hay foto */
                <div className="solicitud-imagen-placeholder">
                  <span className="material-icons">image_not_supported</span>
                  <span>Sin imagen</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SolicitudesFotos;