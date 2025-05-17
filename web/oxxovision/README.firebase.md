# Configuración de Firebase para OxxoVision

## Configuración de Firestore

1. Ve a la [consola de Firebase](https://console.firebase.google.com/) y selecciona tu proyecto "myoxxovision".
2. En el menú lateral, haz clic en "Firestore Database".
3. Si es la primera vez, haz clic en "Crear base de datos" y selecciona "Comenzar en modo de prueba" (luego cambiaremos las reglas).
4. Una vez creada la base de datos, ve a la pestaña "Reglas".
5. Reemplaza las reglas predeterminadas con el contenido del archivo `firestore.rules` de este proyecto.
6. Haz clic en "Publicar".

## Configuración de Authentication

1. En el menú lateral de la consola de Firebase, haz clic en "Authentication".
2. En la pestaña "Sign-in method", habilita el proveedor "Correo electrónico/contraseña".
3. Opcionalmente, puedes configurar el correo de verificación y las plantillas de recuperación de contraseña en la pestaña "Templates".

## Implementando las reglas de seguridad

Puedes usar la Firebase CLI para implementar las reglas de seguridad:

```bash
# Instalar Firebase CLI si no lo tienes
npm install -g firebase-tools

# Iniciar sesión en Firebase
firebase login

# Inicializar Firebase en el proyecto (si no lo has hecho)
firebase init

# Implementar las reglas de Firestore
firebase deploy --only firestore:rules
```

## Estructura de la base de datos

La aplicación utiliza la siguiente estructura en Firestore:

```
/users/{userId}
  - uid: string (ID del usuario en Authentication)
  - email: string
  - nombre: string
  - rol: string ('usuario', 'gerente', 'admin')
  - createdAt: timestamp
```

## Roles de usuario

La aplicación maneja tres roles de usuario:

1. **usuario**: Acceso básico para empleados regulares.
2. **gerente**: Acceso intermedio para gestión de tienda.
3. **admin**: Acceso completo a todas las funcionalidades.

Los nuevos usuarios se registran automáticamente con el rol "usuario". Para cambiar el rol a "admin" o "gerente", debes hacerlo manualmente en la consola de Firebase o crear una interfaz de administración.

## Crear el primer usuario administrador

Para crear el primer usuario administrador, sigue estos pasos:

1. Registra un nuevo usuario en la aplicación.
2. En la consola de Firebase, ve a Firestore y busca el documento del usuario recién creado en la colección "users".
3. Edita el documento y cambia el campo "rol" de "usuario" a "admin".
4. Guarda los cambios.

Este usuario ahora tendrá permisos de administrador en la aplicación. 