"""
routes/api/emergencias.py
API para gestión de emergencias con audio
"""
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
import controladores.controlador_emergencia as controlador_emergencia
from utils.constants import *
import os
from datetime import datetime

emergencias_bp = Blueprint('emergencias', __name__)

ALLOWED_EXTENSIONS = {'3gp', 'mp3', 'wav', 'm4a'}

# Obtener carpeta de configuración o usar default
try:
    from config import Config
    UPLOAD_FOLDER = Config.UPLOAD_FOLDER
except:
    UPLOAD_FOLDER = 'uploads/audios_emergencias'

# Asegurar que existe el directorio
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    """Verifica si el archivo tiene una extensión permitida"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@emergencias_bp.route('/registrar', methods=['POST'])
def registrar_emergencia():
    """Registra una nueva emergencia con audio"""
    try:
        # Validar que venga un archivo de audio
        if 'audio' not in request.files:
            return jsonify({"error": "No se envió archivo de audio"}), HTTP_BAD_REQUEST
        
        audio_file = request.files['audio']
        
        if audio_file.filename == '':
            return jsonify({"error": "Archivo de audio vacío"}), HTTP_BAD_REQUEST
        
        if not allowed_file(audio_file.filename):
            return jsonify({"error": "Formato de audio no permitido"}), HTTP_BAD_REQUEST

        # Obtener datos del formulario
        ubicacion = request.form.get('ubicacion')
        descripcion = request.form.get('descripcion')
        nivel_indicencia = request.form.get('nivel_indicencia')
        estado = request.form.get('estado', ESTADO_PENDIENTE)
        fecha = request.form.get('fecha')
        hora = request.form.get('hora')
        id_tipo_incidencia = TIPO_EMERGENCIA
        id_usuario = request.form.get('id_usuario')
        id_numero_emergencia = request.form.get('id_numero_emergencia')

        # Validar campos obligatorios
        if not all([ubicacion, descripcion, nivel_indicencia, fecha, hora, id_usuario, id_numero_emergencia]):
            return jsonify({"error": MSG_CAMPOS_REQUERIDOS}), HTTP_BAD_REQUEST

        # Primero registrar la emergencia para obtener el id_incidencia
        id_emergencia = controlador_emergencia.registrar_emergencia(
            ubicacion=ubicacion,
            descripcion=descripcion,
            nivel_incidencia=nivel_indicencia,
            estado=estado,
            fecha=fecha,
            hora=hora,
            id_tipo_incidencia=id_tipo_incidencia,
            id_usuario=int(id_usuario),
            id_numero_emergencia=int(id_numero_emergencia),
            ruta_audio=None  # Primero sin audio
        )

        if not id_emergencia:
            return jsonify({"error": "Emergencia no registrada"}), HTTP_INTERNAL_ERROR

        # Ahora guardar el archivo de audio con la estructura: UPLOAD_FOLDER/id_usuario/id_incidencia/audio
        user_folder = os.path.join(UPLOAD_FOLDER, str(id_usuario), str(id_emergencia))
        os.makedirs(user_folder, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = secure_filename(audio_file.filename)
        extension = filename.rsplit('.', 1)[1].lower()
        audio_filename = f"audio_{timestamp}.{extension}"
        audio_path = os.path.join(user_folder, audio_filename)
        
        # Guardar el archivo
        audio_file.save(audio_path)

        # Registrar el audio en la tabla audio
        exito_audio = controlador_emergencia.registrar_audio(audio_path, id_emergencia)

        if id_emergencia:
            return jsonify({
                "message": "Emergencia registrada correctamente",
                "id_emergencia": id_emergencia,
                "audio_guardado": audio_filename
            }), HTTP_CREATED
        else:
            # Si falla el registro, eliminar el audio guardado
            if os.path.exists(audio_path):
                os.remove(audio_path)
            return jsonify({"error": "Emergencia no registrada"}), HTTP_INTERNAL_ERROR

    except Exception as e:
        return jsonify({"error": f"Error al procesar emergencia: {str(e)}"}), HTTP_INTERNAL_ERROR


@emergencias_bp.route('/audio/<int:id_audio>', methods=['GET'])
def obtener_audio(id_audio):
    """Obtiene el audio por su ID"""
    try:
        ruta_audio = controlador_emergencia.obtener_ruta_audio(id_audio)
        
        if not ruta_audio or not os.path.exists(ruta_audio):
            return jsonify({"error": "Audio no encontrado"}), HTTP_NOT_FOUND
        
        return send_file(ruta_audio, mimetype='audio/3gp')
    
    except Exception as e:
        return jsonify({"error": f"Error al obtener audio: {str(e)}"}), HTTP_INTERNAL_ERROR


@emergencias_bp.route('/incidencia/<int:id_incidencia>/audio', methods=['GET'])
def obtener_audio_por_incidencia(id_incidencia):
    """Obtiene el audio asociado a una incidencia específica"""
    try:
        audio_info = controlador_emergencia.obtener_audio_por_incidencia(id_incidencia)
        
        if not audio_info:
            return jsonify({"error": "No se encontró audio para esta incidencia"}), HTTP_NOT_FOUND
        
        id_audio, ubicacion_audio = audio_info
        
        if not os.path.exists(ubicacion_audio):
            return jsonify({"error": "Archivo de audio no encontrado"}), HTTP_NOT_FOUND
        
        return send_file(ubicacion_audio, mimetype='audio/3gp')
    
    except Exception as e:
        return jsonify({"error": f"Error al obtener audio: {str(e)}"}), HTTP_INTERNAL_ERROR


@emergencias_bp.route('/emergencias/usuario/<int:id_usuario>/pendientes', methods=['GET'])
def obtener_emergencias_pendientes(id_usuario):
    """Obtiene las emergencias pendientes de un usuario"""
    try:
        emergencias = controlador_emergencia.obtener_emergencias_por_usuario_pendiente(id_usuario)
        return jsonify({"emergencias": emergencias}), HTTP_OK
    except Exception as e:
        return jsonify({"error": f"Error al obtener emergencias: {str(e)}"}), HTTP_INTERNAL_ERROR


@emergencias_bp.route('/emergencias/usuario/<int:id_usuario>/resueltas', methods=['GET'])
def obtener_emergencias_resueltas(id_usuario):
    """Obtiene las emergencias resueltas de un usuario"""
    try:
        emergencias = controlador_emergencia.obtener_emergencias_por_usuario_resuelto(id_usuario)
        return jsonify({"emergencias": emergencias}), HTTP_OK
    except Exception as e:
        return jsonify({"error": f"Error al obtener emergencias: {str(e)}"}), HTTP_INTERNAL_ERROR


@emergencias_bp.route('/emergencias/todas', methods=['GET'])
def obtener_todas_emergencias():
    """Lista todas las emergencias del sistema"""
    try:
        emergencias = controlador_emergencia.listar_todas_emergencias()
        return jsonify({"emergencias": emergencias}), HTTP_OK
    except Exception as e:
        return jsonify({"error": f"Error al listar emergencias: {str(e)}"}), HTTP_INTERNAL_ERROR