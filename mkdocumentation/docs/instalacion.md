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

## Instalación del WebApp

### Configuración del Entorno

1. Clone el repositorio:
   ```bash
   git clone https://github.com/femsa/oxxo-vision.git
   cd oxxo-vision
   ```

2. Instale las dependencias del servidor Node.js:
   ```bash
   cd server
   npm install
   ```

3. Configure el entorno Python:
   ```bash
   cd ../ai-module
   python -m venv venv
   source venv/bin/activate  # En Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. Configure las bases de datos:
   ```bash
   # MongoDB
   mongorestore --db oxxovision ./database/mongo-dump

   # PostgreSQL
   psql -U postgres -f ./database/schema.sql
   ```

5. Configure las variables de entorno:
   ```bash
   cp .env.example .env
   # Edite el archivo .env con sus credenciales y configuraciones
   ```

### Ejecución del Sistema

1. Inicie el servidor Node.js:
   ```bash
   cd server
   npm start
   ```

2. Inicie el servicio de procesamiento AI:
   ```bash
   cd ai-module
   python app.py
   ```

3. Acceda al panel de administración:
   - Abra su navegador y vaya a `http://localhost:3000/admin`
   - Inicie sesión con las credenciales por defecto:
     - Usuario: admin
     - Contraseña: OxxoVision2023

## Verificación de la Instalación

Para verificar que todo esté funcionando correctamente:

1. Utilice la aplicación móvil para capturar una imagen de prueba
2. Verifique que la imagen aparezca en el panel de administración
3. Compruebe los logs del servidor para asegurarse de que el procesamiento de imagen se esté realizando correctamente

## Solución de Problemas Comunes

### La aplicación móvil no puede conectarse al servidor

- Verifique que la URL del servidor en la configuración de la aplicación sea correcta
- Asegúrese de que el firewall no esté bloqueando las conexiones
- Compruebe que el servidor esté funcionando correctamente

### Errores en el procesamiento de imágenes

- Verifique que todos los modelos de IA estén correctamente instalados
- Asegúrese de que la memoria disponible sea suficiente
- Revise los logs del servicio de IA para identificar errores específicos

### Problemas de base de datos

- Verifique las credenciales de conexión
- Asegúrese de que los servicios de MongoDB y PostgreSQL estén funcionando
- Compruebe los permisos de acceso a las bases de datos

## Actualizaciones del Sistema

El sistema Oxxo Vision recibe actualizaciones periódicas para mejorar funcionalidades y solucionar problemas. Para actualizar:

1. **Aplicación Móvil**: Las actualizaciones se distribuyen a través de App Store y Google Play
2. **Backend**:
   ```bash
   cd oxxo-vision
   git pull
   cd server
   npm install
   cd ../ai-module
   source venv/bin/activate
   pip install -r requirements.txt
   ```

## Soporte

Si encuentra algún problema durante la instalación o uso del sistema, contacte al equipo de soporte técnico:

- **Email**: soporte.oxxovision@femsa.com
- **Teléfono**: (81) 8328-6000 ext. 6789
- **Portal de Ayuda**: [https://soporte.oxxovision.com](https://soporte.oxxovision.com) 