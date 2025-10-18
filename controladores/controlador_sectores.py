# controladores/controlador_sectores.py

from utils.database import obtenerconexion as obtener_conexion
import json

# ============================================================================
# CRUD DE SECTORES
# ============================================================================

def obtener_todos_sectores():
    """Obtiene todos los sectores activos"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    
    sql = """
        SELECT 
            id_sector, codigo_sector, nombre, descripcion,
            lat_min, lat_max, lon_min, lon_max,
            centro_lat, centro_lon, poligono_geojson,
            fecha_creacion, usuario_creacion
        FROM sectores
        WHERE activo = TRUE
        ORDER BY codigo_sector
    """
    
    cursor.execute(sql)
    sectores = cursor.fetchall()
    cursor.close()
    conexion.close()
    
    return sectores


def obtener_sector_por_id(id_sector):
    """Obtiene un sector por su ID"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    
    sql = """
        SELECT 
            id_sector, codigo_sector, nombre, descripcion,
            lat_min, lat_max, lon_min, lon_max,
            centro_lat, centro_lon, poligono_geojson,
            fecha_creacion, usuario_creacion
        FROM sectores
        WHERE id_sector = %s
    """
    
    cursor.execute(sql, (id_sector,))
    sector = cursor.fetchone()
    cursor.close()
    conexion.close()
    
    return sector


def crear_sector(datos_sector):
    """
    Crea un nuevo sector desde el mapa
    
    Args:
        datos_sector (dict):
            - codigo_sector: Código único
            - nombre: Nombre del sector
            - descripcion: Descripción (opcional)
            - poligono_geojson: Polígono dibujado (GeoJSON)
            - usuario_creacion: Usuario (opcional)
    
    Returns:
        int: ID del sector creado o None si hay error
    """
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    
    try:
        # Calcular bounding box y centro desde el polígono
        poligono = datos_sector['poligono_geojson']
        coords = poligono['geometry']['coordinates'][0]
        
        lats = [coord[1] for coord in coords]
        lons = [coord[0] for coord in coords]
        
        lat_min = min(lats)
        lat_max = max(lats)
        lon_min = min(lons)
        lon_max = max(lons)
        
        centro_lat = (lat_min + lat_max) / 2
        centro_lon = (lon_min + lon_max) / 2
        
        poligono_json = json.dumps(poligono)
        
        sql = """
            INSERT INTO sectores 
            (codigo_sector, nombre, descripcion, lat_min, lat_max, lon_min, lon_max,
             centro_lat, centro_lon, poligono_geojson, usuario_creacion)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        valores = (
            datos_sector['codigo_sector'],
            datos_sector['nombre'],
            datos_sector.get('descripcion', ''),
            lat_min, lat_max, lon_min, lon_max,
            centro_lat, centro_lon,
            poligono_json,
            datos_sector.get('usuario_creacion', 'sistema')
        )
        
        cursor.execute(sql, valores)
        conexion.commit()
        
        id_sector = cursor.lastrowid
        
        cursor.close()
        conexion.close()
        
        return id_sector
        
    except Exception as e:
        conexion.rollback()
        cursor.close()
        conexion.close()
        print(f"❌ Error al crear sector: {str(e)}")
        return None


def actualizar_sector(id_sector, datos_actualizacion):
    """Actualiza un sector"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    
    try:
        sets = []
        valores = []
        
        if 'nombre' in datos_actualizacion:
            sets.append("nombre = %s")
            valores.append(datos_actualizacion['nombre'])
        
        if 'descripcion' in datos_actualizacion:
            sets.append("descripcion = %s")
            valores.append(datos_actualizacion['descripcion'])
        
        if 'poligono_geojson' in datos_actualizacion:
            poligono = datos_actualizacion['poligono_geojson']
            coords = poligono['geometry']['coordinates'][0]
            
            lats = [coord[1] for coord in coords]
            lons = [coord[0] for coord in coords]
            
            lat_min = min(lats)
            lat_max = max(lats)
            lon_min = min(lons)
            lon_max = max(lons)
            
            centro_lat = (lat_min + lat_max) / 2
            centro_lon = (lon_min + lon_max) / 2
            
            sets.extend([
                "lat_min = %s", "lat_max = %s", "lon_min = %s", "lon_max = %s",
                "centro_lat = %s", "centro_lon = %s", "poligono_geojson = %s"
            ])
            valores.extend([
                lat_min, lat_max, lon_min, lon_max,
                centro_lat, centro_lon, json.dumps(poligono)
            ])
        
        if not sets:
            return False
        
        sql = f"UPDATE sectores SET {', '.join(sets)} WHERE id_sector = %s"
        valores.append(id_sector)
        
        cursor.execute(sql, tuple(valores))
        conexion.commit()
        
        cursor.close()
        conexion.close()
        
        return True
        
    except Exception as e:
        conexion.rollback()
        cursor.close()
        conexion.close()
        print(f"❌ Error al actualizar sector: {str(e)}")
        return False


def eliminar_sector(id_sector):
    """Elimina lógicamente un sector"""
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    
    sql = "UPDATE sectores SET activo = FALSE WHERE id_sector = %s"
    cursor.execute(sql, (id_sector,))
    conexion.commit()
    
    cursor.close()
    conexion.close()
    
    return True