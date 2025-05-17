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
      rol: 'usuario', // Por defecto es usuario normal
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
        
        // Prepare shelf data to save to Firestore
        const shelfData = {
          nombre: shelf.name,
          posicion: shelf.position,
          tamano: shelf.size,
          rotacion: shelf.rotation,
          color: shelf.color,
          ultimaModificacion: serverTimestamp(),
          actualizadoPor: currentUser.uid,
          // Add the new properties for shelf configuration:
          shelves: shelf.shelves || [[]],  // Array of arrays for shelf levels
          maxProductsPerShelf: shelf.maxProductsPerShelf || 30,
          maxProductsPerLevel: shelf.maxProductsPerLevel || [], // Nuevo: guardar los límites por nivel
          configuracionGuardada: true // Indicador de que la configuración fue guardada correctamente
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

        // Procesamos los productos en cada nivel del estante
        if (shelf.shelves && Array.isArray(shelf.shelves)) {
          for (let levelIndex = 0; levelIndex < shelf.shelves.length; levelIndex++) {
            const level = shelf.shelves[levelIndex];
            
            if (level && Array.isArray(level)) {
              // Calcular configuración específica para este nivel
              const levelConfig = {
                maxProducts: shelf.maxProductsPerLevel && shelf.maxProductsPerLevel[levelIndex] 
                  ? shelf.maxProductsPerLevel[levelIndex] 
                  : shelf.maxProductsPerShelf || 30
              };
              
              // Guardar la configuración del nivel
              await setDoc(
                doc(shelfRef, "niveles", `nivel_${levelIndex}`), 
                {
                  indice: levelIndex,
                  maxProductos: levelConfig.maxProducts,
                  cantidadProductos: level.length,
                  ultimaModificacion: serverTimestamp()
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
    
                  // Calcular posición 3D relativa del producto en el estante (necesario para visualización 3D)
                  const shelfSize = shelf.size || [1, 1, 1];
                  const totalProducts = level.length;
                  const maxProducts = shelf.maxProductsPerLevel && shelf.maxProductsPerLevel[levelIndex] 
                    ? shelf.maxProductsPerLevel[levelIndex] 
                    : (shelf.maxProductsPerShelf || 30);
                  
                  // Calcular grid para distribución de productos
                  const gridCols = Math.min(10, maxProducts);
                  const gridRows = Math.ceil(maxProducts / gridCols);
                  
                  const productWidth = shelfSize[0] / gridCols;
                  const productDepth = shelfSize[2] / gridRows;
                  
                  const col = productIndex % gridCols;
                  const row = Math.floor(productIndex / gridCols);
                  
                  const shelfHeight = shelfSize[1] / shelf.shelves.length;
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
        configuracionGuardada: planogramaData.configuracionGuardada || false
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
      configuracionGuardada: planogramaData.configuracionGuardada || false
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

export { auth, db, storage };