# MyOxxo Mobile App

## Descripción General

MyOxxo Mobile App es una solución móvil diseñada para optimizar la gestión de tiendas OXXO, enfocándose en la verificación de planogramas mediante visión artificial. La aplicación permite a los empleados verificar la correcta colocación de productos en estanterías, comparando la disposición real con el planograma ideal establecido por la empresa.

## Tecnologías Utilizadas

### Frontend
- **React Native**: Framework para desarrollo de aplicaciones móviles multiplataforma
- **Expo**: Plataforma para simplificar el desarrollo con React Native
- **React Navigation**: Para la navegación entre pantallas
- **React Native Vector Icons**: Biblioteca de iconos

### Backend y Servicios
- **Firebase**:
  - Firestore: Base de datos NoSQL para almacenamiento de datos
  - Firebase Storage: Almacenamiento de imágenes y evidencias
  - Firebase Authentication: Gestión de usuarios y autenticación

### Visión Artificial
- **Roboflow API**: Servicio de detección de objetos y análisis de imágenes
- **Algoritmos de procesamiento de imágenes**: Desarrollados específicamente para identificación de productos en estanterías

### Herramientas de Desarrollo
- **Git**: Control de versiones
- **JavaScript/ES6+**: Lenguaje de programación principal
- **Expo Image Manipulator**: Para procesamiento y compresión de imágenes

## Flujo de Usuario (User Flow)

1. **Inicio de Sesión**:
   - El usuario inicia sesión con sus credenciales de empleado
   - Autenticación mediante Firebase Auth

2. **Pantalla de Inicio (Dashboard)**:
   - Visualización de tareas pendientes
   - Filtrado por tienda, prioridad y fecha

3. **Lista de Tareas**:
   - Visualización de tareas asignadas al usuario
   - Filtros por estado (pendientes, completadas)
   - Ordenamiento por prioridad y fecha límite

4. **Detalle de Tarea**:
   - Visualización de información detallada de una tarea específica
   - Acceso al planograma asociado
   - Opción para iniciar la tarea de verificación

5. **Verificación de Planograma**:
   - Captura de imagen mediante cámara o selección desde galería
   - Subida de imagen a Firebase Storage
   - Procesamiento mediante Roboflow API para detección de productos

6. **Visualización de Resultados**:
   - Visualización de productos detectados por charola
   - Identificación de discrepancias entre el planograma ideal y la disposición real
   - Recomendaciones para corregir la disposición de productos

7. **Finalización de Tarea**:
   - Marcado de tarea como completada
   - Registro de evidencia en la base de datos

## Pantallas Principales

### Login Screen
- **Funcionalidad**: Permite a los usuarios autenticarse en la aplicación.
- **Retos técnicos**:
  - Implementación de validaciones de seguridad
  - Integración con Firebase Authentication
  - Manejo de estados de autenticación (login, logout, recordar sesión)

### Dashboard Screen
- **Funcionalidad**: Muestra un resumen de las tareas pendientes y completadas.
- **Retos técnicos**:
  - Diseño de interfaz intuitiva con múltiples métricas
  - Implementación de gráficos para visualización de datos
  - Optimización de consultas a Firestore para rendimiento

### Task List Screen
- **Funcionalidad**: Presenta una lista de tareas asignadas al usuario.
- **Retos técnicos**:
  - Implementación de filtrado y ordenamiento eficiente
  - Diseño de lista con carga lazy (paginación)
  - Sincronización de datos en tiempo real con Firestore

### Task Detail Screen
- **Funcionalidad**: Muestra información detallada de una tarea, incluyendo el planograma asociado y las opciones para completarla.
- **Retos técnicos**:
  - Visualización interactiva del planograma con múltiples niveles (charolas)
  - Implementación de navegación entre detalles de productos
  - Integración con la cámara y galería para captura de evidencias
  - Gestión de permisos del dispositivo (cámara, almacenamiento)

### Vision Analysis Screen
- **Funcionalidad**: Procesamiento de imágenes para detectar productos y comparar con el planograma ideal.
- **Retos técnicos**:
  - Integración con Roboflow API para análisis de imágenes
  - Optimización del envío de imágenes (compresión vs. URL)
  - Desarrollo de algoritmos para organizar productos por charola
  - Cálculo de discrepancias y recomendaciones de movimientos

### Modales de Resultados
- **Funcionalidad**: Presentación de resultados del análisis visual.
- **Retos técnicos**:
  - Diseño de interfaz clara para mostrar productos detectados por charola
  - Visualización intuitiva de discrepancias y recomendaciones
  - Flujo de navegación coherente entre modales
  - Recuperación de información detallada de productos desde Firestore

## Características Especiales

### Detección de Productos
La aplicación utiliza un modelo de visión artificial entrenado específicamente para reconocer productos en estanterías de OXXO. El sistema puede:
- Identificar productos individuales en una imagen
- Determinar su ubicación en la estantería
- Organizar los productos por niveles (charolas)
- Detectar espacios vacíos

### Comparación con Planograma
El algoritmo compara inteligentemente la disposición real con el planograma ideal:
- Identifica productos mal ubicados
- Detecta productos faltantes
- Reconoce productos que no deberían estar en la estantería
- Genera recomendaciones específicas de acciones a realizar

### Enfoque en UX
La aplicación prioriza la experiencia de usuario:
- Flujo intuitivo para completar tareas
- Retroalimentación visual clara
- Modales informativos con acciones claras
- Optimización para uso rápido en tienda

## Arquitectura de Datos

### Colecciones en Firestore
- **usuarios**: Información de empleados
- **tiendas**: Detalles de las tiendas OXXO
- **planogramas**: Disposición ideal de productos por estantería
- **tareas**: Asignaciones de verificación de planogramas
- **productos**: Catálogo de productos con detalles
- **evidencias**: Registros de verificaciones con imágenes y resultados

## Impacto en el Negocio

La aplicación representa un avance significativo en la operación de tiendas OXXO, permitiendo una verificación más eficiente y precisa de la disposición de productos, lo que impacta directamente en:

- **Mejora en la experiencia del cliente**: Productos correctamente ubicados y fáciles de encontrar
- **Incremento en ventas**: Disposición óptima siguiendo estrategias de mercadeo
- **Reducción de tiempo operativo**: Verificación rápida y precisa de planogramas
- **Datos analíticos valiosos**: Información sobre cumplimiento de planogramas a nivel cadena
- **Estandarización de tiendas**: Aseguramiento de imagen de marca consistente 