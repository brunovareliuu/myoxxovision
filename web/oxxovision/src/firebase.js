// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Import planogram task service
import planogramTaskService from './services/PlanogramTaskService';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA2UPFXjD963tlAlcPB7gZyXAaRqZJWZaI",
  authDomain: "myoxxovision.firebaseapp.com",
  projectId: "myoxxovision",
  storageBucket: "myoxxovision.firebasestorage.app",
  messagingSenderId: "491253915189",
  appId: "1:491253915189:web:aa9c56c0ce6c6a090c5b7c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Función simplificada para registrar un nuevo usuario
export const registerUser = async (email, password, userData) => {
  try {
    console.log("Iniciando registro para:", email);
    
    // Crear usuario en Authentication primero
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log("Usuario creado en Auth:", user.uid);
    
    // Simplificar datos a guardar en Firestore
    const userDataToSave = {
      uid: user.uid,
      email: user.email,
      nombre: userData.nombre || 'Usuario',
      rol: 'admin', // Por defecto es usuario normal
      createdAt: new Date().toISOString() // Usar formato ISO en lugar de serverTimestamp
    };
    
    console.log("Guardando en Firestore:", userDataToSave);
    
    // Guardar datos adicionales en Firestore con manejo de errores específico
    try {
    await setDoc(doc(db, "users", user.uid), userDataToSave);
      console.log("Datos guardados en Firestore correctamente");
    } catch (firestoreError) {
      console.error("Error específico al guardar en Firestore:", firestoreError);
      // Continuar a pesar del error en Firestore
    }
    
    // Guardar datos en localStorage para persistencia
    localStorage.setItem('oxxoSessionToken', 'true');
    localStorage.setItem('oxxoUserId', user.uid);
    localStorage.setItem('oxxoUserRole', 'usuario');
    localStorage.setItem('oxxoUserName', userData.nombre || 'Usuario');
    
    return user;
  } catch (error) {
    console.error("Error al registrar usuario:", error);
    throw error;
  }
};

// Función simplificada para iniciar sesión
export const loginUser = async (email, password) => {
  console.log("Intentando login con:", email);
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Obtener datos adicionales del usuario
    const userData = await getUserData(user.uid);
    
    // Guardar datos en localStorage para persistencia
    localStorage.setItem('oxxoSessionToken', 'true');
    localStorage.setItem('oxxoUserId', user.uid);
    
    if (userData) {
      localStorage.setItem('oxxoUserRole', userData.rol || 'usuario');
      localStorage.setItem('oxxoUserName', userData.nombre || 'Usuario');
    }
    
    return user;
  } catch (error) {
    console.error("Error en loginUser:", error);
    throw error;
  }
};

// Función simplificada para cerrar sesión
export const logoutUser = async () => {
  try {
    // Limpiar localStorage
    localStorage.removeItem('oxxoSessionToken');
    localStorage.removeItem('oxxoUserId');
    localStorage.removeItem('oxxoUserRole');
    localStorage.removeItem('oxxoUserName');
    
    // Cerrar sesión en Firebase
    await signOut(auth);
    return true;
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    throw error;
  }
};

// Función para obtener datos del usuario
export const getUserData = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      return userDoc.data();
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error al obtener datos de usuario:", error);
    return null;
  }
};

