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
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA2UPFXjD963tlAlcPB7gZyXAaRqZJWZaI",
  authDomain: "myoxxovision.firebaseapp.com",
  projectId: "myoxxovision",
  storageBucket: "myoxxovision.appspot.com",
  messagingSenderId: "491253915189",
  appId: "1:491253915189:web:aa9c56c0ce6c6a090c5b7c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Función simplificada para registrar un nuevo usuario
export const registerUser = async (email, password, userData) => {
  try {
    // Verificar si es el primer usuario (será admin)
    const usersRef = collection(db, "users");
    const q = query(usersRef, limit(1));
    const querySnapshot = await getDocs(q);
    
    // Si no hay usuarios, asignar rol de admin
    const isFirstUser = querySnapshot.empty;
    const userRole = isFirstUser ? 'admin' : (userData.rol || 'usuario');
    
    // Crear usuario en Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Datos a guardar en Firestore
    const userDataToSave = {
      uid: user.uid,
      email: user.email,
      ...userData,
      rol: userRole, // Usar admin si es el primer usuario
      createdAt: serverTimestamp()
    };
    
    // Guardar datos adicionales en Firestore
    await setDoc(doc(db, "users", user.uid), userDataToSave);
    
    // Guardar datos en localStorage para persistencia
    localStorage.setItem('oxxoSessionToken', 'true');
    localStorage.setItem('oxxoUserId', user.uid);
    localStorage.setItem('oxxoUserRole', userRole);
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
    
    // Añadir el código y gerente a los datos de la tienda
    const tiendaCompleta = {
      ...datosTienda,
      codigoTienda,
      fechaRegistro: serverTimestamp(),
      creadoPor: currentUser.uid,
      gerente: gerente // Añadir la información del gerente
    };
    
    // Agregar la tienda a Firestore
    const docRef = await addDoc(collection(db, "tiendas"), tiendaCompleta);
    console.log("Tienda registrada con ID:", docRef.id);
    
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
    // Verificar que el usuario esté autenticado
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No hay un usuario autenticado.");
    }
    
    // Verificar si la tienda existe
    const tiendaRef = doc(db, "tiendas", tiendaId);
    const tiendaDoc = await getDoc(tiendaRef);
    
    if (!tiendaDoc.exists()) {
      throw new Error("La tienda no existe.");
    }
    
    // Preparar datos de la configuración 3D
    const configToSave = {
      storeSize: configData.storeSize || 20,
      walls: configData.walls || [],
      ultimaModificacion: serverTimestamp(),
      actualizadoPor: currentUser.uid
    };
    
    // Si es una configuración nueva, agregar fecha de creación y creador
    if (!tiendaDoc.data().config3d) {
      configToSave.fechaCreacion = serverTimestamp();
      configToSave.creadoPor = currentUser.uid;
    }
    
    // Actualizar la configuración 3D en la tienda
    await updateDoc(tiendaRef, {
      config3d: configToSave,
      ultimaModificacion: serverTimestamp()
    });
    
    // Guardar planogramas (estantes)
    if (configData.shelves && configData.shelves.length > 0) {
      // Guardar cada estante como un planograma
      for (const shelf of configData.shelves) {
        await guardarPlanograma(tiendaId, {
          id: shelf.id,
          nombre: shelf.name,
          posicion: shelf.position,
          tamano: shelf.size,
          rotacion: shelf.rotation,
          color: shelf.color,
          productos: shelf.products || []
        });
      }
    }
    
    return tiendaId;
  } catch (error) {
    console.error("Error al guardar configuración 3D:", error);
    throw error;
  }
};

