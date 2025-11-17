"""
services/file_service.py
Servicio para gestión de archivos
"""
import os
from werkzeug.utils import secure_filename
from flask import current_app


class FileService:
    """Servicio para gestionar archivos subidos"""
    
    @staticmethod
    def guardar_archivo(archivo, id_usuario, id_incidencia, tipo_archivo='foto'):
        """
        Guarda archivo en el sistema de archivos
        
        Args:
            archivo: FileStorage object
            id_usuario: ID del usuario
            id_incidencia: ID de la incidencia
            tipo_archivo: Tipo ('foto', 'video', 'audio', 'documento')
        
        Returns:
            str: Ruta web del archivo guardado
        """
        if not archivo or archivo.filename == '':
            return None
        
        try:
            filename = secure_filename(archivo.filename)
            
            # RUTA CORREGIDA: static/uploads/[id_usuario]/[id_incidencia]/[tipo]
            ruta_dir = os.path.join('static', 'uploads', str(id_usuario), str(id_incidencia), tipo_archivo)
            os.makedirs(ruta_dir, exist_ok=True)
            
            # Guardar archivo
            ruta_completa = os.path.join(ruta_dir, filename)
            archivo.save(ruta_completa)
            
            # Retornar ruta normalizada para web (sin 'static/')
            # Flask sirve static/uploads como /static/uploads
            ruta_web = ruta_completa.replace('\\', '/')
            
            print(f"✅ Archivo guardado: {ruta_web}")
            return ruta_web
            
        except Exception as e:
            print(f"❌ Error guardando archivo: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    @staticmethod
    def guardar_multiples_archivos(archivos, id_usuario, id_incidencia, tipo_archivo='foto'):
        """Guarda múltiples archivos"""
        rutas = []
        
        for archivo in archivos:
            ruta = FileService.guardar_archivo(archivo, id_usuario, id_incidencia, tipo_archivo)
            if ruta:
                rutas.append(ruta)
        
        return rutas
    
    @staticmethod
    def validar_archivo(archivo, tipo_archivo='imagen'):
        """Valida archivo según tipo"""
        if not archivo or archivo.filename == '':
            return False, "No se proporcionó archivo"
        
        filename = secure_filename(archivo.filename)
        if '.' not in filename:
            return False, "Archivo sin extensión"
        
        extension = filename.rsplit('.', 1)[1].lower()
        
        # Validar extensión
        extensiones_permitidas = {
            'imagen': current_app.config.get('ALLOWED_IMAGE_EXTENSIONS', {'jpg', 'jpeg', 'png'}),
            'video': current_app.config.get('ALLOWED_VIDEO_EXTENSIONS', {'mp4', 'avi', 'mov'}),
            'audio': current_app.config.get('ALLOWED_AUDIO_EXTENSIONS', {'mp3', 'wav', 'ogg'}),
            'documento': current_app.config.get('ALLOWED_DOCUMENT_EXTENSIONS', {'pdf', 'docx'})
        }
        
        if extension not in extensiones_permitidas.get(tipo_archivo, set()):
            return False, f"Extensión .{extension} no permitida para {tipo_archivo}"
        
        # Validar tamaño
        archivo.seek(0, 2)  # Ir al final
        size = archivo.tell()
        archivo.seek(0)  # Volver al inicio
        
        max_size = current_app.config.get('MAX_FILE_SIZE', 16 * 1024 * 1024)
        if size > max_size:
            max_mb = max_size / (1024 * 1024)
            return False, f"Archivo excede tamaño máximo ({max_mb:.0f}MB)"
        
        return True, None
    
    @staticmethod
    def eliminar_archivo(ruta):
        """
        Elimina un archivo del sistema
        
        Args:
            ruta: Ruta del archivo a eliminar
        
        Returns:
            bool: True si se eliminó correctamente
        """
        try:
            if os.path.exists(ruta):
                os.remove(ruta)
                print(f"🗑️  Archivo eliminado: {ruta}")
                return True
            else:
                print(f"⚠️  Archivo no existe: {ruta}")
                return False
        except Exception as e:
            print(f"❌ Error eliminando archivo: {e}")
            return False
    
    @staticmethod
    def obtener_url_publica(ruta):
        """
        Convierte ruta de sistema a URL pública
        
        Args:
            ruta: Ruta del archivo (puede ser relativa o absoluta)
        
        Returns:
            str: URL pública completa
        """
        # Si ya es una URL completa, retornarla
        if isinstance(ruta, str) and ruta.startswith('http'):
            return ruta
        
        # Normalizar ruta
        ruta_norm = str(ruta).replace('\\', '/')
        
        # Determinar base URL según entorno
        try:
            if current_app.config.get('ENV') == 'production':
                base_url = 'https://munireque.pythonanywhere.com/'
            else:
                base_url = 'https://munireque.pythonanywhere.com/'
        except RuntimeError:
            # No hay contexto de Flask, usar producción por defecto
            base_url = 'https://munireque.pythonanywhere.com/'
        
        # Si la ruta ya incluye 'static/', usar directamente
        if 'static/' in ruta_norm:
            # Extraer desde 'static/' en adelante
            ruta_desde_static = ruta_norm[ruta_norm.index('static/'):]
            return base_url + ruta_desde_static
        
        # Si no, asumir que es relativa y agregar
        return base_url + ruta_norm
    
    @staticmethod
    def verificar_archivo_existe(ruta):
        """
        Verifica si un archivo existe
        
        Args:
            ruta: Ruta del archivo
        
        Returns:
            bool: True si existe
        """
        return os.path.exists(ruta) and os.path.isfile(ruta)