// Utilidades para actualizar el stock de productos en las tiendas

import { 
  db, 
  obtenerTiendas, 
  obtenerProductos,
  actualizarTienda
} from '../firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

/**
 * Genera un valor de stock aleatorio entre un mínimo y máximo
 * @param {number} min - Valor mínimo del stock
 * @param {number} max - Valor máximo del stock
 * @returns {number} - Valor de stock generado
 */
const generarStockAleatorio = (min = 0, max = 30) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Actualiza el stock de todos los productos en todas las tiendas
 * @returns {Promise<{success: boolean, message: string, tiendas: Array}>}
 */
export const actualizarStockTiendas = async () => {
  try {
    console.log("Iniciando actualización de stock en tiendas...");
    
    // Obtener todas las tiendas
    const tiendas = await obtenerTiendas();
    if (!tiendas || tiendas.length === 0) {
      return { success: false, message: "No se encontraron tiendas para actualizar", tiendas: [] };
    }
    
    // Obtener todos los productos
    const productos = await obtenerProductos();
    if (!productos || productos.length === 0) {
      return { success: false, message: "No se encontraron productos para actualizar stock", tiendas: [] };
    }
    
    console.log(`Actualizando stock en ${tiendas.length} tiendas para ${productos.length} productos`);
    
    // Para cada tienda, actualizar el stock de productos
    const tiendasActualizadas = [];
    
    for (const tienda of tiendas) {
      try {
        // Crear objeto de productos con stock
        const inventarioProductos = {};
        
        // Para cada producto, generar stock aleatorio
        for (const producto of productos) {
          const stockAleatorio = generarStockAleatorio(5, 50);
          
          // Estructura simplificada: solo nombre, precio, productoId y stock
          inventarioProductos[producto.id] = {
            productoId: producto.id,
            nombre: producto.nombre,
            precio: producto.precio || 0,
            stock: stockAleatorio
          };
        }
        
        // Actualizar documento de la tienda con los productos y stock
        await updateDoc(doc(db, "tiendas", tienda.id), {
          inventarioProductos: inventarioProductos,
          tieneInventario: true,
          cantidadProductos: productos.length,
          ultimaActualizacionInventario: new Date().toISOString()
        });
        
        tiendasActualizadas.push({
          id: tienda.id,
          nombre: tienda.nombre,
          productosActualizados: productos.length
        });
        
        console.log(`✅ Tienda actualizada: ${tienda.nombre} (${tienda.id}) - ${productos.length} productos`);
      } catch (error) {
        console.error(`Error al actualizar tienda ${tienda.id}:`, error);
      }
    }
    
    return { 
      success: true, 
      message: `Stock actualizado en ${tiendasActualizadas.length} tiendas correctamente`, 
      tiendas: tiendasActualizadas 
    };
  } catch (error) {
    console.error("Error al actualizar stock de tiendas:", error);
    return { success: false, message: `Error: ${error.message}`, tiendas: [] };
  }
};

/**
 * Verifica si una tienda tiene inventario configurado
 * @param {string} tiendaId - ID de la tienda a verificar
 * @returns {Promise<boolean>} - true si la tienda tiene inventario
 */
export const verificarInventarioTienda = async (tiendaId) => {
  try {
    const tiendaDoc = await getDoc(doc(db, "tiendas", tiendaId));
    if (tiendaDoc.exists()) {
      const tiendaData = tiendaDoc.data();
      return !!tiendaData.inventarioProductos && Object.keys(tiendaData.inventarioProductos).length > 0;
    }
    return false;
  } catch (error) {
    console.error("Error al verificar inventario:", error);
    return false;
  }
};

/**
 * Obtiene el inventario de productos de una tienda
 * @param {string} tiendaId - ID de la tienda
 * @returns {Promise<Array>} - Array de productos con su stock
 */
export const obtenerInventarioTienda = async (tiendaId) => {
  try {
    const tiendaDoc = await getDoc(doc(db, "tiendas", tiendaId));
    if (tiendaDoc.exists()) {
      const tiendaData = tiendaDoc.data();
      
      if (tiendaData.inventarioProductos) {
        // Convertir objeto a array para facilitar su uso
        return Object.entries(tiendaData.inventarioProductos).map(([id, producto]) => ({
          id,
          ...producto
        }));
      }
    }
    return [];
  } catch (error) {
    console.error("Error al obtener inventario:", error);
    return [];
  }
};

/**
 * Actualiza el stock de un producto específico en una tienda
 * @param {string} tiendaId - ID de la tienda
 * @param {string} productoId - ID del producto
 * @param {number} nuevoStock - Nuevo valor de stock
 * @returns {Promise<boolean>} - true si se actualizó correctamente
 */
export const actualizarStockProducto = async (tiendaId, productoId, nuevoStock) => {
  try {
    const tiendaDoc = await getDoc(doc(db, "tiendas", tiendaId));
    if (!tiendaDoc.exists()) return false;
    
    const tiendaData = tiendaDoc.data();
    const inventarioProductos = tiendaData.inventarioProductos || {};
    
    if (!inventarioProductos[productoId]) return false;
    
    // Actualizar solo el stock del producto específico
    inventarioProductos[productoId] = {
      ...inventarioProductos[productoId],
      stock: nuevoStock
    };
    
    // Actualizar el documento de la tienda
    await updateDoc(doc(db, "tiendas", tiendaId), {
      inventarioProductos: inventarioProductos,
      ultimaActualizacionInventario: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error("Error al actualizar stock de producto:", error);
    return false;
  }
}; 