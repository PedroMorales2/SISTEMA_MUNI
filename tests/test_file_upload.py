# test_file_upload.py
from services.file_service import FileService
from werkzeug.datastructures import FileStorage
from io import BytesIO

# Simular archivo
archivo = FileStorage(
    stream=BytesIO(b"contenido de prueba"),
    filename="test.jpg",
    content_type="image/jpeg"
)

# Probar guardado
ruta = FileService.guardar_archivo(archivo, id_usuario=1, id_incidencia=123, tipo_archivo='foto')
print(f"Archivo guardado en: {ruta}")

# Probar URL pública
url = FileService.obtener_url_publica(ruta)
print(f"URL pública: {url}")

# Verificar que existe
existe = FileService.verificar_archivo_existe(ruta)
print(f"¿Existe? {existe}")