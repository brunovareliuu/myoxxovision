import { doc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Service for handling planogram-related tasks
 */
class PlanogramTaskService {
  /**
   * Extracts product IDs from a planogram organized by shelf levels
   * Returns a nested array with levels in reverse order - the highest level is first
   * and the bottom shelf (level 0) is the last element in the array
   * 
   * @param {string} tiendaId - ID of the store
   * @param {string} planogramaId - ID of the planogram
   * @returns {Promise<Array<Array<string>>>} - Nested array of product IDs organized by level (reversed)
   */
  async getProductIdsByLevel(tiendaId, planogramaId) {
    try {
      console.log(`Getting products for planogram: ${planogramaId} in store: ${tiendaId}`);
      console.log('NOTE: Now prioritizing barcode field, then id, then productoId for products');
      
      // First attempt: Get products from niveles collection
      const productsByLevel = await this.getProductsFromNiveles(tiendaId, planogramaId);
      
      // If no products found in niveles, try the productos collection as fallback
      if (Object.keys(productsByLevel.levels).length === 0) {
        console.log('No products found in niveles, trying productos collection as fallback');
        return await this.getProductsFromProductos(tiendaId, planogramaId);
      }
      
      // Get sorted level indices in DESCENDING order (highest level first)
      const levelIndices = Object.keys(productsByLevel.levels)
        .map(Number)
        .sort((a, b) => b - a); // Sort in descending order
      
      console.log(`Level indices in descending order:`, levelIndices);
      
      // Create result array with entries for each level in reverse order (highest level first)
      const result = levelIndices.map(levelIndex => productsByLevel.levels[levelIndex] || []);
      
      console.log(`Final result array (highest level first, level 0 last):`, JSON.stringify(result, null, 2));
      
      return result;
    } catch (error) {
      console.error('Error getting products by level:', error);
      return [];
    }
  }
  
  /**
   * Gets products organized by level from the niveles collection
   * 
   * @private
   * @param {string} tiendaId - ID of the store
   * @param {string} planogramaId - ID of the planogram
   * @returns {Promise<Object>} - Object with levels and maxLevel
   */
  async getProductsFromNiveles(tiendaId, planogramaId) {
    try {
      // Get niveles collection reference (contains level configuration and products)
      const nivelesRef = collection(db, "tiendas", tiendaId, "planogramas", planogramaId, "niveles");
      const nivelesSnapshot = await getDocs(nivelesRef);
      
      if (nivelesSnapshot.empty) {
        console.log('No niveles found in planogram');
        return { levels: {}, maxLevel: 0 };
      }
      
      console.log(`Found ${nivelesSnapshot.size} niveles in planogram`);
      
      // Organize products by level
      const productsByLevel = {};
      let maxLevel = 0;
      
      // Process each nivel document
      nivelesSnapshot.forEach(nivelDoc => {
        // Skip special documents (like "productos_libres")
        if (nivelDoc.id === "productos_libres") return;
        
        const nivelData = nivelDoc.data();
        console.log(`Processing nivel: ${nivelDoc.id}`);
        
        // Extract nivel index (level number)
        const levelIndex = nivelData.indice !== undefined ? nivelData.indice : 
                          (nivelDoc.id.startsWith('nivel_') ? parseInt(nivelDoc.id.replace('nivel_', '')) : null);
        
        if (levelIndex === null) {
          console.log(`Skipping nivel with no valid index: ${nivelDoc.id}`);
          return;
        }
        
        maxLevel = Math.max(maxLevel, levelIndex);
        
        // Create array for this level
        if (!productsByLevel[levelIndex]) {
          productsByLevel[levelIndex] = [];
        }
        
        // Case 1: Check if productos is an array of objects with productoId property
        if (nivelData.productos && Array.isArray(nivelData.productos) && 
            nivelData.productos.length > 0 && typeof nivelData.productos[0] === 'object') {
          
          console.log(`Nivel ${levelIndex} has ${nivelData.productos.length} product objects`);
          
          // Extract product IDs from each product in the array
          nivelData.productos.forEach(producto => {
            // Prioritize barcode if available, otherwise fall back to productoId or id
            const productId = producto.barcode || producto.id || producto.productoId;
            if (productId) {
              // Log which field was used
              if (producto.barcode) {
                console.log(`Using barcode (${productId}) for product in nivel ${levelIndex}`);
              } else if (producto.id) {
                console.log(`Using id (${productId}) for product in nivel ${levelIndex}`);
              } else {
                console.log(`Using productoId (${productId}) for product in nivel ${levelIndex}`);
              }
              productsByLevel[levelIndex].push(productId);
            }
          });
        } 
        // Case 2: Check if productos is a direct array of product ID strings
        else if (nivelData.productos && Array.isArray(nivelData.productos) && 
                nivelData.productos.length > 0 && typeof nivelData.productos[0] === 'string') {
          
          console.log(`Nivel ${levelIndex} has ${nivelData.productos.length} product IDs as strings`);
          
          // Add each product ID string directly to the level array
          nivelData.productos.forEach(productoId => {
            if (productoId && typeof productoId === 'string') {
              productsByLevel[levelIndex].push(productoId);
            }
          });
        }
        // Case 3: Check for a flat property that might contain product IDs
        else if (nivelData.productosIds && Array.isArray(nivelData.productosIds)) {
          console.log(`Nivel ${levelIndex} has ${nivelData.productosIds.length} products in productosIds array`);
          
          nivelData.productosIds.forEach(productoId => {
            if (productoId && typeof productoId === 'string') {
              productsByLevel[levelIndex].push(productoId);
            }
          });
        }
        else {
          console.log(`No suitable productos array found in nivel ${levelIndex}`);
        }
      });
      
      console.log(`Found products in ${Object.keys(productsByLevel).length} levels, max level: ${maxLevel}`);
      
      return { levels: productsByLevel, maxLevel };
    } catch (error) {
      console.error('Error getting products from niveles:', error);
      return { levels: {}, maxLevel: 0 };
    }
  }
  
  /**
   * Gets products organized by level from the productos collection
   * 
   * @private
   * @param {string} tiendaId - ID of the store
   * @param {string} planogramaId - ID of the planogram
   * @returns {Promise<Array<Array<string>>>} - Nested array of product IDs organized by level
   */
  async getProductsFromProductos(tiendaId, planogramaId) {
    try {
      // Get productos collection reference
      const productosRef = collection(db, "tiendas", tiendaId, "planogramas", planogramaId, "productos");
      const productosSnapshot = await getDocs(productosRef);
      
      if (productosSnapshot.empty) {
        console.log('No products found in planogram productos collection');
        return [];
      }
      
      console.log(`Found ${productosSnapshot.size} products in planogram productos collection`);
      
      // Organize products by level
      const productsByLevel = {};
      let maxLevel = 0;
      
      productosSnapshot.forEach(doc => {
        const productoData = doc.data();
        
        // Only process products that have level information and a product ID
        if (productoData.nivelEstante !== undefined && 
            (productoData.barcode || productoData.id || productoData.productoId)) {
          const levelIndex = productoData.nivelEstante;
          maxLevel = Math.max(maxLevel, levelIndex);
          
          // Create array for this level if it doesn't exist
          if (!productsByLevel[levelIndex]) {
            productsByLevel[levelIndex] = [];
          }
          
          // Prioritize barcode if available, otherwise fall back to id or productoId
          const productId = productoData.barcode || productoData.id || productoData.productoId;
          
          // Log which field was used
          if (productoData.barcode) {
            console.log(`Using barcode (${productId}) for product in nivel ${levelIndex} from productos collection`);
          } else if (productoData.id) {
            console.log(`Using id (${productId}) for product in nivel ${levelIndex} from productos collection`);
          } else {
            console.log(`Using productoId (${productId}) for product in nivel ${levelIndex} from productos collection`);
          }
          
          // Add the product ID to the level array
          productsByLevel[levelIndex].push(productId);
        }
      });
      
      // If no products with level information were found
      if (Object.keys(productsByLevel).length === 0) {
        console.log('No products with level information found in productos collection');
        return [];
      }
      
      console.log(`Found products in ${Object.keys(productsByLevel).length} levels from productos collection`);
      
      // Get level indices in DESCENDING order (highest level first)
      const levelIndices = Object.keys(productsByLevel)
        .map(Number)
        .sort((a, b) => b - a); // Sort in descending order
      
      // Create result array with entries for each level (highest level first)
      return levelIndices.map(levelIndex => productsByLevel[levelIndex]);
    } catch (error) {
      console.error('Error getting products from productos collection:', error);
      return [];
    }
  }
  
  /**
   * Gets a flattened array of all product IDs in a planogram
   * 
   * @param {string} tiendaId - ID of the store
   * @param {string} planogramaId - ID of the planogram
   * @returns {Promise<Array<string>>} - Array of all product IDs
   */
  async getAllProductIds(tiendaId, planogramaId) {
    try {
      const nestedArray = await this.getProductIdsByLevel(tiendaId, planogramaId);
      // Flatten the nested array into a single array of product IDs
      return nestedArray.flat();
    } catch (error) {
      console.error('Error getting all product IDs:', error);
      return [];
    }
  }
}

// Create and export a singleton instance
const planogramTaskService = new PlanogramTaskService();
export default planogramTaskService; 