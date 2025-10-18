"""
routes/api/denuncias.py
API para gestión de denuncias
"""
from flask import Blueprint, request, jsonify, current_app
import traceback

import controladores.controlador_denuncia as controlador_denuncia
import controladores.controlador_detalle_denuncia as controlador_detalle
from services.file_service import FileService
from utils.formatters import serializar_denuncia, parsear_ubicacion, convertir_estado_texto
from utils.constants import *

denuncias_bp = Blueprint('denuncias', __name__)


@denuncias_bp.route('/registrar', methods=['POST'])
def registrar_denuncia():
    """Registra una nueva denuncia"""
    try:
        # Extraer datos del form-data
        id_usuario = request.form.get('id_usuario')
        ubicacion = request.form.get('ubicacion')
        descripcion = request.form.get('descripcion')
        nivel_incidencia = request.form.get('nivel_incidencia')
        fecha = request.form.get('fecha')
        hora = request.form.get('hora')
        id_tipo_incidencia = request.form.get('id_tipo_incidencia')
        id_denuncia = request.form.get('id_denuncia')

        # Validar campos obligatorios
        if not all([id_usuario, ubicacion, descripcion, nivel_incidencia, fecha, hora, id_tipo_incidencia]):
            return jsonify({"error": MSG_CAMPOS_REQUERIDOS}), HTTP_BAD_REQUEST

        estado = ESTADO_PENDIENTE

        # Registrar incidencia
        id_incidencia = controlador_denuncia.registrar_denuncia(
            ubicacion=ubicacion,
            descripcion=descripcion,
            nivel_incidencia=nivel_incidencia,
            estado=estado,
            fecha=fecha,
            hora=hora,
            id_tipo_incidencia=id_tipo_incidencia,
            id_usuario=id_usuario,
            id_denuncia=id_denuncia
        )

        if not id_incidencia:
            return jsonify({"error": "Denuncia no registrada"}), HTTP_INTERNAL_ERROR

        # Obtener correos para notificar
        correos = controlador_denuncia.obtener_correo_denuncia(id_denuncia)
        
        # Enviar notificaciones
        email_service = current_app.email_service
        resultado_emails = email_service.enviar_notificaciones_multiples(correos, id_incidencia)

        # Guardar archivos multimedia
        fotos = request.files.getlist('fotos')
        audios = request.files.getlist('audios')
        videos = request.files.getlist('videos')

        for foto in fotos:
            ruta = FileService.guardar_archivo(foto, id_usuario, id_incidencia, 'foto')
            if ruta:
                controlador_denuncia.registrar_foto(id_incidencia, ruta)

        for audio in audios:
            ruta = FileService.guardar_archivo(audio, id_usuario, id_incidencia, 'audio')
            if ruta:
                controlador_denuncia.registrar_audio(id_incidencia, ruta)

        for video in videos:
            ruta = FileService.guardar_archivo(video, id_usuario, id_incidencia, 'video')
            if ruta:
                controlador_denuncia.registrar_video(id_incidencia, ruta)

        return jsonify({
            "message": "Denuncia registrada correctamente",
            "id_incidencia": id_incidencia,
            "emails_enviados": resultado_emails['enviados']
        }), HTTP_CREATED

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Error inesperado: {repr(e)}"}), HTTP_INTERNAL_ERROR


