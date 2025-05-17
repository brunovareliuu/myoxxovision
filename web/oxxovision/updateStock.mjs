#!/usr/bin/env node

// Script para actualizar el stock de productos en tiendas (desde línea de comandos)
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { actualizarStockTiendas } from "./src/utils/updateStockUtils.js";

console.log("🔄 Actualizando stock en tiendas OXXO...");

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
const db = getFirestore(app);

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
        resultado.tiendas.forEach(t => {
          console.log(`- ${t.nombre}: ${t.productosActualizados} productos`);
        });
        
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