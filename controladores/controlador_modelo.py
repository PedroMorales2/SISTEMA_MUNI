from utils.database import obtenerconexion as obtener_conexion
import pandas as pd

def obtener_incidencias_mensuales():
    conexion = obtener_conexion()
    cursor = conexion.cursor()

    query = """
    SELECT
        id_incidencia,
        descripcion,
        ubicacion,
        DATE(fecha) AS fecha,
        HOUR(hora) AS hora,
        MINUTE(hora) AS minuto,
        MONTH(fecha) AS mes,
        YEAR(fecha) AS anio
    FROM incidencia
    WHERE fecha >= DATE_FORMAT(CURDATE(), '%Y-01-01')
    ORDER BY fecha;
    """

    cursor.execute(query)
    resultados = cursor.fetchall()
    cursor.close()
    conexion.close()

    # Convertir a DataFrame para procesar con pandas/sklearn
    df = pd.DataFrame(resultados)
    return df
