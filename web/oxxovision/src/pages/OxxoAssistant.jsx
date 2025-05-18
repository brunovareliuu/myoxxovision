import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { auth, db } from '../firebase';
import { collection, query, getDocs, where, limit, doc, getDoc, orderBy } from 'firebase/firestore';
import { sendMessageToGemini } from '../services/GeminiService';
import './OxxoAssistant.css';

// Función utilitaria para formatear los datos para las respuestas
const formatFirestoreData = (data) => {
  if (!data || typeof data !== 'object') return 'No disponible';
  
  // Si es un timestamp de Firestore, formatearlo como fecha
  if (data.seconds && data.nanoseconds) {
    const date = new Date(data.seconds * 1000);
    return date.toLocaleDateString();
  }
  
  return data.toString();
};

const OxxoAssistant = () => {
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "¡Hola! Soy el asistente de OXXO Vision impulsado por la IA de Gemini. Puedo ayudarte con información sobre planogramas, productos y tiendas. ¿En qué puedo ayudarte hoy?"
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [storeData, setStoreData] = useState([]);
  const [planogramaData, setPlanogramaData] = useState([]);
  const [productsData, setProductsData] = useState([]);
  const [categoriesData, setCategoriesData] = useState([]);
  const [apiKey, setApiKey] = useState("AIzaSyBaRz2arhZOhmRZIPuPxtYvqlFu6CKDidk");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [useGemini, setUseGemini] = useState(true);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  // Store API key in localStorage for persistence
  useEffect(() => {
    localStorage.setItem('geminiApiKey', apiKey);
    localStorage.setItem('useGemini', 'true');
  }, [apiKey]);

  // Cargar todos los datos necesarios al iniciar
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setIsLoading(true);
        
        // Cargar datos del usuario actual
        await loadUserData();
        
        // Cargar datos de tiendas, productos y planogramas
        await Promise.all([
          loadStores(),
          loadProducts(),
          loadCategories()
        ]);
        
        setIsLoading(false);
      } catch (error) {
        console.error("Error cargando datos iniciales:", error);
        setIsLoading(false);
      }
    };

    loadAllData();
  }, []);

  // Cargar datos del usuario actual
  const loadUserData = async () => {
    try {
      const userId = auth.currentUser?.uid || localStorage.getItem('oxxoUserId');
      const userRole = localStorage.getItem('oxxoUserRole') || 'usuario';
      const userName = localStorage.getItem('oxxoUserName') || 'Usuario';
      
      setUserData({
        uid: userId,
        nombre: userName,
        rol: userRole
      });
      
      console.log("Datos de usuario cargados:", userName, userRole);
    } catch (error) {
      console.error("Error cargando datos de usuario:", error);
    }
  };

  // Función para cargar tiendas y sus planogramas desde Firestore
  const loadStores = async () => {
    try {
      // Obtener las tiendas
      const storesRef = collection(db, "tiendas");
      const storesQuery = query(storesRef, limit(20)); // Aumentamos el límite para tener más datos
      const storesSnapshot = await getDocs(storesQuery);
      
      const stores = [];
      const storePromises = [];
      
      storesSnapshot.forEach((storeDoc) => {
        const storeData = {
          id: storeDoc.id,
          ...storeDoc.data()
        };
        stores.push(storeData);
        
        // Cargar planogramas para cada tienda
        const planogramaPromise = loadPlanogramasForStore(storeDoc.id);
        storePromises.push(planogramaPromise);
      });
      
      // Esperar a que se carguen todos los planogramas
      await Promise.all(storePromises);
      
      setStoreData(stores);
      console.log("Tiendas cargadas:", stores.length);
    } catch (error) {
      console.error("Error cargando tiendas:", error);
    }
  };

  // Función para cargar planogramas de una tienda específica
  const loadPlanogramasForStore = async (tiendaId) => {
    try {
      const planogramasRef = collection(db, "tiendas", tiendaId, "planogramas");
      const planogramasSnapshot = await getDocs(planogramasRef);
      
      const planogramas = [];
      planogramasSnapshot.forEach((doc) => {
        planogramas.push({
          id: doc.id,
          tiendaId: tiendaId,
          ...doc.data()
        });
      });
      
      // Actualizar el estado añadiendo los nuevos planogramas
      setPlanogramaData(prevPlanogramas => [...prevPlanogramas, ...planogramas]);
      
      return planogramas;
    } catch (error) {
      console.error(`Error cargando planogramas para tienda ${tiendaId}:`, error);
      return [];
    }
  };

  // Función para cargar todos los productos
  const loadProducts = async () => {
    try {
      const productsRef = collection(db, "productos");
      const productsQuery = query(productsRef, limit(100)); // Aumentamos el límite para tener datos suficientes
      const productsSnapshot = await getDocs(productsQuery);
      
      const products = [];
      productsSnapshot.forEach((doc) => {
        products.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setProductsData(products);
      console.log("Productos cargados:", products.length);
    } catch (error) {
      console.error("Error cargando productos:", error);
    }
  };

  // Función para cargar categorías (extrayéndolas de los productos)
  const loadCategories = async () => {
    try {
      // Cargar categorías distintas de los productos
      const productsRef = collection(db, "productos");
      const productsSnapshot = await getDocs(productsRef);
      
      const categoriesSet = new Set();
      productsSnapshot.forEach((doc) => {
        const categoria = doc.data().categoria;
        if (categoria) categoriesSet.add(categoria);
      });
      
      const categories = Array.from(categoriesSet);
      setCategoriesData(categories);
      console.log("Categorías cargadas:", categories.length);
    } catch (error) {
      console.error("Error cargando categorías:", error);
    }
  };

  // Funciones para manejar la API key de Gemini
  const handleApiKeySubmit = (e) => {
    e.preventDefault();
    if (apiKey && apiKey.trim()) {
      localStorage.setItem('geminiApiKey', apiKey.trim());
      localStorage.setItem('useGemini', 'true');
      setUseGemini(true);
      setShowApiKeyInput(false);
    }
  };

  const handleToggleApiKeyInput = () => {
    setShowApiKeyInput(!showApiKeyInput);
  };

  const handleToggleUseGemini = () => {
    const newValue = !useGemini;
    setUseGemini(newValue);
    localStorage.setItem('useGemini', String(newValue));
    
    // Update welcome message based on selected mode
    if (messages.length === 1 && messages[0].role === "assistant") {
      const welcomeMessage = newValue
        ? "¡Hola! Soy el asistente de OXXO Vision impulsado por la IA de Gemini. Puedo ayudarte con información sobre planogramas, productos y tiendas. ¿En qué puedo ayudarte hoy?"
        : "¡Hola! Soy el asistente de OXXO Vision basado en la información real de tu base de datos. Puedo ayudarte con información sobre planogramas, productos y tiendas. ¿En qué puedo ayudarte hoy?";
      
      setMessages([{
        role: "assistant",
        content: welcomeMessage
      }]);
    }
  };

  // Función para hacer scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Función para buscar datos relevantes en Firestore basados en la consulta del usuario
  const searchFirestoreData = async (query) => {
    const queryLower = query.toLowerCase();
    const result = {
      stores: [],
      planogramas: [],
      products: [],
      categories: []
    };
    
    try {
      // Búsqueda de tiendas
      if (queryLower.includes("tienda") || queryLower.includes("store") || queryLower.includes("sucursal")) {
        const storesRef = collection(db, "tiendas");
        let storesQuery = query;
        
        // Extraer posible ID o nombre de tienda de la consulta
        const storePattern = /tienda\s+(\w+)|store\s+(\w+)|sucursal\s+(\w+)|número\s+(\w+)|id\s+(\w+)/i;
        const storeMatch = query.match(storePattern);
        
        if (storeMatch) {
          const storeId = storeMatch[1] || storeMatch[2] || storeMatch[3] || storeMatch[4] || storeMatch[5];
          storesQuery = query.where('id', '==', storeId);
          
          // También buscar por nombre si no se encontró por ID
          if (result.stores.length === 0) {
            storesQuery = query.where('nombre', '>=', storeId).where('nombre', '<=', storeId + '\uf8ff');
          }
        }
        
        // Limitar a 5 tiendas máximo
        const storesSnapshot = await getDocs(storesRef);
        storesSnapshot.forEach(doc => {
          if (result.stores.length < 5) {
            result.stores.push({ id: doc.id, ...doc.data() });
          }
        });
      }
      
      // Búsqueda de planogramas
      if (queryLower.includes("planograma") || queryLower.includes("charola") || 
          queryLower.includes("layout") || queryLower.includes("plano")) {
        const planogramasRef = collection(db, "planogramas");
        
        // Extraer posible ID de planograma
        const planogramaPattern = /planograma\s+(\w+)|id\s+(\w+)|charola\s+(\w+)/i;
        const planogramaMatch = query.match(planogramaPattern);
        
        let planogramasQuery = planogramasRef;
        if (planogramaMatch) {
          const planogramaId = planogramaMatch[1] || planogramaMatch[2] || planogramaMatch[3];
          // Intentar buscar por ID exacto primero
          planogramasQuery = query(planogramasRef, where('id', '==', planogramaId));
        }
        
        // Limitar a 5 planogramas máximo
        const planogramasSnapshot = await getDocs(planogramasRef);
        planogramasSnapshot.forEach(doc => {
          if (result.planogramas.length < 5) {
            result.planogramas.push({ id: doc.id, ...doc.data() });
          }
        });
      }
      
      // Búsqueda de productos
      if (queryLower.includes("producto") || queryLower.includes("artículo") || 
          queryLower.includes("item") || queryLower.includes("mercancía")) {
        const productsRef = collection(db, "productos");
        
        // Extraer posible nombre de producto o categoría
        const productPattern = /producto\s+(\w+)|artículo\s+(\w+)|categoría\s+(\w+)/i;
        const productMatch = query.match(productPattern);
        
        let productsQuery = productsRef;
        if (productMatch) {
          const productTerm = productMatch[1] || productMatch[2] || productMatch[3];
          // Intentar buscar por nombre o categoría
          if (queryLower.includes("categoría") || queryLower.includes("categoria")) {
            productsQuery = query(productsRef, where('categoria', '==', productTerm));
          } else {
            productsQuery = query(productsRef, where('nombre', '>=', productTerm), 
                                where('nombre', '<=', productTerm + '\uf8ff'));
          }
        }
        
        // Limitar a 10 productos máximo
        const productsSnapshot = await getDocs(productsRef);
        productsSnapshot.forEach(doc => {
          if (result.products.length < 10) {
            result.products.push({ id: doc.id, ...doc.data() });
          }
        });
        
        // También obtener categorías si se mencionan
        if (queryLower.includes("categoría") || queryLower.includes("categoria") || 
            queryLower.includes("tipo") || queryLower.includes("class")) {
          
          // Extraer categorías únicas de los productos
          const categoriesSet = new Set();
          productsSnapshot.forEach(doc => {
            const categoria = doc.data().categoria;
            if (categoria) categoriesSet.add(categoria);
          });
          
          result.categories = Array.from(categoriesSet);
        }
      }
      
      return result;
    } catch (error) {
      console.error("Error buscando datos en Firestore:", error);
      return result;
    }
  };

  // Función para generar respuesta basada en los datos de Firestore
  const generateResponseFromFirestore = (query, contextData) => {
    query = query.toLowerCase();
    let response = '';
    
    // Respuestas basadas en el tipo de consulta y los datos encontrados
    switch (contextData.type) {
      case 'tienda':
        response = generateTiendaResponse(contextData.tiendaInfo);
        break;
        
      case 'planogramaTienda':
        response = generatePlanogramaTiendaResponse(contextData.tiendaInfo, contextData.planogramas);
        break;
        
      case 'planogramaGeneral':
        response = generatePlanogramaGeneralResponse(contextData.planogramas);
        break;
        
      case 'producto':
        response = generateProductoResponse(contextData.productoInfo);
        break;
        
      case 'productosGeneral':
        response = generateProductosGeneralResponse(contextData.productos, contextData.categorias);
        break;
        
      case 'categoria':
        response = generateCategoriaResponse(contextData.categoriaInfo, contextData.productos);
        break;
        
      default:
        // Respuesta general basada en los datos disponibles
        response = generateGeneralResponse(query);
    }
    
    return response;
  };

  // Generadores de respuestas específicas
  const generateTiendaResponse = (tiendaInfo) => {
    if (!tiendaInfo) return "No encontré información para esa tienda en la base de datos.";
    
    let response = `La tienda ${tiendaInfo.nombre} (código: ${tiendaInfo.codigoTienda}) está ubicada en ${tiendaInfo.ciudad}, ${tiendaInfo.estado}.\n\n`;
    
    if (tiendaInfo.direccion) {
      response += `Dirección: ${tiendaInfo.direccion}\n`;
    }
    
    if (tiendaInfo.gerente) {
      response += `\nInformación del gerente:\n`;
      response += `Nombre: ${tiendaInfo.gerente.nombre || 'No especificado'}\n`;
      response += `Email: ${tiendaInfo.gerente.email || 'No especificado'}\n`;
    }
    
    return response;
  };

  const generatePlanogramaTiendaResponse = (tiendaInfo, planogramas) => {
    if (!tiendaInfo) return "No encontré información para esa tienda en la base de datos.";
    if (!planogramas || planogramas.length === 0) return `La tienda ${tiendaInfo.nombre} no tiene planogramas configurados en el sistema.`;
    
    let response = `La tienda ${tiendaInfo.nombre} (código: ${tiendaInfo.codigoTienda}) tiene ${planogramas.length} planograma(s) configurado(s).\n\n`;
    
    // Información detallada del primer planograma (o el mencionado en la consulta)
    const planograma = planogramas[0];
    response += `Detalle del planograma ${planograma.nombre || 'principal'}:\n`;
    
    if (planograma.size) {
      response += `- Dimensiones: ${planograma.size[0]}m × ${planograma.size[1]}m × ${planograma.size[2]}m\n`;
    }
    
    if (planograma.position) {
      response += `- Posición: X=${planograma.position[0]}, Y=${planograma.position[1]}, Z=${planograma.position[2]}\n`;
    }
    
    // Analizar los niveles/charolas del planograma
    if (planograma.shelves && Array.isArray(planograma.shelves)) {
      response += `\nEste planograma tiene ${planograma.shelves.length} charola(s).\n`;
      
      // Información sobre los productos en cada charola
      planograma.shelves.forEach((charola, charolaIdx) => {
        if (Array.isArray(charola) && charola.length > 0) {
          const charolaNumber = planograma.shelves.length - charolaIdx;
          response += `\nCharola ${charolaNumber} (desde abajo): ${charola.length} producto(s)\n`;
          
          // Mostrar los primeros 3 productos como ejemplo
          const productosEjemplo = charola.slice(0, 3);
          productosEjemplo.forEach((producto, index) => {
            response += `  - ${producto.name || 'Producto sin nombre'}\n`;
          });
          
          if (charola.length > 3) {
            response += `  - ... y ${charola.length - 3} producto(s) más\n`;
          }
        }
      });
    }
    
    return response;
  };

  const generatePlanogramaGeneralResponse = (planogramas) => {
    if (!planogramas || planogramas.length === 0) return "No hay planogramas configurados en el sistema.";
    
    const numTiendas = new Set(planogramas.map(p => p.tiendaId)).size;
    
    let response = `En el sistema hay ${planogramas.length} planograma(s) distribuidos en ${numTiendas} tienda(s) diferentes.\n\n`;
    
    // Estadísticas generales
    const tiendaConMasPlanogramas = Object.entries(
      planogramas.reduce((acc, p) => {
        acc[p.tiendaId] = (acc[p.tiendaId] || 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1])[0];
    
    if (tiendaConMasPlanogramas) {
      const tiendaId = tiendaConMasPlanogramas[0];
      const numPlanogramas = tiendaConMasPlanogramas[1];
      const tiendaInfo = storeData.find(s => s.id === tiendaId);
      
      if (tiendaInfo) {
        response += `La tienda con más planogramas es ${tiendaInfo.nombre} con ${numPlanogramas} planograma(s).\n`;
      }
    }
    
    // Información sobre configuración típica
    response += `\nUn planograma típico en OXXO Vision tiene entre 1 y 5 charolas, donde la charola 1 es la de abajo y van incrementando hacia arriba.\n`;
    response += `Cada charola puede contener diferentes productos distribuidos estratégicamente según las necesidades de la tienda.`;
    
    return response;
  };

  const generateProductoResponse = (productoInfo) => {
    if (!productoInfo) return "No encontré información para ese producto en la base de datos.";
    
    let response = `Información del producto: ${productoInfo.nombre || 'Sin nombre'}\n\n`;
    
    if (productoInfo.barcode) {
      response += `Código de barras: ${productoInfo.barcode}\n`;
    }
    
    if (productoInfo.categoria) {
      response += `Categoría: ${productoInfo.categoria}\n`;
    }
    
    if (productoInfo.descripcion) {
      response += `\nDescripción: ${productoInfo.descripcion}\n`;
    }
    
    // Añadir información de inventario si está disponible
    if (productoInfo.stock) {
      response += `\nStock disponible: ${productoInfo.stock} unidades\n`;
    }
    
    return response;
  };

  const generateProductosGeneralResponse = (productos, categorias) => {
    if (!productos || productos.length === 0) return "No hay productos en la base de datos.";
    
    let response = `En el sistema hay ${productos.length} producto(s) distribuidos en ${categorias.length} categoría(s) diferentes.\n\n`;
    
    // Información de categorías
    response += `Categorías disponibles: ${categorias.join(', ')}\n\n`;
    
    // Estadísticas de productos por categoría
    const productosPorCategoria = productos.reduce((acc, p) => {
      if (p.categoria) {
        acc[p.categoria] = (acc[p.categoria] || 0) + 1;
      }
      return acc;
    }, {});
    
    response += `Distribución de productos por categoría:\n`;
    Object.entries(productosPorCategoria)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([categoria, count]) => {
        response += `- ${categoria}: ${count} producto(s)\n`;
      });
    
    return response;
  };

  const generateCategoriaResponse = (categoriaInfo, productos) => {
    if (!categoriaInfo) return "No encontré información para esa categoría en la base de datos.";
    if (!productos || productos.length === 0) return `No hay productos en la categoría ${categoriaInfo}.`;
    
    let response = `En la categoría "${categoriaInfo}" hay ${productos.length} producto(s).\n\n`;
    
    // Mostrar los primeros 5 productos como ejemplo
    response += `Algunos productos en esta categoría:\n`;
    productos.slice(0, 5).forEach(producto => {
      response += `- ${producto.nombre || 'Producto sin nombre'}\n`;
    });
    
    if (productos.length > 5) {
      response += `\n... y ${productos.length - 5} producto(s) más.`;
    }
    
    return response;
  };

  const generateGeneralResponse = (query) => {
    // Respuesta general basada en los datos disponibles
    let response = `Basado en la información disponible en la base de datos:\n\n`;
    
    response += `- Hay ${storeData.length} tienda(s) registrada(s) en el sistema\n`;
    response += `- Hay ${planogramaData.length} planograma(s) configurado(s)\n`;
    response += `- Hay ${productsData.length} producto(s) en el catálogo\n`;
    response += `- Los productos están organizados en ${categoriesData.length} categoría(s)\n\n`;
    
    response += `Puedes preguntarme sobre:\n`;
    response += `- Información de una tienda específica\n`;
    response += `- Detalles de planogramas de una tienda\n`;
    response += `- Información de productos y categorías\n`;
    
    return response;
  };

  // Manejar el envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!userInput.trim()) return;
    
    // Añadir mensaje del usuario a la conversación
    const userMessage = { role: "user", content: userInput };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setUserInput("");
    setIsLoading(true);
    
    try {
      if (useGemini && apiKey) {
        // Usar Gemini API si está habilitada y hay una API key
        try {
          // Preparar el contexto con información de la base de datos
          const contextData = await searchFirestoreData(userInput);
          
          // Formatear el contexto para Gemini
          let systemContext = "Eres un asistente de OXXO Vision que ayuda con información sobre tiendas, planogramas y productos de la cadena OXXO. Responde en español de manera amigable y profesional. Usa los siguientes datos reales de nuestra base de datos para informar tu respuesta:\n\n";
          
          // Añadir datos de contexto si se encontraron
          if (contextData.stores.length > 0) {
            systemContext += "TIENDAS:\n";
            contextData.stores.forEach(store => {
              systemContext += `- ${store.nombre} (ID: ${store.id}): ${store.direccion}, ${store.ciudad}\n`;
            });
            systemContext += "\n";
          }
          
          if (contextData.planogramas.length > 0) {
            systemContext += "PLANOGRAMAS:\n";
            contextData.planogramas.forEach(planograma => {
              systemContext += `- ${planograma.nombre} (ID: ${planograma.id}): ${planograma.descripcion || 'Sin descripción'}\n`;
            });
            systemContext += "\n";
          }
          
          if (contextData.products.length > 0) {
            systemContext += "PRODUCTOS:\n";
            contextData.products.forEach(product => {
              systemContext += `- ${product.nombre} (ID: ${product.id}): Categoría: ${product.categoria || 'Sin categoría'}, Precio: $${product.precio || 'N/A'}\n`;
            });
            systemContext += "\n";
          }
          
          if (contextData.categories.length > 0) {
            systemContext += "CATEGORÍAS:\n";
            contextData.categories.forEach(category => {
              systemContext += `- ${category}\n`;
            });
            systemContext += "\n";
          }
          
          console.log("Contexto enviado a Gemini:", systemContext);
          
          // Llamar a la API de Gemini
          const geminiResponse = await sendMessageToGemini(apiKey, userInput, systemContext);
          
          // Añadir respuesta a la conversación
          setMessages(prevMessages => [
            ...prevMessages, 
            { role: "assistant", content: geminiResponse }
          ]);
        } catch (error) {
          console.error("Error con Gemini API:", error);
          setMessages(prevMessages => [
            ...prevMessages, 
            { role: "assistant", content: `Lo siento, hubo un error al procesar tu solicitud: ${error.message}. Por favor intenta de nuevo o contacta al administrador del sistema.` }
          ]);
        }
      } else {
        // Usar el enfoque basado en base de datos (método anterior)
        const contextData = await searchFirestoreData(userInput);
        const assistantResponse = generateResponseFromFirestore(userInput, contextData);
        
        setMessages(prevMessages => [
          ...prevMessages, 
          { role: "assistant", content: assistantResponse }
        ]);
      }
    } catch (error) {
      console.error("Error al generar respuesta:", error);
      setMessages(prevMessages => [
        ...prevMessages, 
        { role: "assistant", content: "Lo siento, ocurrió un error al procesar tu solicitud. Por favor intenta de nuevo." }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="layout-container">
      <Sidebar userData={userData} />
      
      <div className="main-content">
        <header className="content-header">
          <h1>OXXO Vision Assistant</h1>
          <div className="header-actions">
            <button className="back-button" onClick={() => navigate('/dashboard')}>
              <span className="material-icons">arrow_back</span>
              Volver al Dashboard
            </button>
          </div>
        </header>
        
        <div className="assistant-container">
          <div className="assistant-header">
            <div className="assistant-logo">
              <img src="/logo.svg" alt="OXXO Vision Logo" />
            </div>
            <div className="assistant-title">
              <h2>My OXXO Vision Assistant</h2>
              <p>Consulta información sobre planogramas, tiendas y productos</p>
              <div className="assistant-controls">
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={useGemini} 
                    onChange={handleToggleUseGemini}
                  />
                  <span className="toggle-slider"></span>
                  <span className="toggle-label">Usar Gemini AI</span>
                </label>
                <button 
                  onClick={handleToggleApiKeyInput} 
                  className="api-key-toggle"
                  title="Configurar API Key"
                >
                  <span className="material-icons">key</span>
                </button>
              </div>
              {showApiKeyInput && (
                <form onSubmit={handleApiKeySubmit} className="api-key-form">
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Ingresa tu API Key de Gemini..."
                    className="api-key-input"
                  />
                  <button type="submit" className="api-key-button">
                    Guardar
                  </button>
                </form>
              )}
            </div>
          </div>
          
          <div className="chat-container">
            <div className="messages-container">
              {messages.map((message, index) => (
                <div 
                  key={index} 
                  className={`message ${message.role === "assistant" ? "assistant" : "user"}`}
                >
                  {message.role === "assistant" && (
                    <div className="assistant-avatar">
                      <span className="material-icons">support_agent</span>
                    </div>
                  )}
                  <div className="message-content">
                    <p>{message.content}</p>
                  </div>
                  {message.role === "user" && (
                    <div className="user-avatar">
                      <span className="material-icons">person</span>
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="message assistant">
                  <div className="assistant-avatar">
                    <span className="material-icons">support_agent</span>
                  </div>
                  <div className="message-content typing">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            
            <form onSubmit={handleSubmit} className="input-container">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Escribe tu pregunta sobre planogramas..."
                className="chat-input"
                disabled={isLoading}
              />
              <button type="submit" className="send-button" disabled={isLoading}>
                <span className="material-icons">send</span>
              </button>
            </form>
          </div>
          
          <div className="assistant-footer">
            <p>
              Asistente OXXO Vision • 
              {useGemini 
                ? "Potenciado por Gemini API" 
                : "Información en tiempo real de tu base de datos"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OxxoAssistant; 