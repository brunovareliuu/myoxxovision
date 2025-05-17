// Catálogo de productos OXXO
// Este catálogo incluye productos reales con dimensiones aproximadas

const productsCatalog = [
  // Bebidas
  {
    id: 'bebida-cocacola-600',
    name: 'Coca-Cola 600ml',
    color: '#e61a27',
    category: 'Bebidas',
    size: [0.08, 0.20, 0.08] // ancho, alto, profundidad en metros
  },
  {
    id: 'bebida-pepsi-600',
    name: 'Pepsi 600ml',
    color: '#004883',
    category: 'Bebidas',
    size: [0.08, 0.20, 0.08]
  },
  {
    id: 'bebida-sprite-600',
    name: 'Sprite 600ml',
    color: '#008b47',
    category: 'Bebidas',
    size: [0.08, 0.20, 0.08]
  },
  {
    id: 'bebida-fanta-600',
    name: 'Fanta 600ml',
    color: '#f7941e',
    category: 'Bebidas',
    size: [0.08, 0.20, 0.08]
  },
  {
    id: 'bebida-agua-1l',
    name: 'Agua Natural 1L',
    color: '#00a0df',
    category: 'Bebidas',
    size: [0.09, 0.25, 0.09]
  },
  
  // Snacks
  {
    id: 'snack-doritos-62g',
    name: 'Doritos Nacho 62g',
    color: '#ff9800',
    category: 'Snacks',
    size: [0.25, 0.30, 0.05]
  },
  {
    id: 'snack-sabritas-45g',
    name: 'Sabritas Original 45g',
    color: '#ffd700',
    category: 'Snacks',
    size: [0.25, 0.30, 0.05]
  },
  {
    id: 'snack-cheetos-52g',
    name: 'Cheetos 52g',
    color: '#ff5722',
    category: 'Snacks',
    size: [0.20, 0.25, 0.05]
  },
  
  // Dulces
  {
    id: 'dulce-snickers-52g',
    name: 'Snickers 52g',
    color: '#8b4513',
    category: 'Dulces',
    size: [0.10, 0.03, 0.03]
  },
  {
    id: 'dulce-milkyway-52g',
    name: 'Milky Way 52g',
    color: '#4b0082',
    category: 'Dulces',
    size: [0.10, 0.03, 0.03]
  },
  
  // Galletas
  {
    id: 'galleta-oreo-117g',
    name: 'Oreo 117g',
    color: '#1e3a8a',
    category: 'Galletas',
    size: [0.15, 0.17, 0.04]
  },
  {
    id: 'galleta-emperador-91g',
    name: 'Emperador Chocolate 91g',
    color: '#8b0000',
    category: 'Galletas',
    size: [0.13, 0.17, 0.04]
  },
  
  // Café
  {
    id: 'cafe-andatti-400g',
    name: 'Café Andatti 400g',
    color: '#6f4e37',
    category: 'Café',
    size: [0.10, 0.20, 0.10]
  },
  
  // Lácteos
  {
    id: 'lacteo-leche-1l',
    name: 'Leche Lala 1L',
    color: '#00a0df',
    category: 'Lácteos',
    size: [0.10, 0.23, 0.10]
  },
  
  // Botanas
  {
    id: 'botana-takis-62g',
    name: 'Takis Fuego 62g',
    color: '#9c27b0',
    category: 'Botanas',
    size: [0.20, 0.25, 0.05]
  },
  
  // Bebidas alcohólicas
  {
    id: 'alcohol-cerveza-355ml',
    name: 'Cerveza Modelo 355ml',
    color: '#ffd700',
    category: 'Alcohol',
    size: [0.07, 0.15, 0.07]
  }
];

// Agrupar productos por categoría para facilitar su selección
const productsByCategory = productsCatalog.reduce((acc, product) => {
  if (!acc[product.category]) {
    acc[product.category] = [];
  }
  acc[product.category].push(product);
  return acc;
}, {});

export { productsCatalog, productsByCategory }; 