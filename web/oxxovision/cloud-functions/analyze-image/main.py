import functions_framework
from flask import jsonify, Request
import requests
from PIL import Image
import io
import hashlib
import time

@functions_framework.http
def analyze_image(request: Request):
    """
    Función HTTP para analizar una imagen.
    Soporta dos métodos de envío:
    1. URL de imagen como JSON: {"url": "https://example.com/image.jpg"}
    2. Archivo de imagen en un formulario multipart/form-data con el campo 'image'
    
    Returns:
        Resultado del análisis en formato JSON
    """
    # Configurar CORS para permitir solicitudes desde cualquier origen
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept, Origin, Authorization',
        'Access-Control-Max-Age': '3600'
    }
    
    # Manejar solicitudes OPTIONS (preflight CORS)
    if request.method == 'OPTIONS':
        return ('', 204, headers)
    
    # Comprobar si es una solicitud POST
    if request.method != 'POST':
        return (jsonify({'error': 'Método no permitido. Use POST.'}), 405, headers)
    
    try:
        # Verificar si se envió una URL en formato JSON
        request_json = request.get_json(silent=True)
        if request_json and 'url' in request_json:
            image_url = request_json['url']
            print(f"Recibida solicitud para analizar URL: {image_url}")
            
            response = requests.get(image_url)
            if response.status_code != 200:
                error_msg = f'Error descargando imagen, código: {response.status_code}'
                print(error_msg)
                return (jsonify({
                    'success': False,
                    'error': error_msg,
                    'description': 'Error accessing image URL'
                }), 400, headers)
            
            image_data = response.content
        # Verificar si se envió un archivo
        elif request.files and 'image' in request.files:
            image_file = request.files['image']
            print(f"Recibida solicitud para analizar archivo: {image_file.filename}")
            image_data = image_file.read()
        else:
            error_msg = 'No se encontró imagen en la solicitud'
            print(error_msg)
            print(f"Contenido de la solicitud: {request.data}")
            return (jsonify({
                'success': False,
                'error': error_msg,
                'description': 'Missing image data'
            }), 400, headers)
        
        # Analizar la imagen
        result = analyze_image_data(image_data)
        print(f"Análisis completado exitosamente")
        return (jsonify(result), 200, headers)
    
    except Exception as e:
        error_msg = f"Error processing request: {str(e)}"
        print(error_msg)
        return (jsonify({
            'success': False,
            'error': str(e),
            'description': 'Server error processing request'
        }), 500, headers)

def analyze_image_data(image_data):
    """
    Analiza una imagen en memoria usando Pillow.
    """
    try:
        # Crear un objeto de imagen desde los bytes
        image = Image.open(io.BytesIO(image_data))
        
        # Obtener información básica
        width, height = image.size
        format_type = image.format
        mode = image.mode
        
        # Reducir imagen para análisis
        small_image = image.resize((100, 100))
        
        # Convertir a RGB si es necesario
        if small_image.mode != 'RGB':
            small_image = small_image.convert('RGB')
        
        # Analizar colores dominantes
        colors = {}
        for y in range(small_image.height):
            for x in range(small_image.width):
                r, g, b = small_image.getpixel((x, y))
                # Simplificar colores agrupando tonos similares
                key = (r//32, g//32, b//32)
                if key in colors:
                    colors[key] += 1
                else:
                    colors[key] = 1
        
        # Obtener los 5 colores más dominantes
        dominant_colors = sorted(
            [(k, v) for k, v in colors.items()], 
            key=lambda x: x[1], 
            reverse=True
        )[:5]
        
        # Convertir a formato de color hexadecimal
        dominant_colors_hex = [
            {
                "rgb": f"#{k[0]*32:02x}{k[1]*32:02x}{k[2]*32:02x}",
                "count": v,
                "percentage": (v / (small_image.width * small_image.height)) * 100
            }
            for k, v in dominant_colors
        ]
        
        # Calcular brillo promedio
        brightness_sum = 0
        pixel_count = small_image.width * small_image.height
        for y in range(small_image.height):
            for x in range(small_image.width):
                r, g, b = small_image.getpixel((x, y))
                brightness = (r + g + b) / 3
                brightness_sum += brightness
        
        avg_brightness = brightness_sum / pixel_count
        
        # Determinar si es una imagen clara u oscura
        is_dark = avg_brightness < 128
        
        # Calcular hash de la imagen para identificación
        image_hash = hashlib.md5(small_image.tobytes()).hexdigest()
        
        # Analizar composición de color
        # Contar píxeles en diferentes rangos de color
        red_pixels = 0
        green_pixels = 0
        blue_pixels = 0
        
        for y in range(small_image.height):
            for x in range(small_image.width):
                r, g, b = small_image.getpixel((x, y))
                if r > max(g, b) + 20:
                    red_pixels += 1
                elif g > max(r, b) + 20:
                    green_pixels += 1
                elif b > max(r, g) + 20:
                    blue_pixels += 1
        
        # Calcular porcentajes
        red_percent = (red_pixels / pixel_count) * 100
        green_percent = (green_pixels / pixel_count) * 100
        blue_percent = (blue_pixels / pixel_count) * 100
        
        # Determinar categoría principal basada en colores y patrones
        categories = []
        
        # Categorías basadas en colores
        if red_percent > 40:
            categories.append({"category": "Rojo predominante", "probability": red_percent / 100})
        if green_percent > 40:
            categories.append({"category": "Verde predominante", "probability": green_percent / 100})
        if blue_percent > 40:
            categories.append({"category": "Azul predominante", "probability": blue_percent / 100})
        
        # Categorías basadas en brillo
        if is_dark:
            categories.append({"category": "Imagen oscura", "probability": (255 - avg_brightness) / 255})
        else:
            categories.append({"category": "Imagen clara", "probability": avg_brightness / 255})
        
        # Categorías basadas en tamaño y resolución
        if width > 1000 and height > 1000:
            categories.append({"category": "Alta resolución", "probability": 0.95})
        
        # Añadir categoría basada en orientación
        if width > height:
            categories.append({"category": "Imagen horizontal", "probability": 0.99})
        elif height > width:
            categories.append({"category": "Imagen vertical", "probability": 0.99})
        else:
            categories.append({"category": "Imagen cuadrada", "probability": 0.99})
        
        # Ordenar categorías por probabilidad
        categories = sorted(categories, key=lambda x: x["probability"], reverse=True)
        
        # Asegurarse de tener al menos 5 categorías
        while len(categories) < 5:
            # Añadir categorías basadas en tiempo para llenar si faltan
            timestamp = time.time()
            random_value = (hash(str(timestamp)) % 100) / 100
            
            if len(categories) == 0:
                categories.append({"category": "Imagen", "probability": 0.8})
            elif len(categories) == 1:
                categories.append({"category": "Fotografía", "probability": 0.7})
            elif len(categories) == 2:
                categories.append({"category": "Gráfico", "probability": 0.6})
            elif len(categories) == 3:
                categories.append({"category": "Digital", "probability": 0.5})
            elif len(categories) == 4:
                categories.append({"category": "Visual", "probability": 0.4})
        
        return {
            "success": True,
            "predictions": categories[:5],
            "metadata": {
                "dimensions": {"width": width, "height": height},
                "format": format_type,
                "colorMode": mode,
                "avgBrightness": avg_brightness,
                "dominantColors": dominant_colors_hex,
                "imageHash": image_hash
            }
        }
        
    except Exception as e:
        print(f"Error analyzing image: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "description": "Error analyzing image"
        } 