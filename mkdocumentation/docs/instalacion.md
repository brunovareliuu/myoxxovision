# Guía de Instalación

Esta guía proporciona instrucciones detalladas para instalar y configurar el sistema Oxxo Vision, tanto para desarrolladores como para usuarios finales.

## Requisitos del Sistema

### Aplicación Móvil
- Dispositivo iOS (versión 13.0 o superior) o Android (versión 8.0 o superior)
- Cámara de al menos 8MP para resultados óptimos
- 100MB de espacio de almacenamiento disponible
- Conexión a Internet (para sincronización y funciones avanzadas)

### Backend (para desarrolladores)
- Vite
- Firebase
- 8GB RAM mínimo recomendado
- Sistema operativo: Linux (recomendado), macOS o Windows

## Instalación de la Aplicación Móvil

### Para Usuarios
- Expo Go
- NodeJs


### Configuración Inicial

1. Inicie sesión con sus credenciales corporativas
2. Seleccione su tienda de la lista disponible
3. Conceda los permisos necesarios (cámara, almacenamiento)

### Correr app
   ```bash
   npx expo start
   ```

## Instalación del WebApp

### Configuración del Entorno

1. Clone el repositorio:
   ```bash
   git clone https://github.com/brunovareliuu/myoxxovision.git 
   cd oxxo-vision
   ```

2. Instale las dependencias: Node.js:
   ```bash
   npm install o yarn install 
   ```


3. Configure las bases de datos:
   ```bash
   # Firebase
   Firebase Init
   Log in into your acc
   ```




## Verificación de la Instalación

Para verificar que todo esté funcionando correctamente:

1. Utilice la aplicación móvil para capturar una imagen de prueba
2. Verifique que la imagen aparezca en el panel de administración


## Solución de Problemas Comunes

### La aplicación móvil no puede conectarse al servidor

- Verifique que la URL del servidor en la configuración de la aplicación sea correcta
- Compruebe que el servidor esté funcionando correctamente

### Errores en el procesamiento de imágenes

- Verifique que todos los modelos de IA estén correctamente instalados
- Asegúrese de que la memoria disponible sea suficiente
- Revise los logs del servicio de IA para identificar errores específicos

### Problemas de base de datos

- Verifique las credenciales de conexión
- Asegúrese de que los servicios de Firebase estén funcionando
- Compruebe los permisos de acceso a las bases de datos


## Soporte

Si encuentra algún problema durante la instalación o uso del sistema, contacte al equipo de soporte técnico:

- **Email**: neil.rodriguez.murillo@gmail.com
- **Teléfono**: (81) 3257 1521
