"""
routes/api/denuncias.py
API para gestión de denuncias
"""
from flask import Blueprint, request, jsonify, current_app
import traceback

import controladores.controlador_incidencia as controlador_incidencia
import controladores.controlador_detalle_incidencia as controlador_detalle
from services.file_service import FileService
from utils.formatters import serializar_denuncia, parsear_ubicacion, convertir_estado_texto
from utils.constants import *

incidencias_bp = Blueprint('incidencias', __name__)


@incidencias_bp.route('/pendientes', methods=['POST'])
def obtener_incidencias_pendientes():
    """Obtiene incidencias pendientes de un usuario"""
    try:
        id_usuario = request.json.get('id_usuario')
        id_seteo = request.json.get('id_incidencia')

        if not id_usuario:
            return jsonify({"error": MSG_USUARIO_NO_AUTENTICADO}), HTTP_UNAUTHORIZED

        if id_seteo == TIPO_EMERGENCIA:
            denuncias = controlador_incidencia.obtener_denuncias_por_usuario_pendiente_dos(id_usuario, id_seteo)
        else:
            denuncias = controlador_incidencia.obtener_denuncias_por_usuario_pendiente(id_usuario, id_seteo)

        denuncias_serializadas = [serializar_denuncia(d) for d in denuncias]

        if denuncias_serializadas:
            return jsonify({"denuncias": denuncias_serializadas}), HTTP_OK
        else:
            return jsonify({"message": "No se encontraron denuncias pendientes"}), HTTP_NOT_FOUND

    except Exception as e:
        return jsonify({"error": f"Ocurrió un error: {str(e)}"}), HTTP_INTERNAL_ERROR


@incidencias_bp.route('/resueltas', methods=['POST'])
def obtener_incidencias_resueltas():
    """Obtiene incidencias resueltas de un usuario"""
    try:
        id_usuario = request.json.get('id_usuario')
        id_seteo = request.json.get('id_incidencia')

        if not id_usuario:
            return jsonify({"error": MSG_USUARIO_NO_AUTENTICADO}), HTTP_UNAUTHORIZED

        if id_seteo == TIPO_EMERGENCIA:
            denuncias = controlador_incidencia.obtener_denuncias_por_usuario_resuelto_dos(id_usuario, id_seteo)
        else:
            denuncias = controlador_incidencia.obtener_denuncias_por_usuario_resuelto(id_usuario, id_seteo)

        denuncias_serializadas = [serializar_denuncia(d) for d in denuncias]

        if denuncias_serializadas:
            return jsonify({"denuncias": denuncias_serializadas}), HTTP_OK
        else:
            return jsonify({"message": "No se encontraron denuncias resueltas"}), HTTP_NOT_FOUND

    except Exception as e:
        return jsonify({"error": f"Ocurrió un error: {str(e)}"}), HTTP_INTERNAL_ERROR


@incidencias_bp.route('/detalle', methods=['POST'])
def obtener_detalle_incidencia():
    """Obtiene detalle completo de una incidencia"""
    try:
        data = request.get_json()
        id_incidencia = data.get('id_incidencia')

        if not id_incidencia:
            return jsonify({"status": "error", "message": "ID de incidencia requerido"}), HTTP_BAD_REQUEST

        detalles = controlador_detalle.obtener_detalles(id_incidencia)
        
        if not detalles:
            return jsonify({"status": "error", "message": "Incidencia no encontrada"}), HTTP_NOT_FOUND

        interceptarios = controlador_detalle.obtener_interceptarios(detalles['id_denuncia'])
        motivos_raw = controlador_detalle.obtener_motivos(id_incidencia)

        # Procesar archivos multimedia
        def procesar_archivos(archivos_str):
            if not archivos_str:
                return []
            archivos = [archivo.strip() for archivo in archivos_str.split(',') if archivo.strip()]
            return [FileService.obtener_url_publica(a) for a in archivos]

        motivos_procesados = []
        correos_con_motivo = set()

        for motivo in motivos_raw:
            motivo_dict = {
                "descripcion": motivo['descripcion'],
                "archivo_adjunto": FileService.obtener_url_publica(motivo['archivo_adjunto']) if motivo.get('archivo_adjunto') else None,
                "id_correo": motivo['id_correo'],
                "fecha_aceptacion": motivo['fecha_aceptacion'].strftime('%Y-%m-%d %H:%M:%S') if motivo['fecha_aceptacion'] else None
            }
            motivos_procesados.append(motivo_dict)
            if motivo['id_correo']:
                correos_con_motivo.add(motivo['id_correo'])

        destinos = []
        for interceptario in interceptarios:
            estado_destino = "pendiente"
            if interceptario['id_correo'] in correos_con_motivo:
                if detalles['estado'] == ESTADO_ACEPTADO:
                    estado_destino = "aceptado"
                elif detalles['estado'] == ESTADO_RECHAZADO:
                    estado_destino = "rechazado"

            destinos.append({
                "id_correo": interceptario['id_correo'],
                "correo": interceptario['correo'],
                "nombre_area": interceptario['nombre_area'],
                "estado": estado_destino
            })

        fotos = procesar_archivos(detalles['fotos'])
        videos = procesar_archivos(detalles['videos'])
        audios = procesar_archivos(detalles['audios'])

        ubicacion_coords = parsear_ubicacion(detalles['ubicacion'])

        respuesta = {
            "status": "success",
            "data": {
                "informacion_basica": {
                    "denuncia_nombre": detalles['denuncia_nombre'],
                    "descripcion": detalles['descripcion'],
                    "fecha": detalles['fecha'].strftime('%Y-%m-%d') if detalles['fecha'] else None,
                    "hora": str(detalles['hora']) if detalles['hora'] else None,
                    "estado": detalles['estado'],
                    "estado_texto": convertir_estado_texto(detalles['estado']),
                    "id_denuncia": detalles['id_denuncia']
                },
                "ubicacion": {
                    "coordenadas_texto": detalles['ubicacion'],
                    "latitud": ubicacion_coords["latitud"],
                    "longitud": ubicacion_coords["longitud"]
                },
                "destinos": destinos,
                "multimedia": {
                    "fotos": fotos,
                    "videos": videos,
                    "audios": audios,
                    "total_archivos": len(fotos) + len(videos) + len(audios)
                },
                "motivos": motivos_procesados,
                "linea_tiempo": {
                    "pendiente": True,
                    "aceptada": detalles['estado'] == ESTADO_ACEPTADO,
                    "rechazada": detalles['estado'] == ESTADO_RECHAZADO,
                    "fecha_resolucion": motivos_procesados[0]["fecha_aceptacion"] if motivos_procesados else None
                }
            }
        }
        
        return jsonify(respuesta), HTTP_OK

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), HTTP_INTERNAL_ERROR