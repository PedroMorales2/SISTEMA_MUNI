"""
ENDPOINT: /api/recursos/inventario
Retorna el inventario actual de recursos municipales

Este endpoint puede:
1. Leer de una base de datos
2. Consultar otro API municipal
3. Retornar datos estáticos/configurables
"""

from flask import Blueprint, jsonify
from datetime import datetime

# Crear blueprint
recursos_bp = Blueprint('recursos', __name__)

@recursos_bp.route('/inventario', methods=['GET'])
def obtener_inventario_recursos():
    """
    Retorna el inventario actual de recursos del municipio
    
    Puede obtener datos de:
    - Base de datos municipal
    - Sistema de gestión de personal (RRHH)
    - Sistema de gestión de flota vehicular
    - API externa de recursos municipales
    
    Returns:
        JSON con estructura:
        {
            "success": true,
            "data": {
                "serenos": int,
                "policias": int,
                "vehiculos_serenazgo": int,
                "vehiculos_policia": int,
                "ambulancias": int,
                "bomberos": int,
                "vehiculos_bomberos": int,
                "comisarias": int,
                "estaciones_bomberos": int,
                "centros_salud": int,
                "ultima_actualizacion": "2025-01-15T10:30:00"
            }
        }
    """
    
    try:
        # OPCIÓN 1: DATOS DESDE BASE DE DATOS
        # recursos = obtener_recursos_desde_bd()
        
        # OPCIÓN 2: DATOS DESDE OTRO API
        # recursos = consultar_api_municipal()
        
        # OPCIÓN 3: DATOS ESTÁTICOS/CONFIGURABLES (Para desarrollo o datos fijos)
        recursos = {
            # Personal de seguridad
            "serenos": 150,
            "policias": 80,
            "bomberos": 45,
            
            # Vehículos operativos
            "vehiculos_serenazgo": 25,
            "vehiculos_policia": 15,
            "vehiculos_bomberos": 6,
            "ambulancias": 8,
            
            # Infraestructura
            "comisarias": 5,
            "estaciones_bomberos": 2,
            "centros_salud": 3,
            
            # Metadata
            "ultima_actualizacion": datetime.now().isoformat()
        }
        
        return jsonify({
            "success": True,
            "data": recursos,
            "message": "Inventario de recursos obtenido correctamente"
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Error al obtener inventario: {str(e)}"
        }), 500


# ============================================
# ENDPOINT ADICIONAL: ACTUALIZAR RECURSOS
# ============================================

# @recursos_bp.route('/api/recursos/inventario', methods=['POST', 'PUT'])
# def actualizar_inventario_recursos():
#     """
#     Actualizar el inventario de recursos
    
#     Body esperado:
#     {
#         "serenos": 150,
#         "policias": 80,
#         "bomberos": 45,
#         ...
#     }
#     """
#     from flask import request
    
#     try:
#         data = request.get_json()
        
#         # Validar campos requeridos
#         campos_requeridos = [
#             'serenos', 'policias', 'vehiculos_serenazgo', 
#             'vehiculos_policia', 'ambulancias', 'bomberos',
#             'vehiculos_bomberos', 'comisarias', 
#             'estaciones_bomberos', 'centros_salud'
#         ]
        
#         for campo in campos_requeridos:
#             if campo not in data:
#                 return jsonify({
#                     "success": False,
#                     "error": f"Campo requerido faltante: {campo}"
#                 }), 400
        
#         # GUARDAR EN BASE DE DATOS
#         # from models import RecursosMunicipales
#         # recurso = RecursosMunicipales(**data)
#         # db.session.add(recurso)
#         # db.session.commit()
        
#         return jsonify({
#             "success": True,
#             "message": "Inventario actualizado correctamente",
#             "data": data
#         }), 200
        
#     except Exception as e:
#         return jsonify({
#             "success": False,
#             "error": f"Error al actualizar inventario: {str(e)}"
#         }), 500
