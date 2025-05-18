# Función de Análisis de Imágenes con Detección de Objetos

Esta Cloud Function analiza imágenes utilizando Google Cloud Vision API para:
1. Detectar objetos en la imagen
2. Analizar características básicas (colores, brillo, etc.)
3. Categorizar la imagen

## Requisitos previos

- Cuenta de Google Cloud Platform con facturación habilitada
- Google Cloud SDK instalado y configurado
- API de Cloud Vision habilitada en tu proyecto

## Cómo desplegar la función

1. **Habilitar la API de Cloud Vision**

   ```bash
   gcloud services enable vision.googleapis.com
   ```

2. **Configurar permisos para Cloud Vision API**

   Asegúrate de que la cuenta de servicio de la Cloud Function tenga el rol `roles/vision.user` asignado.

3. **Desplegar la función**

   ```bash
   cd web/oxxovision/cloud-functions/analyze-image
   gcloud functions deploy analyze-image \
     --runtime python310 \
     --trigger-http \
     --allow-unauthenticated \
     --memory 512MB \
     --timeout 60s
   ```

4. **Configurar CORS (opcional si ya está configurado)**

   ```bash
   gsutil cors set cors.json gs://your-project-id.appspot.com
   ```

## Probar la función

La función acepta solicitudes POST con:

1. URL de imagen como JSON: `{"url": "https://example.com/image.jpg"}`
2. Archivo de imagen directo usando form-data con el campo 'image'

## Respuesta

La respuesta incluye:

```json
{
  "success": true,
  "predictions": [
    {"category": "Categoría", "probability": 0.95}
  ],
  "objects": [
    {"name": "Objeto detectado", "confidence": 0.98, "type": "object"}
  ],
  "metadata": {
    "dimensions": {"width": 800, "height": 600},
    "format": "JPEG",
    "colorMode": "RGB",
    "avgBrightness": 125.5,
    "dominantColors": [
      {"rgb": "#ff0000", "count": 1234, "percentage": 45.6}
    ],
    "imageHash": "abcdef123456"
  }
}
```

## Solución de problemas

Si la detección de objetos no funciona:

1. Verifica que la API de Cloud Vision esté habilitada
2. Confirma que la cuenta de servicio tenga los permisos adecuados
3. Revisa los logs de la función para ver errores específicos:
   ```bash
   gcloud functions logs read analyze-image
   ``` 