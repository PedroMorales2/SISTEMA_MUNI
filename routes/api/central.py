"""
routes/api/central.py
API para panel administrativo central
"""
from flask import Blueprint, request, jsonify, current_app, session
from werkzeug.utils import secure_filename
import os
import traceback
import time

import controladores.controlador_central as controlador_central
from services.file_service import FileService
from utils.constants import *

central_bp = Blueprint('central', __name__)


# ============ AUTENTICACIÓN ============
@central_bp.route('/login', methods=['POST'])
def iniciar_sesion_central():
    """Inicio de sesión para administradores"""
    try:
        data = request.json
        usuario = data.get('user')
        contraseña = data.get('contrasena')

        usuario_data = controlador_central.iniciar_sesion(usuario, contraseña)

        if usuario_data:
            return jsonify({"usuario": usuario_data}), HTTP_OK
        else:
            return jsonify({"message": "Usuario no encontrado"}), HTTP_NOT_FOUND

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), HTTP_INTERNAL_ERROR


# ============ DENUNCIAS ============
@central_bp.route('/denuncias/pendientes/<id>', methods=['GET'])
def obtener_denuncias_pendientes(id):
    """Obtiene denuncias pendientes por área"""
    try:
        denuncias = controlador_central.obtener_denuncias_pendientes_central(id)

        if denuncias:
            return jsonify({"denuncias": denuncias}), HTTP_OK
        else:
            return jsonify({"message": "No pending reports found"}), HTTP_NOT_FOUND

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), HTTP_INTERNAL_ERROR


@central_bp.route('/denuncias/aceptadas/<id>', methods=['GET'])
def obtener_denuncias_aceptadas(id):
    """Obtiene denuncias aceptadas por área"""
    try:
        denuncias = controlador_central.obtener_denuncias_aceptadas_central(id)

        if denuncias:
            return jsonify({"denuncias": denuncias}), HTTP_OK
        else:
            return jsonify({"message": "No accepted reports found"}), HTTP_NOT_FOUND

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), HTTP_INTERNAL_ERROR


@central_bp.route('/denuncias/rechazadas/<id>', methods=['GET'])
def obtener_denuncias_rechazadas(id):
    """Obtiene denuncias rechazadas por área"""
    try:
        denuncias = controlador_central.obtener_denuncias_rechazadas_central(id)

        if denuncias:
            return jsonify({"denuncias": denuncias}), HTTP_OK
        else:
            return jsonify({"message": "No rejected reports found"}), HTTP_NOT_FOUND

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), HTTP_INTERNAL_ERROR


@central_bp.route('/denuncias/detalle/<id_denuncia>', methods=['GET'])
def obtener_denuncia_detalle(id_denuncia):
    """Obtiene detalle de una denuncia"""
    try:
        denuncia = controlador_central.obtener_denuncias_por_id(id_denuncia)

        if denuncia:
            fotos = controlador_central.obtener_fotos(id_denuncia)
            videos = controlador_central.obtener_videos(id_denuncia)
            audios = controlador_central.obtener_audio(id_denuncia)

            denuncia['fotos'] = fotos
            denuncia['videos'] = videos
            denuncia['audios'] = audios

            return jsonify({"denuncia": denuncia}), HTTP_OK
        else:
            return jsonify({"message": "No report found with that ID"}), HTTP_NOT_FOUND

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"An error occurred: {str(e)}"}), HTTP_INTERNAL_ERROR


# ============ EMERGENCIAS ============
@central_bp.route('/emergencias/pendientes/<id>', methods=['GET'])
def obtener_emergencias_pendientes(id):
    """Obtiene emergencias pendientes"""
    try:
        emergencias = controlador_central.obtener_emergencias_pendientes_central(id)

        if emergencias:
            return jsonify({"emergencias": emergencias}), HTTP_OK
        else:
            return jsonify({"message": "No pending emergencies found"}), HTTP_NOT_FOUND

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), HTTP_INTERNAL_ERROR


@central_bp.route('/emergencias/aceptadas/<id>', methods=['GET'])
def obtener_emergencias_aceptadas(id):
    """Obtiene emergencias aceptadas"""
    try:
        emergencias = controlador_central.obtener_emergencias_aceptadas_central(id)

        if emergencias:
            return jsonify({"emergencias": emergencias}), HTTP_OK
        else:
            return jsonify({"message": "No accepted emergencies found"}), HTTP_NOT_FOUND

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), HTTP_INTERNAL_ERROR