// Función para verificar el estado de autenticación
export const checkAuthState = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// Función para generar un código de tienda único
export const generarCodigoTienda = () => {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let codigo = '';
  
  // Generar primer grupo de 3 caracteres
  for (let i = 0; i < 3; i++) {
    codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  
  codigo += '-';
  
  // Generar segundo grupo de 3 caracteres
  for (let i = 0; i < 3; i++) {
    codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  
  codigo += '-';
  
  // Generar tercer grupo de 3 caracteres
  for (let i = 0; i < 3; i++) {
    codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  
  return codigo;
};

// Función para verificar si un código de tienda ya existe
export const verificarCodigoTienda = async (codigo) => {
  try {
    const tiendasRef = collection(db, "tiendas");
    const q = query(tiendasRef, where("codigoTienda", "==", codigo));
    const querySnapshot = await getDocs(q);
    
    return !querySnapshot.empty;
  } catch (error) {
    console.error("Error al verificar código de tienda:", error);
    throw error;
  }
};

// Función que genera un stock aleatorio
const generarStockAleatorio = (min = 5, max = 50) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Función para registrar una nueva tienda OXXO
export const registrarTienda = async (datosTienda) => {
  try {
    // Verificar que el usuario esté autenticado
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No hay un usuario autenticado.");
    }
    
    // Obtener información del gerente (usuario actual)
    const userData = await getUserData(currentUser.uid);
    const gerente = {
      id: currentUser.uid,
      nombre: userData?.nombre || localStorage.getItem('oxxoUserName') || 'Usuario',
      email: currentUser.email || userData?.email,
      rol: userData?.rol || localStorage.getItem('oxxoUserRole') || 'usuario'
    };
    
    // Generar código de tienda único
    let codigoTienda = generarCodigoTienda();
    let codigoExiste = await verificarCodigoTienda(codigoTienda);
    
    // Si el código ya existe, generar uno nuevo hasta encontrar uno único
    while (codigoExiste) {
      codigoTienda = generarCodigoTienda();
      codigoExiste = await verificarCodigoTienda(codigoTienda);
    }
    
    // Obtener todos los productos para generar inventario
    const productosRef = collection(db, "productos");
    const productosSnapshot = await getDocs(productosRef);
    
    // Crear objeto de inventario con stock aleatorio para cada producto
    const inventarioProductos = {};
    let cantidadProductos = 0;
    
    productosSnapshot.forEach((doc) => {
      const producto = {
        id: doc.id,
        ...doc.data()
      };
      
      // Generar stock aleatorio para este producto
      const stockAleatorio = generarStockAleatorio(5, 50);
      
      // Simplificar el inventario: solo nombre, precio, productoId y stock
      inventarioProductos[producto.id] = {
        productoId: producto.id,
        nombre: producto.nombre,
        precio: producto.precio || 0,
        stock: stockAleatorio
      };
      
      cantidadProductos++;
    });
    
    // Añadir el código, gerente e inventario a los datos de la tienda
    const tiendaCompleta = {
      ...datosTienda,
      codigoTienda,
      fechaRegistro: serverTimestamp(),
      creadoPor: currentUser.uid,
      gerente: gerente, // Añadir la información del gerente
      inventarioProductos: inventarioProductos, // Añadir inventario con stock
      tieneInventario: cantidadProductos > 0,
      cantidadProductos: cantidadProductos,
      ultimaActualizacionInventario: new Date().toISOString()
    };
    
    // Agregar la tienda a Firestore
    const docRef = await addDoc(collection(db, "tiendas"), tiendaCompleta);
    console.log("Tienda registrada con ID:", docRef.id);
    console.log(`Stock generado para ${cantidadProductos} productos`);
    
    return {
      id: docRef.id,
      ...tiendaCompleta,
      codigoTienda // Asegurar que el código esté disponible
    };
  } catch (error) {
    console.error("Error en registrarTienda:", error);
    throw error;
  }
};

// Función para obtener todas las tiendas
export const obtenerTiendas = async () => {
  try {
    const tiendasRef = collection(db, "tiendas");
    const q = query(tiendasRef, orderBy("fechaRegistro", "desc"));
    const querySnapshot = await getDocs(q);
    
    const tiendas = [];
    querySnapshot.forEach((doc) => {
      tiendas.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return tiendas;
  } catch (error) {
    console.error("Error al obtener tiendas:", error);
    return [];
  }
};

// Función para obtener las tiendas de un gerente específico
export const obtenerTiendasGerente = async (gerenteId) => {
  try {
    const tiendasRef = collection(db, "tiendas");
    // Eliminar el orderBy que requiere índice compuesto
    // Solo usar where para filtrar por el gerente
    const q = query(tiendasRef, where("creadoPor", "==", gerenteId));
    const querySnapshot = await getDocs(q);
    
    const tiendas = [];
    querySnapshot.forEach((doc) => {
      tiendas.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Ordenar en el cliente en lugar de en Firestore
    tiendas.sort((a, b) => {
      // Si hay campos fechaRegistro, intentar ordenar por ellos
      if (a.fechaRegistro && b.fechaRegistro) {
        return b.fechaRegistro.seconds - a.fechaRegistro.seconds;
      }
      // Si no hay fechas, ordenar por nombre
      return a.nombre.localeCompare(b.nombre);
    });
    
    return tiendas;
  } catch (error) {
    console.error("Error al obtener tiendas del gerente:", error);
    return [];
  }
};

// Función para obtener detalles de una tienda específica
export const obtenerTienda = async (tiendaId) => {
  try {
    const tiendaDoc = await getDoc(doc(db, "tiendas", tiendaId));
    if (tiendaDoc.exists()) {
      return {
        id: tiendaDoc.id,
        ...tiendaDoc.data()
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error al obtener tienda:", error);
    return null;
  }
};

// Función para actualizar una tienda
export const actualizarTienda = async (tiendaId, datosTienda) => {
  try {
    await updateDoc(doc(db, "tiendas", tiendaId), {
      ...datosTienda,
      fechaActualizacion: serverTimestamp(),
      actualizadoPor: auth.currentUser?.uid || 'unknown'
    });
    
    return true;
  } catch (error) {
    console.error("Error al actualizar tienda:", error);
    throw error;
  }
};

// Función para eliminar una tienda
export const eliminarTienda = async (tiendaId) => {
  try {
    await deleteDoc(doc(db, "tiendas", tiendaId));
    return true;
  } catch (error) {
    console.error("Error al eliminar tienda:", error);
    throw error;
  }
};

// Función para guardar la configuración 3D de la tienda
export const guardarConfiguracion3D = async (tiendaId, configData) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No hay un usuario autenticado.");
    }
    
    // Get a reference to the store document
    const tiendaRef = doc(db, "tiendas", tiendaId);
    
    // Create a basic config object to update the store
    const config3d = {
      storeSize: configData.storeSize || 20,
      walls: configData.walls || [],
      lastUpdated: serverTimestamp(),
      updatedBy: currentUser.uid
    };
    
    // Update store document with basic 3D configuration
    await updateDoc(tiendaRef, { config3d });
    
    // Process each shelf/planogram individually
    if (configData.shelves && configData.shelves.length > 0) {
      // Get reference to planogramas subcollection
      const planogramasRef = collection(db, "tiendas", tiendaId, "planogramas");
    
      // Process each shelf
      for (const shelf of configData.shelves) {
        const shelfId = shelf.id;
        const shelfRef = doc(planogramasRef, shelfId);
        
        // Invertir el orden de los niveles (el nivel 0 ahora será el más bajo)
        let invertedShelves = [];
        let invertedMaxProductsPerLevel = [];
        
        if (shelf.shelves && Array.isArray(shelf.shelves)) {
          // Crear copia invertida de los niveles
          invertedShelves = [...shelf.shelves].reverse();
          
          // También invertir la configuración de productos máximos por nivel si existe
          if (shelf.maxProductsPerLevel && Array.isArray(shelf.maxProductsPerLevel)) {
            invertedMaxProductsPerLevel = [...shelf.maxProductsPerLevel].reverse();
          } else {
            // Si no hay configuración específica, crear array del mismo tamaño con valores predeterminados
            invertedMaxProductsPerLevel = Array(invertedShelves.length).fill(shelf.maxProductsPerShelf || 30);
          }
        }
        
        // Prepare shelf data to save to Firestore
        const shelfData = {
          nombre: shelf.name,
          posicion: shelf.position,
          tamano: shelf.size,
          rotacion: shelf.rotation,
          color: shelf.color,
          ultimaModificacion: serverTimestamp(),
          actualizadoPor: currentUser.uid,
          // Add the new properties for shelf configuration with inverted order:
          shelves: invertedShelves.length > 0 ? invertedShelves : [[]],
          maxProductsPerShelf: shelf.maxProductsPerShelf || 30,
          maxProductsPerLevel: invertedMaxProductsPerLevel.length > 0 ? invertedMaxProductsPerLevel : [],
          configuracionGuardada: true, // Indicador de que la configuración fue guardada correctamente
          nivelInvertido: true // Marca para saber que los niveles están guardados con orden invertido
        };
        
        // Check if shelf already exists
        const shelfDoc = await getDoc(shelfRef);
        
        if (shelfDoc.exists()) {
          // Update existing shelf
          await updateDoc(shelfRef, shelfData);
        } else {
          // Create new shelf with additional creation data
          shelfData.fechaCreacion = serverTimestamp();
          shelfData.creadoPor = currentUser.uid;
          await setDoc(shelfRef, shelfData);
        }
        
        // Handle products for this shelf
        const productosRef = collection(shelfRef, "productos");
        
        // Delete old products first (limpiamos los productos anteriores)
        const productosSnapshot = await getDocs(productosRef);
        const deletePromises = [];
        productosSnapshot.forEach((doc) => {
          deletePromises.push(deleteDoc(doc.ref));
        });
        await Promise.all(deletePromises);

        // Procesamos los productos en cada nivel del estante (ya invertido)
        if (invertedShelves.length > 0) {
          for (let levelIndex = 0; levelIndex < invertedShelves.length; levelIndex++) {
            const level = invertedShelves[levelIndex];
            
            if (level && Array.isArray(level)) {
              // Calcular configuración específica para este nivel
              const levelConfig = {
                maxProducts: invertedMaxProductsPerLevel[levelIndex] || shelf.maxProductsPerShelf || 30
              };
              
              // Guardar la configuración del nivel
              await setDoc(
                doc(shelfRef, "niveles", `nivel_${levelIndex}`), 
                {
                  indice: levelIndex,
                  maxProductos: levelConfig.maxProducts,
                  cantidadProductos: level.length,
                  ultimaModificacion: serverTimestamp(),
                  // El nivel físico real (0 es el más bajo, aumentando hacia arriba)
                  nivelFisico: levelIndex
                }
              );
              
              for (let productIndex = 0; productIndex < level.length; productIndex++) {
                const product = level[productIndex];
                
                if (product) {
                  // Guardar el producto con su posición en la grid
                  const productData = {
                    nombre: product.name,
                    color: product.color,
                    nivelEstante: levelIndex,
                    posicionEnNivel: productIndex,
                    gridPosition: product.gridPosition || productIndex,
                    productoId: product.id,
                    categoria: product.category || 'Sin categoría',
                    tamano: product.size || [0.1, 0.1, 0.1],
                    imagenUrl: product.imagenUrl || '',
                    fechaCreacion: serverTimestamp(),
                    creadoPor: currentUser.uid
                  };
    
                  // Calcular posición 3D relativa del producto en el estante
                  const shelfSize = shelf.size || [1, 1, 1];
                  const totalProducts = level.length;
                  const maxProducts = invertedMaxProductsPerLevel[levelIndex] || (shelf.maxProductsPerShelf || 30);
                  
                  // Calcular grid para distribución de productos
                  const gridCols = Math.min(10, maxProducts);
                  const gridRows = Math.ceil(maxProducts / gridCols);
                  
                  const productWidth = shelfSize[0] / gridCols;
                  const productDepth = shelfSize[2] / gridRows;
                  
                  const col = productIndex % gridCols;
                  const row = Math.floor(productIndex / gridCols);
                  
                  // Calcular la posición en Y basada en el índice invertido
                  // El nivel 0 está abajo, cada nivel sube
                  const shelfHeight = shelfSize[1] / invertedShelves.length;
                  // Ajustar posición Y para que el nivel 0 esté abajo
                  const levelY = -shelfSize[1]/2 + (levelIndex + 0.5) * shelfHeight;
                  
                  const startX = -shelfSize[0]/2 + productWidth/2;
                  const startZ = -shelfSize[2]/2 + productDepth/2;
                  
                  const productX = startX + col * productWidth;
                  const productZ = startZ + row * productDepth;
                  
                  productData.posicion = [productX, levelY, productZ];
                  
                  await addDoc(productosRef, productData);
                }
              }
            }
          }
        }
        
        // Manejar también los productos individuales si existen
        if (shelf.products && shelf.products.length > 0) {
          for (const product of shelf.products) {
            if (!product.guardadoEnNivel) { // Solo guardar productos que no están en niveles
              await addDoc(productosRef, {
                nombre: product.name,
                color: product.color,
                posicion: product.position,
                tamano: product.size,
                productoId: product.id,
                categoria: product.category || 'Sin categoría',
                imagenUrl: product.imagenUrl || '',
                fechaCreacion: serverTimestamp(),
                creadoPor: currentUser.uid
              });
            }
          }
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error("Error al guardar configuración 3D:", error);
    throw error;
  }
};

// Función para obtener la configuración 3D de una tienda
export const obtenerConfiguracion3D = async (tiendaId) => {
  try {
    const tiendaRef = doc(db, "tiendas", tiendaId);
    const tiendaDoc = await getDoc(tiendaRef);
    
    if (!tiendaDoc.exists()) {
      throw new Error("La tienda no existe.");
    }
    
    const tiendaData = tiendaDoc.data();
    
    // Si no hay configuración 3D, devolver una por defecto
    if (!tiendaData.config3d) {
      return {
        storeSize: 20,
        walls: [],
        shelves: [],
        products: []
      };
    }
    
    // Obtener todos los planogramas (estantes) de la tienda
    const planogramasRef = collection(db, "tiendas", tiendaId, "planogramas");
    const planogramasSnapshot = await getDocs(planogramasRef);
    
    const shelves = [];
      
    // Process each planogram document
    for (const planogramaDoc of planogramasSnapshot.docs) {
      const planogramaData = planogramaDoc.data();
      const isInverted = planogramaData.nivelInvertido || false;
      
      // Get the products from the productos subcollection
      const productosRef = collection(planogramaDoc.ref, "productos");
      const productosSnapshot = await getDocs(productosRef);
      
      // Products in shelf levels (organize by level)
      const shelfLevels = planogramaData.shelves || [[]];
      
      // Prepare empty shelf levels array with correct structure
      const levels = Array(shelfLevels.length).fill().map(() => []);
      
      // Obtener la configuración de niveles si existe
      const nivelesRef = collection(planogramaDoc.ref, "niveles");
      const nivelesSnapshot = await getDocs(nivelesRef);
      
      // Crear un mapa de configuraciones de nivel para acceso rápido
      const nivelesConfig = {};
      nivelesSnapshot.forEach(nivelDoc => {
        const nivelData = nivelDoc.data();
        nivelesConfig[nivelData.indice] = nivelData;
      });
      
      // Extraer o crear el array maxProductsPerLevel
      const maxProductsPerLevel = [];
      for (let i = 0; i < shelfLevels.length; i++) {
        const nivelConfig = nivelesConfig[i];
        maxProductsPerLevel[i] = nivelConfig ? nivelConfig.maxProductos : (planogramaData.maxProductsPerShelf || 30);
      }
      
      // Process products and organize them by shelf level
      productosSnapshot.forEach((productoDoc) => {
        const productoData = productoDoc.data();
        
        // Create base product object
        const product = {
          id: productoDoc.id,
          name: productoData.nombre,
          color: productoData.color,
          position: productoData.posicion,
          size: productoData.tamano,
          category: productoData.categoria || 'Sin categoría',
          productoId: productoData.productoId,
          imagenUrl: productoData.imagenUrl || '',
          gridPosition: productoData.gridPosition !== undefined ? productoData.gridPosition : productoData.posicionEnNivel,
        };
        
        // Check if the product is assigned to a specific shelf level
        if (productoData.nivelEstante !== undefined && 
            productoData.posicionEnNivel !== undefined) {
          const levelIndex = productoData.nivelEstante;
          const positionIndex = productoData.posicionEnNivel;
          
          // Add level-specific properties
          product.nivelEstante = levelIndex;
          product.posicionEnNivel = positionIndex;
          product.guardadoEnNivel = true;
          
          // Ensure level array exists
          if (!levels[levelIndex]) {
            levels[levelIndex] = [];
          }
          
          // Add product to its level
          levels[levelIndex][positionIndex] = product;
        } else {
          // This is a freely positioned product (not in a shelf level)
          product.guardadoEnNivel = false;
          
          // If the shelf doesn't have a products array yet, create it
          if (!planogramaData.products) {
            planogramaData.products = [];
          }
          
          // Add to the shelf's products array for free products
          planogramaData.products.push(product);
        }
      });
      
      // Replace undefined values with null in levels arrays
      for (let i = 0; i < levels.length; i++) {
        if (levels[i]) {
          for (let j = 0; j < levels[i].length; j++) {
            if (levels[i][j] === undefined) {
              levels[i][j] = null;
            }
          }
        }
      }
      
      // Construct the shelf object with all data
      const shelf = {
        id: planogramaDoc.id,
        name: planogramaData.nombre,
        position: planogramaData.posicion,
        size: planogramaData.tamano,
        rotation: planogramaData.rotacion,
        color: planogramaData.color,
        products: planogramaData.products || [],
        shelves: levels,
        maxProductsPerShelf: planogramaData.maxProductsPerShelf || 30,
        maxProductsPerLevel: maxProductsPerLevel,
        configuracionGuardada: planogramaData.configuracionGuardada || false,
        nivelInvertido: isInverted // Pasar la marca de niveles invertidos al cliente
      };
      
      shelves.push(shelf);
    }
    
    return {
      storeSize: tiendaData.config3d.storeSize || 20,
      walls: tiendaData.config3d.walls || [],
      shelves: shelves,
      lastUpdated: tiendaData.config3d.lastUpdated
    };
  } catch (error) {
    console.error("Error al obtener configuración 3D:", error);
    throw error;
  }
};

// Función para obtener un planograma específico
export const obtenerPlanograma = async (tiendaId, planogramaId) => {
  try {
    const planogramaDoc = await getDoc(doc(db, "tiendas", tiendaId, "planogramas", planogramaId));
    
    if (!planogramaDoc.exists()) {
      return null;
    }
    
    const planogramaData = planogramaDoc.data();
    const isInverted = planogramaData.nivelInvertido || false;
    
    // Obtener la configuración de los niveles si existe
    const nivelesRef = collection(db, "tiendas", tiendaId, "planogramas", planogramaId, "niveles");
    const nivelesSnapshot = await getDocs(nivelesRef);
    
    const nivelesConfig = {};
    nivelesSnapshot.forEach((nivelDoc) => {
      const nivelData = nivelDoc.data();
      nivelesConfig[nivelData.indice] = nivelData;
    });
    
    // Crear array maxProductsPerLevel
    const maxProductsPerLevel = [];
    const shelfLevels = planogramaData.shelves || [[]];
    
    for (let i = 0; i < shelfLevels.length; i++) {
      const nivelConfig = nivelesConfig[i];
      maxProductsPerLevel[i] = nivelConfig ? nivelConfig.maxProductos : (planogramaData.maxProductsPerShelf || 30);
    }
    
    // Obtener los productos del planograma
    const productosRef = collection(db, "tiendas", tiendaId, "planogramas", planogramaId, "productos");
    const productosSnapshot = await getDocs(productosRef);
    
    // Organizar productos por niveles
    const levels = Array(shelfLevels.length).fill().map(() => []);
    const freeProducts = []; // Productos que no están en ningún nivel
    
    productosSnapshot.forEach((doc) => {
      const productoData = doc.data();
      
      const product = {
        id: doc.id,
        name: productoData.nombre,
        color: productoData.color,
        position: productoData.posicion,
        size: productoData.tamano,
        category: productoData.categoria || 'Sin categoría',
        productoId: productoData.productoId,
        imagenUrl: productoData.imagenUrl || '',
        gridPosition: productoData.gridPosition !== undefined ? productoData.gridPosition : productoData.posicionEnNivel
      };
      
      // Verificar si el producto está en un nivel específico
      if (productoData.nivelEstante !== undefined && productoData.posicionEnNivel !== undefined) {
        const levelIndex = productoData.nivelEstante;
        const positionIndex = productoData.posicionEnNivel;
        
        // Propiedades específicas de nivel
        product.nivelEstante = levelIndex;
        product.posicionEnNivel = positionIndex;
        product.guardadoEnNivel = true;
        
        // Asegurar que existe el array para el nivel
        if (!levels[levelIndex]) {
          levels[levelIndex] = [];
        }
        
        // Añadir producto a su nivel
        levels[levelIndex][positionIndex] = product;
      } else {
        // Es un producto libre (no asignado a nivel)
        product.guardadoEnNivel = false;
        freeProducts.push(product);
      }
    });
    
    // Reemplazar valores undefined con null en los arrays de niveles
    for (let i = 0; i < levels.length; i++) {
      if (levels[i]) {
        for (let j = 0; j < levels[i].length; j++) {
          if (levels[i][j] === undefined) {
            levels[i][j] = null;
          }
        }
      }
    }
    
    return {
      id: planogramaDoc.id,
      ...planogramaDoc.data(),
      shelves: levels, // Reemplazar con los niveles organizados
      maxProductsPerLevel: maxProductsPerLevel, // Añadir configuración de niveles
      products: freeProducts, // Productos no organizados en niveles
      configuracionGuardada: planogramaData.configuracionGuardada || false,
      nivelInvertido: isInverted // Pasar la marca de niveles invertidos al cliente
    };
  } catch (error) {
    console.error("Error al obtener planograma:", error);
    return null;
  }
};

// Función para eliminar un planograma de la tienda
export const eliminarPlanograma = async (tiendaId, planogramaId) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No hay un usuario autenticado.");
    }
    
    // Referencia al planograma
    const planogramaRef = doc(db, "tiendas", tiendaId, "planogramas", planogramaId);
    
    // Verificar si el planograma existe
    const planogramaDoc = await getDoc(planogramaRef);
    
    if (!planogramaDoc.exists()) {
      console.warn("El planograma no existe o ya fue eliminado.");
      return true;
    }
    
    // Eliminar los productos del planograma
    const productosRef = collection(planogramaRef, "productos");
    const productosSnapshot = await getDocs(productosRef);
    const deleteProductPromises = [];
    productosSnapshot.forEach((doc) => {
      deleteProductPromises.push(deleteDoc(doc.ref));
    });
    await Promise.all(deleteProductPromises);
    
    // Eliminar la configuración de niveles
    const nivelesRef = collection(planogramaRef, "niveles");
    const nivelesSnapshot = await getDocs(nivelesRef);
    const deleteNivelesPromises = [];
    nivelesSnapshot.forEach((doc) => {
      deleteNivelesPromises.push(deleteDoc(doc.ref));
    });
    await Promise.all(deleteNivelesPromises);
    
    // Después eliminar el planograma
    await deleteDoc(planogramaRef);
    
    console.log("Planograma eliminado exitosamente:", planogramaId);
    return true;
  } catch (error) {
    console.error("Error al eliminar planograma:", error);
    throw error;
  }
};

// Función para generar un ID único
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

// Función para obtener todos los productos
export const obtenerProductos = async () => {
  try {
    const productosRef = collection(db, "productos");
    const querySnapshot = await getDocs(productosRef);
    
    const productos = [];
    querySnapshot.forEach((doc) => {
      productos.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Ordenar por nombre si existe
    productos.sort((a, b) => {
      if (a.nombre && b.nombre) {
        return a.nombre.localeCompare(b.nombre);
      }
      return 0;
    });
    
    return productos;
  } catch (error) {
    console.error("Error al obtener productos:", error);
    return [];
  }
};

// Función para obtener un producto específico
export const obtenerProducto = async (productoId) => {
  try {
    const productoDoc = await getDoc(doc(db, "productos", productoId));
    if (productoDoc.exists()) {
      return {
        id: productoDoc.id,
        ...productoDoc.data()
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error al obtener producto:", error);
    return null;
  }
};

// Función para subir una imagen del producto
export const subirImagenProducto = async (file, productoId) => {
  if (!file) return null;
  
  try {
    // Crear un nombre único para el archivo
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    
    // Crear una referencia para la imagen - Usar la nueva carpeta products_planogramas
    const storageRef = ref(storage, `products_planogramas/${productoId || 'temp'}/${fileName}`);
    
    console.log("Iniciando subida de imagen:", fileName, "para producto:", productoId);
    
    // Subir el archivo
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    // Devolver una promesa para manejar la subida
    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Calcular el progreso
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`Progreso de subida: ${progress.toFixed(2)}%`);
          
          // Notificar el progreso - Método 1: Callback
          if (window.uploadProgressCallback && typeof window.uploadProgressCallback === 'function') {
            window.uploadProgressCallback(progress);
          }
          
          // Notificar el progreso - Método 2: Evento
          const progressEvent = new CustomEvent('upload-progress', {
            detail: { progress: progress }
          });
          window.dispatchEvent(progressEvent);
        },
        (error) => {
          console.error("Error en la subida:", error.code, error.message);
          reject(error);
        },
        async () => {
          try {
            // Obtener la URL de descarga
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log("Imagen subida correctamente. URL:", downloadURL);
            resolve(downloadURL);
          } catch (err) {
            console.error("Error al obtener URL de descarga:", err);
            reject(err);
          }
        }
      );
    });
  } catch (error) {
    console.error("Error en subirImagenProducto:", error);
    return null;
  }
};

// Función para eliminar una imagen de producto
export const eliminarImagenProducto = async (imageUrl) => {
  if (!imageUrl) return false;
  
  try {
    console.log("Intentando eliminar imagen:", imageUrl);
    
    // Las URL de Firebase Storage tienen este formato:
    // https://firebasestorage.googleapis.com/v0/b/BUCKET/o/ENCODED_PATH?alt=media&token=TOKEN
    
    // Extraer la ruta codificada de la URL
    const urlObj = new URL(imageUrl);
    let fullPath = urlObj.pathname.split('/o/')[1];
    
    // Si no se puede obtener la ruta de esta manera, intentar otra forma
    if (!fullPath) {
      const matches = imageUrl.match(/\/v0\/b\/[^\/]+\/o\/([^?]+)/);
      fullPath = matches ? matches[1] : null;
    }
    
    if (!fullPath) {
      console.error("No se pudo extraer la ruta de la imagen desde la URL");
      return false;
    }
    
    // Decodificar la ruta (Firebase codifica la ruta en la URL)
    const decodedPath = decodeURIComponent(fullPath);
    console.log("Ruta decodificada:", decodedPath);
    
    // Crear referencia al archivo
    const storageRef = ref(storage, decodedPath);
    
    // Eliminar el archivo
    await deleteObject(storageRef);
    console.log("Imagen eliminada con éxito");
    return true;
  } catch (error) {
    console.error("Error al eliminar imagen:", error);
    // A pesar del error, devolvemos true para no bloquear otras operaciones
    // Ya que el archivo podría no existir o ya haber sido eliminado
    return true;
  }
};

// Función mejorada para agregar o actualizar un producto con imagen
export const guardarProducto = async (productoData, productoId = null, file = null) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No hay un usuario autenticado.");
    }
    
    console.log("Iniciando guardarProducto:", 
                productoId ? `Editando producto ${productoId}` : "Creando producto nuevo", 
                "¿Tiene imagen?:", !!file);
    
    // Datos comunes
    const datos = {
      ...productoData,
      ultimaModificacion: serverTimestamp(),
      actualizadoPor: currentUser.uid
    };
    
    // Si hay un archivo de imagen, subirlo primero
    if (file) {
      try {
        console.log("Subiendo imagen para producto");
        // Si ya existe un producto, usamos su ID, sino generamos uno temporal
        const tempId = productoId || `temp_${Date.now()}`;
        const imageUrl = await subirImagenProducto(file, tempId);
        
        if (imageUrl) {
          console.log("Imagen subida exitosamente, URL:", imageUrl);
          
          // Si el producto ya tenía una imagen anterior y estamos reemplazándola
          if (productoData.imagenUrl && productoData.imagenUrl !== imageUrl) {
            try {
              console.log("Eliminando imagen anterior:", productoData.imagenUrl);
              await eliminarImagenProducto(productoData.imagenUrl);
            } catch (err) {
              console.warn("No se pudo eliminar la imagen anterior:", err);
              // Continuamos a pesar del error
            }
          }
          
          // Añadir la URL de la imagen a los datos
          datos.imagenUrl = imageUrl;
        } else {
          console.warn("No se pudo obtener URL de imagen");
        }
      } catch (imgError) {
        console.error("Error al procesar la imagen:", imgError);
        // Continuamos con la creación del producto sin imagen
      }
    }
    
    let id;
    
    if (productoId) {
      // Actualizar producto existente
      console.log("Actualizando producto existente:", productoId);
      const productoRef = doc(db, "productos", productoId);
      await updateDoc(productoRef, datos);
      id = productoId;
      console.log("Producto actualizado correctamente:", id);
    } else {
      // Crear nuevo producto
      console.log("Creando nuevo producto");
      datos.fechaCreacion = serverTimestamp();
      datos.creadoPor = currentUser.uid;
      
      const docRef = await addDoc(collection(db, "productos"), datos);
      id = docRef.id;
      console.log("Nuevo producto creado con ID:", id);
    }
    
    return id;
  } catch (error) {
    console.error("Error al guardar producto:", error);
    throw error;
  }
};

// Función mejorada para eliminar un producto (incluyendo su imagen)
export const eliminarProducto = async (productoId) => {
  try {
    // Primero obtener los datos del producto para ver si tiene imagen
    const productoDoc = await getDoc(doc(db, "productos", productoId));
    
    if (productoDoc.exists()) {
      const productoData = productoDoc.data();
      
      // Si el producto tiene imagen, eliminarla primero
      if (productoData.imagenUrl) {
        try {
          await eliminarImagenProducto(productoData.imagenUrl);
        } catch (err) {
          console.warn("Error al eliminar imagen del producto:", err);
          // Continuamos con la eliminación del documento aunque falle la imagen
        }
      }
    }
    
    // Eliminar el documento del producto
    await deleteDoc(doc(db, "productos", productoId));
    return true;
  } catch (error) {
    console.error("Error al eliminar producto:", error);
    throw error;
  }
};

// FUNCIONES PARA EL SISTEMA DE TAREAS

// Obtener empleados de una tienda
export const obtenerEmpleadosTienda = async (tiendaId) => {
  try {
    console.log('Obteniendo empleados para tienda:', tiendaId);
    
    // Obtener la tienda para ver sus empleados asignados
    const tiendaDoc = await getDoc(doc(db, "tiendas", tiendaId));
    
    if (!tiendaDoc.exists()) {
      console.error('No se encontró la tienda:', tiendaId);
      throw new Error('No se encontró la tienda');
    }
    
    const tiendaData = tiendaDoc.data();
    console.log('Datos de tienda recuperados:', tiendaData);
    
    // Crear array para almacenar todos los empleados
    const todosEmpleados = [];
    
    // Añadir gerente si existe
    if (tiendaData.gerente && tiendaData.gerente.id) {
      console.log('Añadiendo gerente:', tiendaData.gerente);
      todosEmpleados.push({
        ...tiendaData.gerente,
        rol: tiendaData.gerente.rol || 'gerente'
      });
    }
    
    // Añadir el creador como tipo gerente si existe
    if (tiendaData.creadoPor) {
      try {
        const creadorData = await getUserData(tiendaData.creadoPor);
        if (creadorData) {
          const creadorComoGerente = {
            id: tiendaData.creadoPor,
            nombre: creadorData.nombre || 'Creador',
            rol: creadorData.rol || 'admin'
          };
          console.log('Añadiendo creador como gerente:', creadorComoGerente);
          // Verificar que no esté duplicado
          if (!todosEmpleados.some(emp => emp.id === creadorComoGerente.id)) {
            todosEmpleados.push(creadorComoGerente);
          }
        }
      } catch (err) {
        console.warn('Error al obtener datos del creador:', err);
        // No interrumpir por esto
      }
    }
    
    // Verificar si la tienda tiene empleados configurados
    if (tiendaData.empleados && Array.isArray(tiendaData.empleados)) {
      // Filtrar empleados para eliminar valores nulos o inválidos
      const empleadosValidos = tiendaData.empleados.filter(emp => 
        emp && typeof emp === 'object' && emp.id
      );
      
      console.log('Empleados válidos encontrados:', empleadosValidos.length);
      
      // Añadir empleados válidos al array, evitando duplicados
      empleadosValidos.forEach(emp => {
        if (!todosEmpleados.some(existingEmp => existingEmp.id === emp.id)) {
          todosEmpleados.push({
            ...emp,
            rol: emp.rol || 'empleado'
          });
        }
      });
    } else {
      console.log('No hay empleados configurados en la tienda');
    }
    
    // Buscar supervisores de la colección de usuarios
    try {
      console.log('Buscando supervisores en la colección de usuarios...');
      const usuariosQuery = query(
        collection(db, "usuarios"),
        where("rol", "in", ["supervisor", "admin"])
      );
      
      const supervisoresSnapshot = await getDocs(usuariosQuery);
      
      if (!supervisoresSnapshot.empty) {
        console.log(`Se encontraron ${supervisoresSnapshot.size} supervisores/admins`);
        
        supervisoresSnapshot.forEach(doc => {
          const supervisorData = doc.data();
          if (supervisorData && !todosEmpleados.some(emp => emp.id === doc.id)) {
            todosEmpleados.push({
              id: doc.id,
              nombre: supervisorData.nombre || `${supervisorData.rol.charAt(0).toUpperCase() + supervisorData.rol.slice(1)}`,
              rol: supervisorData.rol
            });
          }
        });
      }
    } catch (err) {
      console.warn('Error al buscar supervisores:', err);
      // No interrumpir por esto
    }
    
    console.log('Total de empleados disponibles:', todosEmpleados.length);
    return todosEmpleados;
  } catch (error) {
    console.error('Error al obtener empleados de tienda:', error);
    // En caso de error, devolver array vacío para no romper la UI
    return [];
  }
};

// Obtener tareas recurrentes de una tienda
export const obtenerTareasTienda = async (tiendaId) => {
  try {
    const tareasRef = collection(db, "tiendas", tiendaId, "tareas");
    const tareasSnapshot = await getDocs(tareasRef);
    
    const tareas = [];
    let actualizaciones = [];
    
    tareasSnapshot.forEach((doc) => {
      const tareaData = doc.data();
      
      // Verificar si la tarea tiene evidencia pero no está marcada como completada
      if (tareaData.evidenceUrlPic && tareaData.estado !== 'completada') {
        console.log(`Tarea ${tareaData.id} tiene evidencia pero no está completada, actualizando...`);
        actualizaciones.push(actualizarEstadoTarea(tiendaId, tareaData.id, 'completada'));
        tareaData.estado = 'completada'; // Actualizar el estado localmente
      }
      
      tareas.push({
        id: doc.id,
        ...tareaData
      });
    });
    
    // Esperar a que se completen todas las actualizaciones de estado
    if (actualizaciones.length > 0) {
      await Promise.all(actualizaciones);
      console.log(`${actualizaciones.length} tareas actualizadas a completadas`);
    }
    
    return tareas;
  } catch (error) {
    console.error('Error al obtener tareas de la tienda:', error);
    return [];
  }
};

// Actualizar el estado de una tarea
export const actualizarEstadoTarea = async (tiendaId, tareaId, nuevoEstado) => {
  try {
    // Verificar que el estado sea válido
    const estadosValidos = ['solicitada', 'pendiente', 'enviada', 'completada'];
    if (!estadosValidos.includes(nuevoEstado)) {
      throw new Error(`Estado no válido: ${nuevoEstado}`);
    }

    // Actualizar el documento en Firestore
    await updateDoc(doc(db, "tiendas", tiendaId, "tareas", tareaId), {
      estado: nuevoEstado,
      fechaActualizacion: serverTimestamp()
    });

    console.log(`Tarea ${tareaId} actualizada a estado: ${nuevoEstado}`);
    return true;
  } catch (error) {
    console.error('Error al actualizar estado de tarea:', error);
    throw error;
  }
};

// Crear una tarea recurrente
export const crearTareaRecurrente = async (tiendaId, tareaNueva) => {
  try {
    // Generar un ID único para la tarea
    const tareaId = `tarea_${Date.now()}`;
    
    // Crear objeto para guardar en Firestore
    const tareaData = {
      ...tareaNueva,
      id: tareaId,
      tiendaId,
      fechaCreacion: serverTimestamp(),
      activa: true,
      estado: 'solicitada', // Estado inicial siempre es 'solicitada'
      evidenceUrlPic: '' // Campo para la referencia de almacenamiento
    };
    
    // Asegurarse de que siempre se use el estado "solicitada" independientemente de lo que venga en tareaNueva
    if (tareaData.estado !== 'solicitada') {
      tareaData.estado = 'solicitada';
    }
    
    // Formatear la información de asignación según corresponda
    if (tareaNueva.asignarA === 'no_agendar') {
      // Si no está asignada, asegurarse de que no haya datos de asignación
      tareaData.asignarA = 'no_agendar';
      // Eliminar cualquier campo de nombre o rol que pudiera existir
      delete tareaData.asignarNombre;
      delete tareaData.asignarRol;
    } else if (tareaNueva.asignarA === 'cualquiera') {
      // Si está asignada a cualquiera, mantener ese valor
      tareaData.asignarA = 'cualquiera';
      // Eliminar cualquier campo de nombre o rol que pudiera existir
      delete tareaData.asignarNombre;
      delete tareaData.asignarRol;
    } else if (tareaNueva.asignarA) {
      // Si está asignada a alguien específico, asegurarse de que tiene nombre y rol
      // Si no se proporcionaron en el objeto original, usar valores por defecto
      if (!tareaData.asignarNombre) {
        tareaData.asignarNombre = 'Empleado';
      }
      if (!tareaData.asignarRol) {
        tareaData.asignarRol = 'empleado';
      }
    }
    
    console.log('Creando tarea con datos:', tareaData);
    
    // Guardar en Firestore
    await setDoc(doc(db, "tiendas", tiendaId, "tareas", tareaId), tareaData);
    
    // Devolver objeto con ID generado
    return {
      id: tareaId,
      ...tareaData,
      fechaCreacion: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error al crear tarea recurrente:', error);
    throw error;
  }
};

// Eliminar una tarea recurrente
export const eliminarTareaRecurrente = async (tiendaId, tareaId) => {
  try {
    await deleteDoc(doc(db, "tiendas", tiendaId, "tareas", tareaId));
    return true;
  } catch (error) {
    console.error('Error al eliminar tarea recurrente:', error);
    throw error;
  }
};

// Completar una tarea y guardar evidencia
export const completarTarea = async (tiendaId, tareaId, datosCompletada) => {
  try {
    // Verificar si se proporcionó una foto
    let fotoUrl = datosCompletada.fotoUrl || null;
    
    // Si hay una foto como File, subirla a Storage
    if (datosCompletada.foto && datosCompletada.foto instanceof File) {
      // Crear referencia para la imagen
      const storage = getStorage();
      const fotoPath = `tiendas/${tiendaId}/tareas_completadas/${tareaId}_${Date.now()}`;
      const fotoRef = ref(storage, fotoPath);
      
      // Subir la imagen
      const uploadTask = await uploadBytesResumable(fotoRef, datosCompletada.foto);
      
      // Obtener URL de descarga
      fotoUrl = await getDownloadURL(uploadTask.ref);
      
      // Guardar la referencia de almacenamiento
      datosCompletada.evidenceUrlPic = fotoUrl;
    }
    
    // Obtener información del usuario actual para guardarla como responsable
    let responsableInfo = {
      empleadoId: datosCompletada.responsable || auth.currentUser?.uid || 'desconocido'
    };
    
    // Si tenemos un ID de empleado específico, intentar obtener sus datos
    if (responsableInfo.empleadoId && responsableInfo.empleadoId !== 'desconocido') {
      try {
        const userData = await getUserData(responsableInfo.empleadoId);
        if (userData) {
          responsableInfo.responsableNombre = userData.nombre || 'Usuario';
          responsableInfo.responsableRol = userData.rol || 'empleado';
        }
      } catch (err) {
        console.warn('Error al obtener datos del responsable:', err);
      }
    }
    
    // Obtener información adicional de la tarea original si no está en los datos completados
    let planogramaInfo = {};
    let planogramaId = null;
    
    if (datosCompletada.planogramaId) {
      planogramaId = datosCompletada.planogramaId;
      planogramaInfo = {
        planogramaId: datosCompletada.planogramaId,
        planogramaNombre: datosCompletada.planogramaNombre || 'Planograma asociado'
      };
    } else {
      // Intentar obtener de la tarea original
      try {
        const tareaDoc = await getDoc(doc(db, "tiendas", tiendaId, "tareas", tareaId));
        if (tareaDoc.exists()) {
          const tareaData = tareaDoc.data();
          if (tareaData.planogramaId) {
            planogramaId = tareaData.planogramaId;
            planogramaInfo = {
              planogramaId: tareaData.planogramaId,
              planogramaNombre: tareaData.planogramaNombre || 'Planograma asociado'
            };
          }
        }
      } catch (err) {
        console.warn('Error al obtener información de la tarea original:', err);
      }
    }
    
    // Si hay un planograma asociado, obtener la información de los productos por nivel
    let planogramData = {};
    if (planogramaId) {
      try {
        console.log('Obteniendo productos del planograma:', planogramaId);
        
        // Obtener productos organizados por nivel
        const productIdsByLevel = await planogramTaskService.getProductIdsByLevel(tiendaId, planogramaId);
        
        if (productIdsByLevel && productIdsByLevel.length > 0) {
          planogramData = {
            planogramProductIds: productIdsByLevel
          };
          console.log('Productos del planograma organizados por nivel:', JSON.stringify(productIdsByLevel));
          console.log(`Total de niveles: ${productIdsByLevel.length}, con productos: ${productIdsByLevel.flat().length}`);
        } else {
          console.warn('No se encontraron productos por nivel en el planograma');
        }
      } catch (err) {
        console.error('Error al obtener productos del planograma:', err);
      }
    }
    
    // Crear registro de tarea completada
    const tareaCompletadaId = `tarea_completada_${Date.now()}`;
    const tareaCompletadaData = {
      id: tareaCompletadaId,
      tareaId,
      tiendaId,
      fechaCompletada: serverTimestamp(),
      texto: datosCompletada.texto || '',
      fotoUrl,
      evidenceUrlPic: datosCompletada.evidenceUrlPic || fotoUrl || '',
      turno: datosCompletada.turno,
      ...responsableInfo,
      ...planogramaInfo,
      ...planogramData,
      tituloTarea: datosCompletada.tituloTarea,
      tiempoLimite: datosCompletada.tiempoLimite || 'sin_limite',
      fechaLimite: datosCompletada.fechaLimite || null
    };
    
    console.log('Guardando tarea completada con datos:', tareaCompletadaData);
    
    // Guardar en Firestore
    await setDoc(
      doc(db, "tiendas", tiendaId, "tareas_completadas", tareaCompletadaId),
      tareaCompletadaData
    );
    
    // Actualizar el estado de la tarea original a 'completada'
    await actualizarEstadoTarea(tiendaId, tareaId, 'completada');
    
    // Devolver objeto con datos de tarea completada
    return {
      ...tareaCompletadaData,
      fechaCompletada: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error al completar tarea:', error);
    throw error;
  }
};

// Obtener tareas completadas de una tienda
export const obtenerTareasCompletadas = async (tiendaId) => {
  try {
    const tareasRef = collection(db, "tiendas", tiendaId, "tareas_completadas");
    const q = query(tareasRef, orderBy("fechaCompletada", "desc"), limit(100));
    const tareasSnapshot = await getDocs(q);
    
    const tareasCompletadas = [];
    tareasSnapshot.forEach((doc) => {
      const datos = doc.data();
      
      // Convertir Timestamp a string ISO para uso en cliente
      if (datos.fechaCompletada && typeof datos.fechaCompletada.toDate === 'function') {
        datos.fechaCompletada = datos.fechaCompletada.toDate().toISOString();
      }
      
      tareasCompletadas.push({
        id: doc.id,
        ...datos
      });
    });
    
    return tareasCompletadas;
  } catch (error) {
    console.error('Error al obtener tareas completadas:', error);
    return [];
  }
};

// Función para obtener todos los planogramas de una tienda
export const obtenerPlanogramas = async (tiendaId) => {
  try {
    console.log('Obteniendo planogramas para tienda:', tiendaId);
    
    // Referencia a la colección de planogramas
    const planogramasRef = collection(db, "tiendas", tiendaId, "planogramas");
    const planogramasSnapshot = await getDocs(planogramasRef);
    
    if (planogramasSnapshot.empty) {
      console.log('No se encontraron planogramas para la tienda');
      return [];
    }
    
    const planogramas = [];
    planogramasSnapshot.forEach((doc) => {
      const planogramaData = doc.data();
      planogramas.push({
        id: doc.id,
        nombre: planogramaData.nombre || `Planograma ${doc.id.substring(0, 6)}`,
        position: planogramaData.posicion,
        size: planogramaData.tamano,
        color: planogramaData.color,
        shelves: planogramaData.shelves,
        ubicacion: planogramaData.ubicacion || 'Sin ubicación específica',
        nivelInvertido: planogramaData.nivelInvertido || false // Añadir información de niveles invertidos
      });
    });
    
    console.log(`Se encontraron ${planogramas.length} planogramas`);
    return planogramas;
  } catch (error) {
    console.error('Error al obtener planogramas:', error);
    return [];
  }
};

// FUNCIONES PARA CONFIGURACIÓN DE TAREAS AUTÁTICAS

// Crear una configuración de tarea programada
export const crearConfiguracionTarea = async (tiendaId, configuracion) => {
  try {
    // Generar un ID único para la configuración
    const configId = `config_tarea_${Date.now()}`;
    
    // Crear objeto para guardar en Firestore
    const configData = {
      ...configuracion,
      id: configId,
      tiendaId,
      fechaCreacion: serverTimestamp(),
      activa: true,
      ultimaEjecucion: null // Campo para seguimiento de última creación de tarea
    };
    
    console.log('Creando configuración de tarea automática:', configData);
    
    // Guardar en Firestore
    await setDoc(doc(db, "tiendas", tiendaId, "tareas_configuracion", configId), configData);
    
    // Devolver objeto con ID generado
    return {
      id: configId,
      ...configData,
      fechaCreacion: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error al crear configuración de tarea:', error);
    throw error;
  }
};

// Obtener configuraciones de tareas programadas de una tienda
export const obtenerConfiguracionesTareas = async (tiendaId) => {
  try {
    const configuracionesRef = collection(db, "tiendas", tiendaId, "tareas_configuracion");
    const configuracionesSnapshot = await getDocs(configuracionesRef);
    
    const configuraciones = [];
    configuracionesSnapshot.forEach((doc) => {
      const configData = doc.data();
      
      // Convertir Timestamps a strings ISO para uso en cliente
      if (configData.fechaCreacion && typeof configData.fechaCreacion.toDate === 'function') {
        configData.fechaCreacion = configData.fechaCreacion.toDate().toISOString();
      }
      if (configData.ultimaEjecucion && typeof configData.ultimaEjecucion.toDate === 'function') {
        configData.ultimaEjecucion = configData.ultimaEjecucion.toDate().toISOString();
      }
      
      configuraciones.push({
        id: doc.id,
        ...configData
      });
    });
    
    return configuraciones;
  } catch (error) {
    console.error('Error al obtener configuraciones de tareas:', error);
    return [];
  }
};

// Eliminar una configuración de tarea
export const eliminarConfiguracionTarea = async (tiendaId, configId) => {
  try {
    await deleteDoc(doc(db, "tiendas", tiendaId, "tareas_configuracion", configId));
    return true;
  } catch (error) {
    console.error('Error al eliminar configuración de tarea:', error);
    throw error;
  }
};

// Actualizar una configuración de tarea
export const actualizarConfiguracionTarea = async (tiendaId, configId, nuevaConfig) => {
  try {
    // Excluir campos que no deben actualizarse
    const { id, tiendaId: tid, fechaCreacion, ...datosActualizables } = nuevaConfig;
    
    // Actualizar en Firestore
    await updateDoc(doc(db, "tiendas", tiendaId, "tareas_configuracion", configId), {
      ...datosActualizables,
      fechaActualizacion: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    throw error;
  }
};

// Generar tareas automáticas basadas en las configuraciones
export const generarTareasAutomaticas = async (tiendaId) => {
  try {
    // Obtener todas las configuraciones activas
    const configuracionesRef = collection(db, "tiendas", tiendaId, "tareas_configuracion");
    const q = query(configuracionesRef, where("activa", "==", true));
    const configuracionesSnapshot = await getDocs(q);
    
    const ahora = new Date();
    const actualizaciones = [];
    const tareasGeneradas = [];
    
    // Procesar cada configuración
    for (const docConfig of configuracionesSnapshot.docs) {
      const config = docConfig.data();
      
      // Verificar si es momento de crear una nueva tarea según la configuración
      const debeCrearTarea = verificarCreacionTarea(config, ahora);
      
      if (debeCrearTarea) {
        try {
          // Crear una nueva tarea basada en la plantilla
          const nuevaTarea = await crearTareaDesdeConfiguracion(tiendaId, config, ahora);
          tareasGeneradas.push(nuevaTarea);
          
          // Actualizar timestamp de última ejecución
          actualizaciones.push(
            updateDoc(doc(db, "tiendas", tiendaId, "tareas_configuracion", config.id), {
              ultimaEjecucion: serverTimestamp()
            })
          );
        } catch (err) {
          console.error(`Error al crear tarea desde configuración ${config.id}:`, err);
        }
      }
    }
    
    // Esperar a que se completen todas las actualizaciones
    if (actualizaciones.length > 0) {
      await Promise.all(actualizaciones);
    }
    
    console.log(`Se generaron ${tareasGeneradas.length} tareas automáticas`);
    return tareasGeneradas;
  } catch (error) {
    console.error('Error al generar tareas automáticas:', error);
    throw error;
  }
};

// Función auxiliar para verificar si debe crearse una tarea
function verificarCreacionTarea(config, fechaActual) {
  // Si no tiene última ejecución, crear la primera tarea
  if (!config.ultimaEjecucion) return true;
  
  // Convertir última ejecución a Date si es Timestamp
  let ultimaEjecucion;
  if (typeof config.ultimaEjecucion.toDate === 'function') {
    ultimaEjecucion = config.ultimaEjecucion.toDate();
  } else {
    ultimaEjecucion = new Date(config.ultimaEjecucion);
  }
  
  // Calcular tiempo transcurrido desde la última ejecución
  const horasTranscurridas = (fechaActual - ultimaEjecucion) / (1000 * 60 * 60);
  const segundosTranscurridos = (fechaActual - ultimaEjecucion) / 1000;
  
  // Determinar frecuencia en horas o segundos
  let frecuenciaHoras;
  let frecuenciaSegundos = 0;
  
  // Agregar opción para pruebas de 10 segundos
  if (config.frecuencia === 'cada_10_segundos') {
    frecuenciaSegundos = 10;
    // Verificar si han pasado los segundos necesarios
    return segundosTranscurridos >= frecuenciaSegundos;
  } else {
    // Determinar frecuencia en horas para las opciones normales
    switch (config.frecuencia) {
      case 'diaria':
        frecuenciaHoras = 24;
        break;
      case 'semanal':
        frecuenciaHoras = 24 * 7;
        break;
      case 'quincenal':
        frecuenciaHoras = 24 * 14;
        break;
      case 'mensual':
        frecuenciaHoras = 24 * 30; // Aproximado
        break;
      default:
        frecuenciaHoras = 24; // Por defecto, diaria
    }
    
    // Si ha pasado suficiente tiempo según la frecuencia, crear tarea
    return horasTranscurridas >= frecuenciaHoras;
  }
}

// Función para crear una tarea desde una configuración
async function crearTareaDesdeConfiguracion(tiendaId, config, fechaActual) {
  // Crear objeto de tarea con los datos de la configuración
  const tareaNueva = {
    titulo: config.plantillaTitulo,
    descripcion: config.plantillaDescripcion,
    frecuencia: config.frecuencia,
    prioridad: config.prioridad || 'normal',
    requiereFoto: config.requiereFoto !== false,
    requiereTexto: config.requiereTexto !== false,
    turno: config.turno || 'todos',
    asignarA: config.asignarA || 'no_agendar',
    planogramaId: config.planogramaId || '',
    planogramaNombre: config.planogramaNombre || '',
    tiempoLimite: config.tiempoLimite || 'sin_limite',
    origenConfigId: config.id // Referencia a la configuración que generó esta tarea
  };
  
  // Si hay asignación específica, incluir datos adicionales
  if (config.asignarA && config.asignarA !== 'no_agendar' && config.asignarA !== 'cualquiera') {
    tareaNueva.asignarNombre = config.asignarNombre;
    tareaNueva.asignarRol = config.asignarRol;
  }
  
  // Calcular fecha límite basada en la configuración
  if (config.horaFinalizacion) {
    // Crear fecha límite a partir de fecha actual
    const fechaLimite = new Date(fechaActual);
    
    // Establecer hora de finalización desde la configuración
    // Formato esperado: "HH:MM" (24h)
    if (typeof config.horaFinalizacion === 'string' && config.horaFinalizacion.includes(':')) {
      const [horas, minutos] = config.horaFinalizacion.split(':').map(Number);
      fechaLimite.setHours(horas, minutos, 0, 0);
      
      // Si la hora de finalización ya pasó hoy, establecer para mañana
      if (fechaLimite <= fechaActual) {
        fechaLimite.setDate(fechaLimite.getDate() + 1);
      }
      
      tareaNueva.fechaLimite = fechaLimite.toISOString();
    }
  }
  
  // Guardar la fecha de la tarea en el título para claridad
  const fechaFormateada = fechaActual.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  
  // Añadir fecha y turno al título
  tareaNueva.titulo = `${tareaNueva.titulo} - ${fechaFormateada} - ${
    tareaNueva.turno === 'matutino' ? 'Matutino' :
    tareaNueva.turno === 'vespertino' ? 'Vespertino' :
    tareaNueva.turno === 'nocturno' ? 'Nocturno' : 'Todo el día'
  }`;
  
  // Crear la tarea en Firestore
  return await crearTareaRecurrente(tiendaId, tareaNueva);
}

// Verificar y generar tareas automáticas para todas las tiendas
export const verificarTareasAutomaticasTiendas = async () => {
  try {
    console.log('Verificando tareas automáticas para todas las tiendas...');
    
    // Obtener todas las tiendas
    const tiendasRef = collection(db, "tiendas");
    const tiendasSnapshot = await getDocs(tiendasRef);
    
    let totalTareasGeneradas = 0;
    
    // Para cada tienda, verificar y generar tareas automáticas
    for (const tiendaDoc of tiendasSnapshot.docs) {
      const tiendaId = tiendaDoc.id;
      
      try {
        // Generar tareas automáticas para esta tienda
        const tareasGeneradas = await generarTareasAutomaticas(tiendaId);
        console.log(`Tienda ${tiendaId}: generadas ${tareasGeneradas.length} tareas`);
        totalTareasGeneradas += tareasGeneradas.length;
      } catch (err) {
        console.error(`Error al generar tareas para tienda ${tiendaId}:`, err);
        // Continuar con la siguiente tienda
      }
    }
    
    console.log(`Total de tareas automáticas generadas: ${totalTareasGeneradas}`);
    return totalTareasGeneradas;
  } catch (error) {
    console.error('Error al verificar tareas automáticas:', error);
    return 0;
  }
};

// Variable para almacenar la última verificación
let ultimaVerificacionTareas = 0;

// Función para verificar si es necesario generar tareas automáticas
// Se llama cuando la aplicación arranca o cuando el usuario inicia sesión
export const verificarTareasAutomaticasSiNecesario = async () => {
  const ahora = Date.now();
  
  
  // Actualizar timestamp de última verificación
  ultimaVerificacionTareas = ahora;
  
  return await verificarTareasAutomaticasTiendas();
};

export { auth, db, storage };