// Script para actualizar el stock de productos en tiendas
import { initializeApp } from "firebase/app";
import { actualizarStockTiendas } from './updateStockUtils.js';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA2UPFXjD963tlAlcPB7gZyXAaRqZJWZaI",
  authDomain: "myoxxovision.firebaseapp.com",
  projectId: "myoxxovision",
  storageBucket: "myoxxovision.firebasestorage.app",
  messagingSenderId: "491253915189",
  appId: "1:491253915189:web:aa9c56c0ce6c6a090c5b7c"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Función principal
const ejecutarActualizacion = async () => {
  console.log("=== Iniciando actualización de stock en tiendas (Estructura Mejorada) ===");
  console.log("Ahora el stock se guarda directamente en el documento de la tienda");
  
  try {
    const resultado = await actualizarStockTiendas();
    
    if (resultado.success) {
      console.log("✅ " + resultado.message);
      console.log(`Tiendas actualizadas: ${resultado.tiendas.length}`);
      
      // Mostrar lista de tiendas actualizadas
      if (resultado.tiendas.length > 0) {
        console.log("\nResumen de tiendas actualizadas:");
        console.table(resultado.tiendas.map(t => ({
          nombre: t.nombre,
          productos: t.productosActualizados
        })));
        
        console.log("\nEstructura de datos actualizada:");
        console.log("tiendas/{tiendaId} → inventarioProductos: { productoId: { stock, nombre, ... } }");
      }
    } else {
      console.error("❌ " + resultado.message);
    }
  } catch (error) {
    console.error("Error en la actualización:", error);
  }
  
  console.log("\n=== Proceso finalizado ===");
  // Cierra el proceso
  process.exit(0);
};

// Ejecutar el script
ejecutarActualizacion(); 