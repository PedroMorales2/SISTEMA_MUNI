# routes/api/sectores.py

from flask import Blueprint, request, jsonify
from controladores import controlador_sectores
from utils.constants import *
import json

sectores_bp = Blueprint('sectores', __name__)


@sectores_bp.route('/listar', methods=['GET'])
def listar_sectores():
    """GET - Lista todos los sectores"""
    try:
        sectores = controlador_sectores.obtener_todos_sectores()
        
        sectores_formateados = []
        for s in sectores:
            poligono = json.loads(s['poligono_geojson']) if s['poligono_geojson'] else None
            
            sectores_formateados.append({
                'id_sector': s['id_sector'],
                'codigo_sector': s['codigo_sector'],
                'nombre': s['nombre'],
                'descripcion': s['descripcion'],
                'bounds': {
                    'lat_min': float(s['lat_min']),
                    'lat_max': float(s['lat_max']),
                    'lon_min': float(s['lon_min']),
                    'lon_max': float(s['lon_max'])
                },
                'centro': {
                    'lat': float(s['centro_lat']) if s['centro_lat'] else 0,
                    'lon': float(s['centro_lon']) if s['centro_lon'] else 0
                },
                'poligono': poligono,
                'fecha_creacion': s['fecha_creacion'].isoformat() if s['fecha_creacion'] else None,
                'usuario_creacion': s['usuario_creacion']
            })
        
        return jsonify({
            "success": True,
            "data": sectores_formateados,
            "total": len(sectores_formateados)
        }), HTTP_OK
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@sectores_bp.route('/obtener/<int:id_sector>', methods=['GET'])
def obtener_sector(id_sector):
    """GET - Obtiene un sector por ID"""
    try:
        sector = controlador_sectores.obtener_sector_por_id(id_sector)
        
        if not sector:
            return jsonify({
                "success": False,
                "error": "Sector no encontrado"
            }), HTTP_NOT_FOUND
        
        poligono = json.loads(sector[10]) if sector[10] else None
        
        sector_data = {
            'id_sector': sector[0],
            'codigo_sector': sector[1],
            'nombre': sector[2],
            'descripcion': sector[3],
            'bounds': {
                'lat_min': float(sector[4]),
                'lat_max': float(sector[5]),
                'lon_min': float(sector[6]),
                'lon_max': float(sector[7])
            },
            'centro': {
                'lat': float(sector[8]) if sector[8] else 0,
                'lon': float(sector[9]) if sector[9] else 0
            },
            'poligono': poligono,
            'fecha_creacion': sector[11].isoformat() if sector[11] else None,
            'usuario_creacion': sector[12]
        }
        
        return jsonify({
            "success": True,
            "data": sector_data
        }), HTTP_OK
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@sectores_bp.route('/crear', methods=['POST'])
def crear_sector():
    """
    POST - Crea un nuevo sector
    
    Body JSON:
    {
        "codigo_sector": "SECT-01",
        "nombre": "Sector Centro",
        "descripcion": "Zona central",
        "poligono_geojson": {...},
        "usuario_creacion": "admin"
    }
    """
    try:
        data = request.get_json()
        
        if not data.get('codigo_sector'):
            return jsonify({
                "success": False,
                "error": "El campo 'codigo_sector' es requerido"
            }), HTTP_BAD_REQUEST
        
        if not data.get('nombre'):
            return jsonify({
                "success": False,
                "error": "El campo 'nombre' es requerido"
            }), HTTP_BAD_REQUEST
        
        if not data.get('poligono_geojson'):
            return jsonify({
                "success": False,
                "error": "El campo 'poligono_geojson' es requerido"
            }), HTTP_BAD_REQUEST
        
        id_nuevo = controlador_sectores.crear_sector(data)
        
        if id_nuevo:
            return jsonify({
                "success": True,
                "message": "Sector creado exitosamente",
                "id_sector": id_nuevo
            }), HTTP_CREATED
        else:
            return jsonify({
                "success": False,
                "error": "No se pudo crear el sector"
            }), HTTP_INTERNAL_ERROR
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@sectores_bp.route('/actualizar/<int:id_sector>', methods=['PUT'])
def actualizar_sector(id_sector):
    """PUT - Actualiza un sector"""
    try:
        data = request.get_json()
        
        sector_actual = controlador_sectores.obtener_sector_por_id(id_sector)
        if not sector_actual:
            return jsonify({
                "success": False,
                "error": "Sector no encontrado"
            }), HTTP_NOT_FOUND
        
        resultado = controlador_sectores.actualizar_sector(id_sector, data)
        
        if resultado:
            return jsonify({
                "success": True,
                "message": "Sector actualizado exitosamente"
            }), HTTP_OK
        else:
            return jsonify({
                "success": False,
                "error": "No se pudo actualizar el sector"
            }), HTTP_INTERNAL_ERROR
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@sectores_bp.route('/eliminar/<int:id_sector>', methods=['DELETE'])
def eliminar_sector(id_sector):
    """DELETE - Elimina un sector"""
    try:
        sector = controlador_sectores.obtener_sector_por_id(id_sector)
        if not sector:
            return jsonify({
                "success": False,
                "error": "Sector no encontrado"
            }), HTTP_NOT_FOUND
        
        resultado = controlador_sectores.eliminar_sector(id_sector)
        
        if resultado:
            return jsonify({
                "success": True,
                "message": f"Sector '{sector[2]}' eliminado exitosamente"
            }), HTTP_OK
        else:
            return jsonify({
                "success": False,
                "error": "No se pudo eliminar el sector"
            }), HTTP_INTERNAL_ERROR
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR