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
    POST - Crea un nuevo sector y calcula solo su histórico (OPTIMIZADO)
    
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
        
        # ✅ PASO 1: Crear el sector en la BD
        id_nuevo = controlador_sectores.crear_sector(data)
        
        if not id_nuevo:
            return jsonify({
                "success": False,
                "error": "No se pudo crear el sector"
            }), HTTP_INTERNAL_ERROR
        
        # ✅ PASO 2: Calcular histórico SOLO del nuevo sector (OPTIMIZADO)
        from models.modelo_PREDICCION_ESPACIAL import modelo_espacial
        
        print(f"\n🚀 Calculando histórico optimizado para sector nuevo (ID: {id_nuevo})...")
        
        # Recargar sectores para que incluya el nuevo
        modelo_espacial.cargar_sectores()
        
        # Calcular histórico SOLO del sector nuevo
        exito_historico = modelo_espacial.calcular_historico_sector_individual(id_nuevo)
        
        if exito_historico:
            print(f"✅ Histórico calculado exitosamente para el nuevo sector")
        else:
            print(f"⚠️ No se pudo calcular el histórico del nuevo sector")
        
        return jsonify({
            "success": True,
            "message": "Sector creado exitosamente",
            "id_sector": id_nuevo,
            "historico_calculado": exito_historico
        }), HTTP_CREATED
        
    except Exception as e:
        print(f"❌ Error en crear_sector: {str(e)}")
        import traceback
        traceback.print_exc()
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
            # ✅ Si se actualizó el polígono, recalcular histórico del sector
            if 'poligono_geojson' in data:
                from models.modelo_PREDICCION_ESPACIAL import modelo_espacial
                print(f"\n🔄 Recalculando histórico por cambio en polígono...")
                modelo_espacial.cargar_sectores()
                modelo_espacial.calcular_historico_sector_individual(id_sector)
            
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
    """DELETE - Elimina un sector y actualiza el caché"""
    try:
        sector = controlador_sectores.obtener_sector_por_id(id_sector)
        if not sector:
            return jsonify({
                "success": False,
                "error": "Sector no encontrado"
            }), HTTP_NOT_FOUND
        
        resultado = controlador_sectores.eliminar_sector(id_sector)
        
        if resultado:
            # ✅ Actualizar caché después de eliminar
            from models.modelo_PREDICCION_ESPACIAL import modelo_espacial
            
            # Remover del caché en memoria
            if id_sector in modelo_espacial.estadisticas_historicas:
                del modelo_espacial.estadisticas_historicas[id_sector]
            
            if id_sector in modelo_espacial.densidad_historica:
                del modelo_espacial.densidad_historica[id_sector]
            
            if id_sector in modelo_espacial.sectores_con_data:
                modelo_espacial.sectores_con_data.remove(id_sector)
            
            # Recargar sectores y guardar caché actualizado
            modelo_espacial.cargar_sectores()
            modelo_espacial.guardar_cache_historico()
            
            print(f"✅ Sector eliminado y caché actualizado")
            
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
        
        
@sectores_bp.route('/historico', methods=['GET'])
def obtener_historico_sectores():
    """
    Endpoint para obtener histórico calculado de cada sector
    """
    try:
        from models.modelo_PREDICCION_ESPACIAL import modelo_espacial
        
        # Calcular histórico si no existe
        if not modelo_espacial.estadisticas_historicas:
            modelo_espacial.calcular_densidad_historica()
        
        # Preparar respuesta con sectores + histórico
        sectores_con_historico = []
        
        for sector in modelo_espacial.sectores:
            id_sector = sector['id_sector']
            historico = modelo_espacial.estadisticas_historicas.get(id_sector, {
                'total': 0,
                'denuncias': 0,
                'emergencias': 0,
                'denuncias_por_tipo': {},
                'emergencias_por_tipo': {},
                'nivel': 'muy_bajo',
                'color': '#4caf50'
            })
            
            sectores_con_historico.append({
                'id_sector': id_sector,
                'codigo_sector': sector['codigo_sector'],
                'nombre': sector['nombre'],
                'bounds': sector['bounds'],
                'centro': sector['centro'],
                'poligono': sector['poligono'],
                'historico': historico
            })
        
        return jsonify({
            'success': True,
            'data': sectores_con_historico,
            'total_sectores': len(sectores_con_historico),
            'sectores_con_data': len(modelo_espacial.sectores_con_data)
        })
        
    except Exception as e:
        print(f"❌ Error en /api/sectores/historico: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@sectores_bp.route('/recalcular-cache', methods=['POST'])
def recalcular_cache_completo():
    """
    Endpoint para forzar recálculo completo del caché (mantenimiento)
    """
    try:
        from models.modelo_PREDICCION_ESPACIAL import modelo_espacial
        
        print("\n🔄 Iniciando recálculo completo del caché...")
        
        # Invalidar caché actual
        modelo_espacial.invalidar_cache()
        
        # Recargar sectores
        modelo_espacial.cargar_sectores()
        
        # Calcular histórico completo
        modelo_espacial.calcular_densidad_historica()
        
        return jsonify({
            'success': True,
            'message': 'Caché recalculado exitosamente',
            'total_sectores': len(modelo_espacial.sectores),
            'sectores_con_data': len(modelo_espacial.sectores_con_data)
        })
        
    except Exception as e:
        print(f"❌ Error recalculando caché: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500