// Función para guardar un planograma (estante)
export const guardarPlanograma = async (tiendaId, planogramaData) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No hay un usuario autenticado.");
    }
    
    // Referencia a la colección de planogramas de la tienda
    const planogramasRef = collection(db, "tiendas", tiendaId, "planogramas");
    
    // Verificar si el planograma ya existe
    let planogramaRef;
    if (planogramaData.id) {
      planogramaRef = doc(planogramasRef, planogramaData.id);
      
      // Verificar si el planograma existe
      const planogramaDoc = await getDoc(planogramaRef);
      
      // Datos a guardar
      const dataToSave = {
        nombre: planogramaData.nombre,
        posicion: planogramaData.posicion,
        tamano: planogramaData.tamano,
        rotacion: planogramaData.rotacion,
        color: planogramaData.color,
        ultimaModificacion: serverTimestamp(),
        actualizadoPor: currentUser.uid
      };
      
      // Si el planograma existe, actualizarlo
      if (planogramaDoc.exists()) {
        await updateDoc(planogramaRef, dataToSave);
      } else {
        // Si no existe, crearlo
        dataToSave.fechaCreacion = serverTimestamp();
        dataToSave.creadoPor = currentUser.uid;
        await setDoc(planogramaRef, dataToSave);
      }
    } else {
      // Crear un nuevo planograma
      const dataToSave = {
        nombre: planogramaData.nombre,
        posicion: planogramaData.posicion,
        tamano: planogramaData.tamano,
        rotacion: planogramaData.rotacion,
        color: planogramaData.color,
        fechaCreacion: serverTimestamp(),
        ultimaModificacion: serverTimestamp(),
        creadoPor: currentUser.uid,
        actualizadoPor: currentUser.uid
      };
      
      // Crear documento con ID automático
      planogramaRef = await addDoc(planogramasRef, dataToSave);
    }
    
    // Guardar productos del planograma si existen
    if (planogramaData.productos && planogramaData.productos.length > 0) {
      const productosRef = collection(planogramaRef, "productos");
      
      // Eliminar productos anteriores
      const productosSnapshot = await getDocs(productosRef);
      const deletePromises = [];
      productosSnapshot.forEach((doc) => {
        deletePromises.push(deleteDoc(doc.ref));
      });
      await Promise.all(deletePromises);
      
      // Guardar nuevos productos
      const savePromises = [];
      for (const producto of planogramaData.productos) {
        const productoId = producto.id || generateId("producto");
        savePromises.push(
          setDoc(doc(productosRef, productoId), {
            ...producto,
            fechaCreacion: serverTimestamp()
          })
        );
      }
      await Promise.all(savePromises);
    }
    
    return planogramaRef.id;
  } catch (error) {
    console.error("Error al guardar planograma:", error);
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
    planogramasSnapshot.forEach((doc) => {
      const planogramaData = doc.data();
      
      // Convertir el planograma a formato de estante para el editor 3D
      shelves.push({
        id: doc.id,
        name: planogramaData.nombre,
        position: planogramaData.posicion,
        size: planogramaData.tamano,
        rotation: planogramaData.rotacion,
        color: planogramaData.color,
        products: planogramaData.productos || []
      });
    });
    
    // Construir y devolver la configuración completa
    return {
      storeSize: tiendaData.config3d.storeSize || 20,
      walls: tiendaData.config3d.walls || [],
      shelves: shelves,
      products: []
    };
  } catch (error) {
    console.error("Error al obtener configuración 3D:", error);
    return {
      storeSize: 20,
      walls: [],
      shelves: [],
      products: []
    };
  }
};

// Función para obtener un planograma específico
export const obtenerPlanograma = async (tiendaId, planogramaId) => {
  try {
    const planogramaDoc = await getDoc(doc(db, "tiendas", tiendaId, "planogramas", planogramaId));
    
    if (!planogramaDoc.exists()) {
      return null;
    }
    
    // Obtener los productos del planograma
    const productosRef = collection(db, "tiendas", tiendaId, "planogramas", planogramaId, "productos");
    const productosSnapshot = await getDocs(productosRef);
    
    const productos = [];
    productosSnapshot.forEach((doc) => {
      productos.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return {
      id: planogramaDoc.id,
      ...planogramaDoc.data(),
      productos
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
    
    // Primero eliminar los productos del planograma
    const productosRef = collection(planogramaRef, "productos");
    const productosSnapshot = await getDocs(productosRef);
    const deletePromises = [];
    productosSnapshot.forEach((doc) => {
      deletePromises.push(deleteDoc(doc.ref));
    });
    await Promise.all(deletePromises);
    
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

export { auth, db };