@central_bp.route('/emergencias/rechazadas/<id>', methods=['GET'])
def obtener_emergencias_rechazadas(id):
    """Obtiene emergencias rechazadas"""
    try:
        emergencias = controlador_central.obtener_emergencias_rechazadas_central(id)

        if emergencias:
            return jsonify({"emergencias": emergencias}), HTTP_OK
        else:
            return jsonify({"message": "No rejected emergencies found"}), HTTP_NOT_FOUND

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), HTTP_INTERNAL_ERROR


@central_bp.route('/emergencias/detalle/<id>', methods=['GET'])
def obtener_emergencia_detalle(id):
    """Obtiene detalle de una emergencia"""
    try:
        resultado = controlador_central.obtener_emergencia_por_id(id)

        if resultado:
            return jsonify({"emergencia": resultado}), HTTP_OK
        else:
            return jsonify({"error": "No se puede ver detalle emergencia"}), HTTP_INTERNAL_ERROR
            
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), HTTP_INTERNAL_ERROR


# ============ ACCIONES ============
@central_bp.route('/incidencia/aceptar/<id_denuncia>', methods=['POST'])
def aceptar_incidencia(id_denuncia):
    """Acepta una incidencia"""
    try:
        resultado = controlador_central.aceptar_denuncia(id_denuncia)

        if resultado:
            return jsonify({"message": "Report accepted successfully"}), HTTP_OK
        else:
            return jsonify({"error": "Error al aceptar"}), HTTP_INTERNAL_ERROR

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), HTTP_INTERNAL_ERROR


@central_bp.route('/incidencia/rechazar/<id_denuncia>', methods=['POST'])
def rechazar_incidencia(id_denuncia):
    """Rechaza una incidencia"""
    try:
        resultado = controlador_central.rechazar_denuncia(id_denuncia)

        if resultado:
            return jsonify({"message": "Report rejected successfully"}), HTTP_OK
        else:
            return jsonify({"error": "Error al rechazar"}), HTTP_INTERNAL_ERROR

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), HTTP_INTERNAL_ERROR


@central_bp.route('/incidencia/procesar/<id_denuncia>', methods=['POST'])
def procesar_denuncia(id_denuncia):
    """Procesa denuncia con descripción y archivo adjunto"""
    try:
        descripcion = request.form.get('descripcion')
        accion = request.form.get('accion')
        archivo = request.files.get('archivo')

        id_usuario = controlador_central.obtener_id_persona(id_denuncia)
        
        if accion not in ('aceptar', 'rechazar'):
            return jsonify({"error": "Acción inválida"}), HTTP_BAD_REQUEST

        ruta_archivo = None

        if archivo:
            is_valid, error_msg = FileService.validar_archivo(archivo, 'documento')
            
            if is_valid:
                filename = secure_filename(archivo.filename)
                timestamp = int(time.time())
                filename_final = f"{timestamp}_{filename}"

                upload_folder = f'static/uploads/{id_usuario}/{id_denuncia}/motivos'
                os.makedirs(upload_folder, exist_ok=True)
                
                filepath = os.path.join(upload_folder, filename_final)
                archivo.save(filepath)
                ruta_archivo = filepath

        if accion == 'aceptar':
            resultado = controlador_central.aceptar_denuncia(id_denuncia)
        else:
            resultado = controlador_central.rechazar_denuncia(id_denuncia)

        controlador_central.insertar_descripcion(id_denuncia, descripcion, ruta_archivo)

        if resultado:
            return jsonify({"message": f"Denuncia {accion} correctamente"}), HTTP_OK
        else:
            return jsonify({"error": f"No se pudo {accion} la denuncia"}), HTTP_INTERNAL_ERROR

    except Exception:
        return jsonify({"error": traceback.format_exc()}), HTTP_INTERNAL_ERROR


@central_bp.route('/motivo/<id_denuncia>', methods=['GET'])
def ver_motivo(id_denuncia):
    """Obtiene motivo de aceptación/rechazo"""
    try:
        motivo = controlador_central.obtener_motivo(id_denuncia)

        if motivo:
            return jsonify({"motivo": motivo}), HTTP_OK
        else:
            return jsonify({"message": "No se encontró el motivo"}), HTTP_NOT_FOUND

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), HTTP_INTERNAL_ERROR


