import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp 
} from "firebase/firestore";
import { db, auth } from "../firebase";

/**
 * Guarda la configuración 3D de una tienda sin usar nested arrays
 * @param {string} tiendaId - ID de la tienda
 * @param {Object} configData - Datos de configuración 3D
 * @param {boolean} onlyUpdateSelectedShelf - Si es true, solo actualiza el estante enviado sin afectar otros
 * @returns {Promise<boolean>} - True si se guarda exitosamente
 */
export const saveStore3DConfiguration = async (tiendaId, configData, onlyUpdateSelectedShelf = false) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No hay un usuario autenticado.");
    }
    
    // Obtener configuración actual si solo actualizamos un estante
    let existingConfig = null;
    if (onlyUpdateSelectedShelf && configData.shelves && configData.shelves.length === 1) {
      try {
        existingConfig = await getStore3DConfiguration(tiendaId);
      } catch (err) {
        console.warn("No se pudo obtener configuración existente, creando nueva:", err);
        // Continuar con la operación a pesar del error
      }
    }
    
    // 1. Guardar configuración básica en el documento de la tienda
    const tiendaRef = doc(db, "tiendas", tiendaId);
    
    try {
      // Verificar primero si la tienda existe
      const tiendaDoc = await getDoc(tiendaRef);
      
      // Si la tienda no existe, crearla primero con datos básicos
      if (!tiendaDoc.exists()) {
        console.log(`Tienda ${tiendaId} no existe, creando documento base...`);
        await setDoc(tiendaRef, {
          nombre: `Tienda ${tiendaId}`,
          codigoTienda: `${tiendaId.substring(0, 3)}-XXX-XXX`,
          estado: "Sin definir",
          ciudad: "Sin definir",
          direccion: "Sin definir",
          createdAt: serverTimestamp(),
          activo: true
        });
      }
      
      // Ahora sí, actualizar la configuración
      const config3d = {
        storeSize: configData.storeSize || 20,
        walls: configData.walls || [],
        lastUpdated: serverTimestamp(),
        updatedBy: currentUser.uid
      };
      
      await updateDoc(tiendaRef, { config3d });
    } catch (error) {
      console.error("Error al crear/actualizar documento de tienda:", error);
      // Si falla la actualización, intentar crear el documento completo
      try {
        await setDoc(tiendaRef, {
          nombre: `Tienda ${tiendaId}`,
          codigoTienda: `${tiendaId.substring(0, 3)}-XXX-XXX`,
          estado: "Sin definir",
          ciudad: "Sin definir",
          direccion: "Sin definir", 
          config3d: {
            storeSize: configData.storeSize || 20,
            walls: configData.walls || [],
            lastUpdated: serverTimestamp(),
            updatedBy: currentUser.uid
          },
          createdAt: serverTimestamp(),
          activo: true
        });
      } catch (setDocError) {
        console.error("Error crítico al crear tienda:", setDocError);
        throw setDocError;
      }
    }
    
    // 2. Procesar cada planograma individualmente
    if (configData.shelves && configData.shelves.length > 0) {
      const planogramasRef = collection(db, "tiendas", tiendaId, "planogramas");
      
      // Si estamos actualizando solo un estante y tenemos configuración existente
      if (onlyUpdateSelectedShelf && existingConfig && existingConfig.shelves) {
        // Determinar estantes a procesar
        const shelfToUpdate = configData.shelves[0];
        
        // Solo procesar el estante enviado
        await processShelf(planogramasRef, shelfToUpdate, currentUser);
      } else {
        // Procesar todos los estantes normalmente
        for (const shelf of configData.shelves) {
          await processShelf(planogramasRef, shelf, currentUser);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error("Error al guardar configuración 3D:", error);
    throw error;
  }
};

/**
 * Función auxiliar para procesar un solo estante
 * @private
 */
async function processShelf(planogramasRef, shelf, currentUser) {
  const shelfId = shelf.id;
  
  // Verificar si el estante ya existe
  let shelfDoc = null;
  try {
    const docRef = doc(planogramasRef, shelfId);
    shelfDoc = await getDoc(docRef);
  } catch (error) {
    console.error("Error al verificar estante:", error);
  }
  
  // Crear datos del estante
  const shelfData = {
    id: shelfId,
    nombre: shelf.name,
    posicion: shelf.position || [0, 0, 0],
    tamano: shelf.size || [2, 1.5, 0.6],
    rotacion: shelf.rotation || [0, 0, 0],
    color: shelf.color || "#b5a642",
    nivelesTotales: shelf.shelves.length,
    maxProductsPerShelf: shelf.maxProductsPerShelf || 30,
    configuracionGuardada: shelf.configuracionGuardada || true,
    ultimaModificacion: serverTimestamp(),
    actualizadoPor: currentUser.uid
  };
  
  // Mantener el planogramImageUrl si ya existe o añadirlo si está disponible en el shelf
  if (shelfDoc && shelfDoc.exists() && shelfDoc.data().planogramImageUrl) {
    shelfData.planogramImageUrl = shelfDoc.data().planogramImageUrl;
    // Mantener compatibilidad con ambos nombres de campo
    shelfData.planogramaImagenUrl = shelfDoc.data().planogramImageUrl;
  }
  
  // Si el shelf tiene una imagen de planograma, añadirla
  if (shelf.planogramImageUrl) {
    shelfData.planogramImageUrl = shelf.planogramImageUrl;
    // Mantener compatibilidad con ambos nombres de campo
    shelfData.planogramaImagenUrl = shelf.planogramImageUrl;
  }
  
  // Guardar datos del estante
  await setDoc(doc(planogramasRef, shelfId), shelfData);
  
  // Crear referencia para niveles del estante
  const nivelesRef = collection(planogramasRef, shelfId, "niveles");
  
  // Procesar cada nivel del estante
  for (let levelIndex = 0; levelIndex < shelf.shelves.length; levelIndex++) {
    const level = shelf.shelves[levelIndex];
    
    // Determinar número máximo de productos para este nivel
    let maxForLevel = shelf.maxProductsPerShelf || 30;
    if (shelf.maxProductsPerLevel && shelf.maxProductsPerLevel[levelIndex] !== undefined) {
      maxForLevel = shelf.maxProductsPerLevel[levelIndex];
    }
    
    // Preparar array de productos para este nivel
    const productos = [];
    
    // 5. Procesar productos de este nivel
    if (level && Array.isArray(level)) {
      for (let productIndex = 0; productIndex < level.length; productIndex++) {
        const product = level[productIndex];
        
        if (product) {
          // Calcular posición 3D relativa del producto
          const shelfSize = shelf.size || [1, 1, 1];
          const maxProducts = maxForLevel;
          
          // Calcular grid para distribución
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
          
          // Crear objeto de producto para guardar
          const productoData = {
            id: product.id, // ID único del producto para identificarlo
            nombre: product.name,
            color: product.color,
            posicionEnNivel: productIndex,
            gridPosition: product.gridPosition || productIndex,
            productoId: product.id,
            categoria: product.category || 'Sin categoría',
            tamano: product.size || [0.1, 0.1, 0.1],
            imagenUrl: product.imagenUrl || '',
            posicion: [productX, levelY, productZ],
            guardadoEnNivel: true
          };
          
          // Añadir a la lista de productos para este nivel
          productos.push(productoData);
        }
      }
    }
    
    // 6. Guardar configuración completa del nivel con sus productos
    const nivelData = {
      indice: levelIndex,
      maxProductos: maxForLevel,
      cantidadProductos: productos.length,
      productos: productos, // Incluir productos directamente en el documento del nivel
      ultimaModificacion: serverTimestamp()
    };
    
    await setDoc(doc(nivelesRef, `nivel_${levelIndex}`), nivelData);
  }
  
  // 7. Guardar productos individuales que no estén en niveles (libres)
  if (shelf.products && shelf.products.length > 0) {
    const productosLibres = [];
    
    for (const product of shelf.products) {
      if (!product.guardadoEnNivel) {
        const productoData = {
          id: product.id,
          nombre: product.name,
          color: product.color,
          posicion: product.position,
          tamano: product.size,
          productoId: product.id,
          categoria: product.category || 'Sin categoría',
          imagenUrl: product.imagenUrl || '',
          guardadoEnNivel: false
        };
        
        productosLibres.push(productoData);
      }
    }
    
    // Guardar productos libres en un documento especial
    if (productosLibres.length > 0) {
      await setDoc(doc(nivelesRef, "productos_libres"), {
        productos: productosLibres,
        ultimaModificacion: serverTimestamp()
      });
    }
  }
}

/**
 * Obtiene la configuración 3D de una tienda reconstruyendo la estructura correcta
 * @param {string} tiendaId - ID de la tienda
 * @returns {Promise<Object>} - Configuración 3D completa
 */
export const getStore3DConfiguration = async (tiendaId) => {
  try {
    const tiendaRef = doc(db, "tiendas", tiendaId);
    
    // Verificar si la tienda existe
    let tiendaDoc;
    try {
      tiendaDoc = await getDoc(tiendaRef);
    } catch (error) {
      console.error("Error al obtener documento de tienda:", error);
      // Si no se puede obtener el documento, devolver una configuración por defecto
      return {
        storeSize: 20,
        walls: [],
        shelves: [],
        products: []
      };
    }
    
    // Si la tienda no existe, devolver una configuración por defecto
    if (!tiendaDoc.exists()) {
      console.log(`La tienda ${tiendaId} no existe, devolviendo configuración por defecto.`);
      return {
        storeSize: 20,
        walls: [],
        shelves: [],
        products: []
      };
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
    
    // Obtener todos los planogramas de la tienda
    let planogramasSnapshot;
    const planogramasRef = collection(db, "tiendas", tiendaId, "planogramas");
    
    try {
      planogramasSnapshot = await getDocs(planogramasRef);
    } catch (error) {
      console.error("Error al obtener planogramas:", error);
      // Si falla al obtener planogramas, devolver solo la configuración básica
      return {
        storeSize: tiendaData.config3d.storeSize || 20,
        walls: tiendaData.config3d.walls || [],
        shelves: [], // Sin planogramas
        lastUpdated: tiendaData.config3d.lastUpdated
      };
    }
    
    const shelves = [];
    
    // Procesar cada planograma
    for (const planogramaDoc of planogramasSnapshot.docs) {
      try {
        const planogramaData = planogramaDoc.data();
        
        // Obtener configuración de niveles
        let nivelesSnapshot;
        const nivelesRef = collection(planogramaDoc.ref, "niveles");
        
        try {
          nivelesSnapshot = await getDocs(nivelesRef);
        } catch (error) {
          console.warn(`Error al obtener niveles del planograma ${planogramaDoc.id}:`, error);
          // Continuar con el siguiente planograma
          continue;
        }
        
        // Crear un mapa de configuraciones de nivel
        const nivelesConfig = {};
        nivelesSnapshot.forEach(nivelDoc => {
          const nivelData = nivelDoc.data();
          if (nivelDoc.id !== "productos_libres") {
            nivelesConfig[nivelData.indice] = nivelData;
          }
        });
        
        // Determinar número de niveles
        const nivelesTotales = planogramaData.nivelesTotales || 1;
        
        // Preparar array para los niveles
        const levels = Array(nivelesTotales).fill().map(() => []);
        
        // Crear array maxProductsPerLevel
        const maxProductsPerLevel = [];
        for (let i = 0; i < nivelesTotales; i++) {
          const nivelConfig = nivelesConfig[i];
          maxProductsPerLevel[i] = nivelConfig ? nivelConfig.maxProductos : (planogramaData.maxProductsPerShelf || 30);
        }
        
        // Productos libres (no asignados a niveles)
        const freeProducts = [];
        
        // Procesar productos de cada nivel
        for (const nivelDoc of nivelesSnapshot.docs) {
          const nivelData = nivelDoc.data();
          
          if (nivelDoc.id === "productos_libres") {
            // Procesar productos libres
            if (nivelData.productos && Array.isArray(nivelData.productos)) {
              nivelData.productos.forEach(productoData => {
                const product = {
                  id: productoData.id,
                  name: productoData.nombre,
                  color: productoData.color,
                  position: productoData.posicion,
                  size: productoData.tamano,
                  category: productoData.categoria || 'Sin categoría',
                  productoId: productoData.productoId,
                  imagenUrl: productoData.imagenUrl || '',
                  guardadoEnNivel: false
                };
                
                freeProducts.push(product);
              });
            }
          } else if (nivelData.indice !== undefined) {
            // Procesar productos del nivel
            const levelIndex = nivelData.indice;
            
            if (nivelData.productos && Array.isArray(nivelData.productos)) {
              nivelData.productos.forEach(productoData => {
                const product = {
                  id: productoData.id,
                  name: productoData.nombre,
                  color: productoData.color,
                  position: productoData.posicion,
                  size: productoData.tamano,
                  category: productoData.categoria || 'Sin categoría',
                  productoId: productoData.productoId,
                  imagenUrl: productoData.imagenUrl || '',
                  gridPosition: productoData.gridPosition !== undefined ? productoData.gridPosition : productoData.posicionEnNivel,
                  nivelEstante: levelIndex,
                  posicionEnNivel: productoData.posicionEnNivel,
                  guardadoEnNivel: true
                };
                
                // Asegurar que existe el array para este nivel
                if (!levels[levelIndex]) {
                  levels[levelIndex] = [];
                }
                
                // Añadir el producto a su posición en el nivel
                const posIndex = productoData.posicionEnNivel;
                levels[levelIndex][posIndex] = product;
              });
            }
          }
        }
        
        // Reemplazar valores undefined con null en arrays de niveles
        for (let i = 0; i < levels.length; i++) {
          if (levels[i]) {
            for (let j = 0; j < levels[i].length; j++) {
              if (levels[i][j] === undefined) {
                levels[i][j] = null;
              }
            }
          }
        }
        
        // Construir objeto del estante con todos los datos
        const shelf = {
          id: planogramaDoc.id,
          name: planogramaData.nombre || `Estante ${planogramaDoc.id}`,
          position: planogramaData.posicion || [0, 0, 0],
          size: planogramaData.tamano || [2, 1.5, 0.6],
          rotation: planogramaData.rotacion || [0, 0, 0],
          color: planogramaData.color || "#b5a642",
          products: freeProducts,
          shelves: levels,
          maxProductsPerShelf: planogramaData.maxProductsPerShelf || 30,
          maxProductsPerLevel: maxProductsPerLevel,
          configuracionGuardada: planogramaData.configuracionGuardada || false,
          // Añadir referencia a imagen de planograma si existe
          planogramImageUrl: planogramaData.planogramImageUrl || planogramaData.planogramaImagenUrl || null,
          planogramaImagenUrl: planogramaData.planogramaImagenUrl || planogramaData.planogramImageUrl || null
        };
        
        shelves.push(shelf);
      } catch (error) {
        console.error(`Error al procesar planograma ${planogramaDoc.id}:`, error);
        // Continuar con el siguiente planograma
        continue;
      }
    }
    
    return {
      storeSize: tiendaData.config3d.storeSize || 20,
      walls: tiendaData.config3d.walls || [],
      shelves: shelves,
      lastUpdated: tiendaData.config3d.lastUpdated
    };
  } catch (error) {
    console.error("Error al obtener configuración 3D:", error);
    // En caso de error general, devolver una configuración por defecto
    return {
      storeSize: 20,
      walls: [],
      shelves: [],
      products: []
    };
  }
};

/**
 * Elimina un planograma y todas sus subcolecciones
 * @param {string} tiendaId - ID de la tienda
 * @param {string} planogramaId - ID del planograma
 * @returns {Promise<boolean>} - True si se elimina correctamente
 */
export const deletePlanogram = async (tiendaId, planogramaId) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No hay un usuario autenticado.");
    }
    
    // Referencia al planograma
    const planogramaRef = doc(db, "tiendas", tiendaId, "planogramas", planogramaId);
    
    // Verificar si existe
    const planogramaDoc = await getDoc(planogramaRef);
    if (!planogramaDoc.exists()) {
      console.warn("El planograma no existe o ya fue eliminado.");
      return true;
    }
    
    // 1. Eliminar niveles
    const nivelesRef = collection(planogramaRef, "niveles");
    const nivelesSnapshot = await getDocs(nivelesRef);
    const deleteNivelesPromises = nivelesSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deleteNivelesPromises);
    
    // 2. Eliminar el planograma
    await deleteDoc(planogramaRef);
    
    return true;
  } catch (error) {
    console.error("Error al eliminar planograma:", error);
    throw error;
  }
};

