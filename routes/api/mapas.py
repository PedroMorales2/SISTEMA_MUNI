"""
routes/api/mapas.py
API para visualización de mapas
"""
from flask import Blueprint, jsonify
import traceback
import controladores.controlador_mapa as controlador_mapa
from utils.constants import *
from flask import request

mapas_bp = Blueprint('mapas', __name__)


@mapas_bp.route('/denuncias', methods=['GET'])
def obtener_coordenadas_denuncias():
    """Obtiene coordenadas de denuncias pendientes para el mapa"""
    try:
        denuncias = controlador_mapa.obtener_denuncias_pendientes()

        if not denuncias:
            return jsonify({"message": "No pending reports found"}), HTTP_NOT_FOUND

        # denuncias_con_fotos = []
        # for denuncia in denuncias:
        #     id_incidencia = denuncia['id_incidencia']
        #     fotos = controlador_mapa.obtener_fotos_por_denuncia(id_incidencia)
        #     denuncia['fotos'] = fotos
        #     denuncias_con_fotos.append(denuncia)

        return jsonify({"denuncias": denuncias}), HTTP_OK

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Error inesperado: {repr(e)}"}), HTTP_INTERNAL_ERROR


@mapas_bp.route('/emergencias', methods=['GET'])
def obtener_coordenadas_emergencias():
    """Obtiene coordenadas de emergencias pendientes para el mapa"""
    try:
        emergencias = controlador_mapa.obtener_emergencias_pendientes()

        if not emergencias:
            return jsonify({"message": "No pending emergencies found"}), HTTP_NOT_FOUND

        # emergencias_con_fotos = []
        # for emergencia in emergencias:
        #     id_incidencia = emergencia['id_incidencia']
        #     fotos = controlador_mapa.obtener_fotos_por_denuncia(id_incidencia)
        #     emergencia['fotos'] = fotos
        #     emergencias_con_fotos.append(emergencia)

        return jsonify({"emergencias": emergencias}), HTTP_OK

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Error inesperado: {repr(e)}"}), HTTP_INTERNAL_ERROR

@mapas_bp.route('/usuario_por_mes', methods=['POST'])
def obtener_x_mes_denuncia_emergencia():
    try:
        id_usuario = request.json.get('id_usuario')

        if not id_usuario:
            return jsonify({"error": "User not logged in"}), 401

        # Obtener denuncias y emergencias del último mes
        datos = controlador_mapa.obtener_x_mes_denuncia_emergencia(id_usuario)

        if datos:
            return jsonify(datos), 200
        else:
            return jsonify({"message": "No data found"}), 404

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500