# ============ ESTADÍSTICAS ============
# Nuevas rutas para agregar a tu archivo de rutas central_bp

# ============ NUEVAS APIS PARA DASHBOARD MEJORADO ============

@central_bp.route('/stats/severidad', methods=['GET'])
def obtener_severidad():
    """Obtiene estadísticas de severidad por tipo"""
    try:
        severidades = {
            "Ruidos molestos": controlador_central.obtener_ruidos(),
            "Bulling y violencia familiar": controlador_central.obtener_iluminacion(),
            "Ocupacion via publica": controlador_central.obtener_pistas(),
            "Parques y jardines": controlador_central.obtener_parques(),
            "Limpieza pública": controlador_central.obtener_limpieza(),
            "Negocios informales": controlador_central.obtener_negocios(),
            "Otros": controlador_central.obtener_otros(),
            "Peleas y conflictos": controlador_central.obtener_conflictos()
        }

        normalizados = []
        for valor in severidades.values():
            if valor <= 0:
                normalizados.append(1)
            elif valor >= 10:
                normalizados.append(5)
            else:
                normalizados.append(round((valor / 10) * 5, 2))

        return jsonify({
            "labels": list(severidades.keys()),
            "severidades": normalizados
        }), HTTP_OK

    except Exception as e:
        return jsonify({"error": str(e)}), HTTP_INTERNAL_ERROR
    
@central_bp.route('/stats/reportes_fecha', methods=['GET'])
def reportes_por_fecha():
    """Obtiene estadísticas de reportes por fecha"""
    try:
        datos = controlador_central.obtener_reportes_por_fecha()
        return jsonify(datos), HTTP_OK
    except Exception as e:
        return jsonify({"error": str(e)}), HTTP_INTERNAL_ERROR
    
@central_bp.route('/stats/ultima_emergencia', methods=['GET'])
def obtener_ultima_emergencia():
    """Obtiene última emergencia registrada"""
    try:
        ultima_emergencia = controlador_central.obtener_ultima_emergencia()

        if ultima_emergencia:
            return jsonify(ultima_emergencia), HTTP_OK
        else:
            return jsonify({"message": "No emergencies found"}), HTTP_NOT_FOUND
    except Exception as e:
        return jsonify({"error": str(e)}), HTTP_INTERNAL_ERROR

@central_bp.route('/stats/ultima_denuncia', methods=['GET'])
def obtener_ultima_denuncia():
    """Obtiene última denuncia registrada"""
    try:
        ultima_denuncia = controlador_central.obtener_ultima_denuncia()

        if ultima_denuncia:
            return jsonify(ultima_denuncia), HTTP_OK
        else:
            return jsonify({"message": "No reports found"}), HTTP_NOT_FOUND
    except Exception as e:
        return jsonify({"error": str(e)}), HTTP_INTERNAL_ERROR
    


@central_bp.route('/stats/totales_dia', methods=['GET'])
def obtener_totales_dia():
    """Obtiene totales del día actual"""
    try:
        return jsonify({
            "denuncias": controlador_central.obtener_total_denuncias(),
            "emergencias": controlador_central.obtener_total_emergencias()
        }), HTTP_OK
    except Exception as e:
        return jsonify({"error": str(e)}), HTTP_INTERNAL_ERROR

@central_bp.route('/stats/tendencias', methods=['GET'])
def obtener_tendencias():
    """Obtiene tendencias de denuncias y emergencias"""
    try:
        return jsonify({
            "denuncias": controlador_central.obtener_tendencia_denuncias(),
            "emergencias": controlador_central.obtener_tendencia_emergencias()
        }), HTTP_OK
    except Exception as e:
        return jsonify({"error": str(e)}), HTTP_INTERNAL_ERROR

@central_bp.route('/stats/alertas_recientes', methods=['GET'])
def obtener_alertas():
    """Obtiene alertas recientes de las últimas 24 horas"""
    try:
        alertas = controlador_central.obtener_alertas_recientes()
        return jsonify(alertas), HTTP_OK
    except Exception as e:
        return jsonify({"error": str(e)}), HTTP_INTERNAL_ERROR

