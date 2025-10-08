"""
routes/api/emergencias.py
API para gestión de emergencias
"""
from flask import Blueprint, request, jsonify
import controladores.controlador_emergencia as controlador_emergencia
from utils.constants import *

emergencias_bp = Blueprint('emergencias', __name__)


@emergencias_bp.route('/registrar', methods=['POST'])
def registrar_emergencia():
    """Registra una nueva emergencia"""
    try:
        data = request.json
        ubicacion = data.get('ubicacion')
        descripcion = data.get('descripcion')
        nivel_indicencia = data.get('nivel_indicencia')
        estado = data.get('estado', ESTADO_PENDIENTE)
        fecha = data.get('fecha')
        hora = data.get('hora')
        id_tipo_incidencia = TIPO_EMERGENCIA
        id_usuario = data.get('id_usuario')
        id_numero_emergencia = data.get('id_numero_emergencia')

        if not all([ubicacion, descripcion, nivel_indicencia, fecha, hora, id_usuario]):
            return jsonify({"error": MSG_CAMPOS_REQUERIDOS}), HTTP_BAD_REQUEST

        id_emergencia = controlador_emergencia.registrar_emergencia(
            ubicacion, descripcion, nivel_indicencia, estado, fecha, hora,
            id_tipo_incidencia, id_usuario, id_numero_emergencia
        )

        if id_emergencia:
            return jsonify({
                "message": "Emergencia registrada correctamente",
                "id_emergencia": id_emergencia
            }), HTTP_CREATED
        else:
            return jsonify({"error": "Emergencia no registrada"}), HTTP_INTERNAL_ERROR

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), HTTP_INTERNAL_ERROR