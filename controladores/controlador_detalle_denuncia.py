from utils.database import obtenerconexion as obtener_conexion
import os

# ---------- FUNCIONES AUXILIARES ----------

def obtener_detalles(id_incidencia):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """SELECT 
    d.nombre AS denuncia_nombre,
    a.descripcion,
    a.fecha,
    a.hora,
    a.estado,
    a.ubicacion,
    a.id_denuncia,
    GROUP_CONCAT(DISTINCT ad.ubicacion_audio SEPARATOR ', ') AS audios,
    GROUP_CONCAT(DISTINCT v.ubicacion_video SEPARATOR ', ') AS videos,
    GROUP_CONCAT(DISTINCT f.ubicacion_foto SEPARATOR ', ') AS fotos
FROM incidencia a
INNER JOIN denuncia d ON a.id_denuncia = d.id_denuncia
LEFT JOIN audio ad ON ad.id_incidencia = a.id_incidencia
LEFT JOIN video v ON v.id_incidencia = a.id_incidencia
LEFT JOIN foto f ON f.id_incidencia = a.id_incidencia
WHERE a.id_incidencia = %s
GROUP BY 
    d.nombre, 
    a.descripcion, 
    a.fecha, 
    a.hora, 
    a.estado, 
    a.ubicacion,
    a.id_denuncia;
"""
    cursor.execute(sql, (id_incidencia,))
    denuncia = cursor.fetchone()
    cursor.close()
    conexion.close()
    return denuncia


def obtener_interceptarios(id_denuncia):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    sql = """SELECT co.id_correo, co.correo, co.nombre_area 
             FROM denuncia_correo de
             INNER JOIN correo_institucional co ON co.id_correo = de.id_correo
             WHERE de.id_denuncia = %s AND co.id_correo <> 4"""
    cursor.execute(sql, (id_denuncia,))
    interceptarios = cursor.fetchall()
    cursor.close()
    conexion.close()
    return interceptarios


def obtener_motivos(id_incidencia):
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


def convertir_estado_texto(estado_num):
    estados = {1: "Pendiente", '2': "Resuelto", '3': "Rechazada"}
    return estados.get(estado_num, "Desconocido")


def parsear_ubicacion(ubicacion_str):
    if ubicacion_str:
        try:
            partes = ubicacion_str.split(',')
            if len(partes) == 2:
                return {"latitud": float(partes[0].strip()), "longitud": float(partes[1].strip())}
        except:
            pass
    return {"latitud": 0.0, "longitud": 0.0}


def validar_archivo_existente(ruta):
    return os.path.exists(ruta)