@central_bp.route('/stats/actividad_real', methods=['GET'])
def obtener_actividad():
    """Obtiene actividad en tiempo real del día"""
    try:
        actividades = controlador_central.obtener_actividad_tiempo_real()
        return jsonify(actividades), HTTP_OK
    except Exception as e:
        return jsonify({"error": str(e)}), HTTP_INTERNAL_ERROR

@central_bp.route('/stats/por_hora', methods=['GET'])
def obtener_por_hora():
    """Obtiene estadísticas por hora del día actual"""
    try:
        datos = controlador_central.obtener_estadisticas_por_hora()
        return jsonify(datos), HTTP_OK
    except Exception as e:
        return jsonify({"error": str(e)}), HTTP_INTERNAL_ERROR

@central_bp.route('/stats/top_denuncias', methods=['GET'])
def obtener_top_denuncias():
    """Obtiene top 5 tipos de denuncias más frecuentes"""
    try:
        datos = controlador_central.obtener_top_denuncias()
        return jsonify(datos), HTTP_OK
    except Exception as e:
        return jsonify({"error": str(e)}), HTTP_INTERNAL_ERROR

@central_bp.route('/stats/resumen_semanal', methods=['GET'])
def obtener_resumen_semanal():
    """Obtiene resumen de la última semana"""
    try:
        datos = controlador_central.obtener_resumen_semanal()
        return jsonify(datos), HTTP_OK
    except Exception as e:
        return jsonify({"error": str(e)}), HTTP_INTERNAL_ERROR

# Modificación del endpoint de doughnut para no incluir riesgos
@central_bp.route('/stats/doughnut', methods=['GET'])
def reporte_doughnut():
    """Obtiene datos para gráfico doughnut (solo denuncias y emergencias)"""
    try:
        denuncia = controlador_central.obtener_conteo_denuncia()
        emergencia = controlador_central.obtener_conteo_emergencia()
        
        return jsonify({
            "denuncia": denuncia,
            "emergencia": emergencia
        }), HTTP_OK
    except Exception as e:
        return jsonify({"error": str(e)}), HTTP_INTERNAL_ERROR

# ============ GESTIÓN DE USUARIOS ============
@central_bp.route('/usuarios/correos', methods=['GET'])
def ver_correo_institucional():
    """Obtiene correos institucionales"""
    try:
        correo = controlador_central.consultar_correo_institucional()
        if correo:
            return jsonify({"message": correo}), HTTP_OK
        else:
            return jsonify({"message": "No se encontraron correos"}), HTTP_NOT_FOUND
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), HTTP_INTERNAL_ERROR


@central_bp.route('/usuarios/denuncias_disponibles', methods=['GET'])
def obtener_denuncias_disponibles():
    """Obtiene tipos de denuncias disponibles"""
    try:
        denuncias = controlador_central.obtener_denuncia()
        if denuncias:
            return jsonify({"message": denuncias}), HTTP_OK
        else:
            return jsonify({"message": "No se encontraron denuncias"}), HTTP_NOT_FOUND
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), HTTP_INTERNAL_ERROR
    
@central_bp.route('/usuarios/emergencias_disponibles', methods=['GET'])
def obtener_emergencias_disponibles():
    """Obtiene tipos de emergencias disponibles"""
    try:
        emergencias = controlador_central.obtener_emergencia()
        if emergencias:
            return jsonify({"message": emergencias}), HTTP_OK
        else:
            return jsonify({"message": "No se encontraron emergencias"}), HTTP_NOT_FOUND
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), HTTP_INTERNAL_ERROR


@central_bp.route('/usuarios/riesgos_disponibles', methods=['GET'])
def obtener_riesgos_disponibles():
    """Obtiene tipos de riesgos disponibles"""
    try:
        riesgos = controlador_central.obtener_riesgos()
        if riesgos:
            return jsonify({"message": riesgos}), HTTP_OK
        else:
            return jsonify({"message": "No se encontraron riesgos"}), HTTP_NOT_FOUND
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), HTTP_INTERNAL_ERROR


