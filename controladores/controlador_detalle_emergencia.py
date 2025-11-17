# controlador_detalle_emergencia.py
from utils.database import obtenerconexion as obtener_conexion
import os

def obtener_detalles_emergencia(id_incidencia):
    """Obtiene detalles de una emergencia desde la tabla incidencia"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """SELECT 
        e.nombre_emergencia,
        i.descripcion,
        i.fecha,
        i.hora,
        i.estado,
        i.ubicacion,
        i.id_incidencia,
        i.nivel_incidencia,
        i.id_numero_emergencia,
        e.numero as numero_emergencia,
        a.ubicacion_audio AS audio
    FROM incidencia i
    INNER JOIN emergencia e ON i.id_numero_emergencia = e.id_numero_emergencia
    LEFT JOIN audio a ON a.id_incidencia = i.id_incidencia
    WHERE i.id_incidencia = %s
    LIMIT 1;
    """
    cursor.execute(sql, (id_incidencia,))
    emergencia = cursor.fetchone()
    cursor.close()
    conexion.close()
    return emergencia


def obtener_destinatarios_emergencia(id_numero_emergencia):
    """Obtiene los correos destinatarios de una emergencia"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """SELECT co.id_correo, co.correo, co.nombre_area 
             FROM emergencia_correo ec
             INNER JOIN correo_institucional co ON co.id_correo = ec.id_correo
             WHERE ec.id_numero_emergencia = %s AND co.id_correo <> 4"""
    cursor.execute(sql, (id_numero_emergencia,))
    destinatarios = cursor.fetchall()
    cursor.close()
    conexion.close()
    return destinatarios


def obtener_motivos_emergencia(id_incidencia):
    """Obtiene los motivos de respuesta de una emergencia"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """SELECT 
                mo.descripcion, 
                mo.archivo_adjunto, 
                mo.id_correo,
                mo.fecha_aceptacion 
             FROM motivo_incidencia mo
             WHERE mo.id_incidencia = %s"""
    cursor.execute(sql, (id_incidencia,))
    motivos = cursor.fetchall()
    cursor.close()
    conexion.close()
    return motivos


def convertir_estado_texto(estado_char):
    """Convierte el código de estado a texto"""
    estados = {'1': "Pendiente", '2': "Atendida", '3': "Rechazada"}
    return estados.get(str(estado_char), "Desconocido")


def convertir_nivel_texto(nivel_char):
    """Convierte el nivel de emergencia a texto"""
    niveles = {
        '1': "Baja",
        '2': "Media", 
        '3': "Alta",
        'A': "Crítica",
        'B': "Urgente",
        'C': "Normal"
    }
    return niveles.get(str(nivel_char).upper(), "No especificado")


def parsear_ubicacion(ubicacion_str):
    """Parsea coordenadas de ubicación"""
    if ubicacion_str:
        try:
            partes = ubicacion_str.split(',')
            if len(partes) == 2:
                return {
                    "latitud": float(partes[0].strip()), 
                    "longitud": float(partes[1].strip())
                }
        except:
            pass
    return {"latitud": 0.0, "longitud": 0.0}