// Función para guardar un documento específico en una colección
export const saveStore3DConfigurationDoc = async (collection, docId, data) => {
  try {
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase');
    
    // Referenciar el documento específico en la colección
    const docRef = doc(db, collection, docId);
    
    // Guardar el documento
    await setDoc(docRef, data);
    
    return { success: true };
  } catch (error) {
    console.error(`Error al guardar en colección ${collection}:`, error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

// Función para guardar un documento en una ruta específica usando setDoc
export const saveStore3DConfigurationNewDoc = async (collectionPath, docId, data) => {
  try {
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
    const { db, auth } = await import('../firebase');
    
    // Verificar autenticación
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.warn("No hay un usuario autenticado, pero intentando guardar de todos modos");
    }
    
    // Añadir metadatos
    const dataWithMeta = {
      ...data,
      ultimaModificacion: serverTimestamp(),
      actualizadoPor: currentUser?.uid || 'unknown_user'
    };
    
    // Referenciar el documento específico en la ruta indicada
    const docRef = doc(db, collectionPath, docId);
    
    // Guardar el documento usando setDoc (crea o actualiza)
    await setDoc(docRef, dataWithMeta);
    
    return { success: true, id: docId };
  } catch (error) {
    console.error(`Error al guardar en ${collectionPath}/${docId}:`, error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

export default {
  saveStore3DConfiguration,
  getStore3DConfiguration,
  deletePlanogram,
  saveStore3DConfigurationDoc,
  saveStore3DConfigurationNewDoc
}; 