@central_bp.route('/usuarios/crear/denuncia', methods=['POST'])
def insertar_usuario_denuncia():
    """Crea nuevo usuario administrador"""
    try:
        data = request.json
        nombre = data.get('nombre')
        correo = data.get('correo')
        contra = data.get('contra')
        denuncias = data.get('denuncias', [])

        id_correo = controlador_central.insertar_correo(correo, nombre, contra)

        for id_denuncia in denuncias:
            controlador_central.insertar_denuncia_correo(id_correo, id_denuncia)

        return jsonify({
            "mensaje": "Usuario creado correctamente",
            "id_correo": id_correo
        }), HTTP_CREATED

    except Exception as e:
        return jsonify({"error": f"Error: {str(e)}"}), HTTP_INTERNAL_ERROR

@central_bp.route('/usuarios/crear/emergencia', methods=['POST'])
def insertar_usuario_emergencia():
    """Crea nuevo usuario administrador"""
    try:
        data = request.json
        nombre = data.get('nombre')
        correo = data.get('correo')
        contra = data.get('contra')
        denuncias = data.get('denuncias', [])

        id_correo = controlador_central.insertar_correo(correo, nombre, contra)

        for id_denuncia in denuncias:
            controlador_central.insertar_emergencia_correo(id_correo, id_denuncia)

        return jsonify({
            "mensaje": "Usuario creado correctamente",
            "id_correo": id_correo
        }), HTTP_CREATED

    except Exception as e:
        return jsonify({"error": f"Error: {str(e)}"}), HTTP_INTERNAL_ERROR


@central_bp.route('/usuarios/cambiar_password', methods=['POST'])
def cambiar_password():
    """Cambia contraseña de usuario administrador"""
    try:
        data = request.json
        id_usuario = data.get('id_usuario')
        nueva_contrasena = data.get('nueva_contrasena')

        if not id_usuario or not nueva_contrasena:
            return jsonify({"error": "Faltan datos"}), HTTP_BAD_REQUEST

        resultado = controlador_central.cambiar_contrasena(id_usuario, nueva_contrasena)

        if resultado:
            return jsonify({"mensaje": "Contraseña cambiada exitosamente"}), HTTP_OK
        else:
            return jsonify({"error": "No se pudo cambiar la contraseña"}), HTTP_INTERNAL_ERROR

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), HTTP_INTERNAL_ERROR
    
from datetime import datetime, timedelta, timezone

@central_bp.route('/stats/totales_pendientes', methods=['GET'])
def obtener_totales_pendientes():
    """Obtiene totales de incidencias pendientes"""
    try:
        id_usuario = session.get('id_usuario', 1)
        
        # Contar denuncias pendientes
        denuncias_pendientes = controlador_central.obtener_denuncias_pendientes_central(id_usuario)
        total_denuncias = len(denuncias_pendientes) if denuncias_pendientes else 0
        
        # Contar emergencias pendientes
        emergencias_pendientes = controlador_central.obtener_emergencias_pendientes_central(id_usuario)
        total_emergencias = len(emergencias_pendientes) if emergencias_pendientes else 0
        
        return jsonify({
            "denuncias_pendientes": total_denuncias,
            "emergencias_pendientes": total_emergencias
        }), HTTP_OK
    except Exception as e:
        traceback.print_exc()
        return jsonify({"denuncias_pendientes": 0, "emergencias_pendientes": 0}), HTTP_OK


@central_bp.route('/stats/alertas_pendientes', methods=['GET'])
def obtener_alertas_pendientes():
    try:
        import logging
        from datetime import datetime

        logging.warning(">>> INICIO obtener_alertas_pendientes")

        id_usuario = session.get('id_usuario', 1)
        logging.warning(f"ID usuario: {id_usuario}")

        alertas = []

        # ==========================
        # DENUNCIAS
        # ==========================
        denuncias = controlador_central.obtener_denuncias_pendientes_central_dos(id_usuario)
        logging.warning(f"Denuncias encontradas: {len(denuncias)}")

        for d in denuncias:
            fecha = d.get("fecha")
            hora = d.get("hora")

            logging.warning(f"DENUNCIA ID {d.get('id_incidencia')} - fecha={fecha} hora={hora}")

            fecha_completa = None
            if fecha and hora:
                fecha_completa = f"{fecha} {hora}"
            elif fecha:
                fecha_completa = f"{fecha} 00:00:00"

            alertas.append({
                "id": d.get('id_incidencia'),
                "tipo": "warning",
                "tipo_incidencia": "denuncia",
                "descripcion": f"Denuncia: {d.get('denuncia', 'Sin especificar')}",
                "tiempo": calcular_tiempo_relativo(fecha_completa),
                "fecha_creacion": fecha_completa
            })

        # ==========================
        # EMERGENCIAS
        # ==========================
        emergencias = controlador_central.obtener_emergencias_pendientes_central_dos(id_usuario)
        logging.warning(f"Emergencias encontradas: {len(emergencias)}")

        for e in emergencias:
            fecha = e.get("fecha")
            hora = e.get("hora")

            logging.warning(f"EMERGENCIA ID {e.get('id_incidencia')} - fecha={fecha} hora={hora}")

            fecha_completa = None
            if fecha and hora:
                fecha_completa = f"{fecha} {hora}"
            elif fecha:
                fecha_completa = f"{fecha} 00:00:00"

            alertas.append({
                "id": e.get('id_incidencia'),
                "tipo": "danger",
                "tipo_incidencia": "emergencia",
                "descripcion": f"Emergencia: {e.get('nombre_emergencia', 'Sin especificar')}",
                "tiempo": calcular_tiempo_relativo(fecha_completa),
                "fecha_creacion": fecha_completa
            })

        # ==========================
        # ORDENAMIENTO
        # ==========================
        logging.warning(">>> ORDENANDO ALERTAS POR FECHA")

        def parse_fecha(x):
            valor = x.get("fecha_creacion")
            if not valor:
                logging.error(f"ALERTA SIN FECHA: {x}")
                return datetime.min
            try:
                return datetime.strptime(valor, "%Y-%m-%d %H:%M:%S")
            except Exception as err:
                logging.error(f"ERROR PARSEANDO FECHA '{valor}': {err}")
                return datetime.min

        alertas.sort(key=lambda x: x['id'], reverse=True)

        # ==========================
        # LIMPIEZA
        # ==========================
        for a in alertas:
            logging.warning(f"ALERTA ORDENADA -> {a}")
            a.pop("fecha_creacion", None)

        logging.warning(">>> FIN obtener_alertas_pendientes")

        return jsonify(alertas[:10]), 200

    except Exception as e:
        traceback.print_exc()
        logging.error(f"ERROR obtener_alertas_pendientes: {e}")
        return jsonify({"error": str(e)}), 500


def convertir_fecha_datetime(fecha_str):
    if not fecha_str:
        print("⚠️ convertir_fecha_datetime: fecha_str es None")
        return None
    
    formatos = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
    ]
    
    for fmt in formatos:
        try:
            f = datetime.strptime(str(fecha_str).strip(), fmt)
            return f
        except ValueError:
            continue
    
    print(f"⚠️ convertir_fecha_datetime: no se pudo parsear '{fecha_str}'")
    return None

# TZ_PERU = timezone(timedelta(hours=-5))

TZ_PERU = timezone(timedelta(hours=-5))

def calcular_tiempo_relativo(fecha_str):
    """Calcula tiempo relativo corrigiendo diferencia UTC/Perú (UTC-5)."""
    try:
        if not fecha_str:
            return "Fecha desconocida"

        formatos = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
        ]

        fecha = None

        # Parsear fecha string → datetime
        for fmt in formatos:
            try:
                fecha = datetime.strptime(str(fecha_str).strip(), fmt)
                break
            except:
                continue

        if fecha is None:
            return "Fecha desconocida"

        # Asumir que la fecha almacenada es hora Perú pero sin TZ
        fecha = fecha.replace(tzinfo=TZ_PERU)

        # CORRECCIÓN: obtener hora UTC real de PythonAnywhere
        ahora_utc = datetime.now(timezone.utc)

        # Convertir UTC → Perú
        ahora = ahora_utc.astimezone(TZ_PERU)

        diferencia = ahora - fecha
        segundos = diferencia.total_seconds()

        if segundos < 0:
            return "Hace un momento"
        elif segundos < 60:
            return "Hace un momento"
        elif segundos < 3600:
            return f"Hace {int(segundos/60)} min"
        elif segundos < 86400:
            return f"Hace {int(segundos/3600)}h"
        elif segundos < 2592000:
            return f"Hace {int(segundos/86400)}d"
        else:
            meses = int(segundos / 2592000)
            return f"Hace {meses} mes" + ("es" if meses > 1 else "")

    except Exception as e:
        print("ERROR TIEMPO:", e)
        return "Fecha desconocida"

