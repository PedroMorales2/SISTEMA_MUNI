# routes/recursos.py
from flask import Blueprint, request, jsonify
from controladores import controlador_recursos
from utils.constants import *

recursos_bp = Blueprint('recursos', __name__)


@recursos_bp.route('/inventario', methods=['GET'])
def obtener_inventario():
    """GET - Obtiene el inventario completo en formato para JavaScript"""
    try:
        inventario = controlador_recursos.obtener_inventario_completo()
        
        return jsonify({
            "success": True,
            "data": inventario
        }), HTTP_OK
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@recursos_bp.route('/listar', methods=['GET'])
def listar_recursos():
    """GET - Lista todos los recursos con detalle completo"""
    try:
        recursos = controlador_recursos.obtener_todos_recursos()
        
        return jsonify({
            "success": True,
            "data": recursos,
            "total": len(recursos)
        }), HTTP_OK
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@recursos_bp.route('/obtener/<int:id_recurso>', methods=['GET'])
def obtener_recurso(id_recurso):
    """GET - Obtiene un recurso por ID"""
    try:
        recurso = controlador_recursos.obtener_recurso_por_id(id_recurso)
        
        if not recurso:
            return jsonify({
                "success": False,
                "error": "Recurso no encontrado"
            }), HTTP_NOT_FOUND
        
        return jsonify({
            "success": True,
            "data": recurso
        }), HTTP_OK
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@recursos_bp.route('/obtener-nombre/<string:nombre>', methods=['GET'])
def obtener_recurso_por_nombre(nombre):
    """GET - Obtiene un recurso por nombre"""
    try:
        recurso = controlador_recursos.obtener_recurso_por_nombre(nombre)
        
        if not recurso:
            return jsonify({
                "success": False,
                "error": f"Recurso '{nombre}' no encontrado"
            }), HTTP_NOT_FOUND
        
        return jsonify({
            "success": True,
            "data": recurso
        }), HTTP_OK
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@recursos_bp.route('/crear', methods=['POST'])
def crear_recurso():
    """POST - Crea un nuevo recurso"""
    try:
        data = request.get_json()
        
        nombre = data.get('nombre')
        cantidad = data.get('cantidad', 0)
        descripcion = data.get('descripcion')
        usuario = data.get('usuario', 'system')
        
        if not nombre:
            return jsonify({
                "success": False,
                "error": "El nombre del recurso es requerido"
            }), HTTP_BAD_REQUEST
        
        if not isinstance(cantidad, int) or cantidad < 0:
            return jsonify({
                "success": False,
                "error": "La cantidad debe ser un número entero mayor o igual a 0"
            }), HTTP_BAD_REQUEST
        
        # Verificar si ya existe
        existente = controlador_recursos.obtener_recurso_por_nombre(nombre)
        if existente:
            return jsonify({
                "success": False,
                "error": f"El recurso '{nombre}' ya existe con ID {existente['id_recursos_municipales']}"
            }), HTTP_BAD_REQUEST
        
        id_nuevo = controlador_recursos.crear_recurso(nombre, cantidad, descripcion, usuario)
        
        return jsonify({
            "success": True,
            "message": "Recurso creado exitosamente",
            "id": id_nuevo
        }), HTTP_CREATED
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@recursos_bp.route('/actualizar/<int:id_recurso>', methods=['PUT'])
def actualizar_recurso(id_recurso):
    """PUT - Actualiza un recurso existente"""
    try:
        data = request.get_json()
        
        nombre = data.get('nombre')
        cantidad = data.get('cantidad')
        descripcion = data.get('descripcion')
        usuario = data.get('usuario', 'system')
        
        if nombre is None and cantidad is None and descripcion is None:
            return jsonify({
                "success": False,
                "error": "Debe proporcionar al menos un campo para actualizar"
            }), HTTP_BAD_REQUEST
        
        # Validar cantidad si se proporciona
        if cantidad is not None:
            if not isinstance(cantidad, int) or cantidad < 0:
                return jsonify({
                    "success": False,
                    "error": "La cantidad debe ser un número entero mayor o igual a 0"
                }), HTTP_BAD_REQUEST
        
        # Verificar que el recurso existe
        recurso_actual = controlador_recursos.obtener_recurso_por_id(id_recurso)
        if not recurso_actual:
            return jsonify({
                "success": False,
                "error": "Recurso no encontrado"
            }), HTTP_NOT_FOUND
        
        # Si se está cambiando el nombre, verificar que no exista otro con ese nombre
        if nombre and nombre != recurso_actual['nombre']:
            existente = controlador_recursos.obtener_recurso_por_nombre(nombre)
            if existente:
                return jsonify({
                    "success": False,
                    "error": f"Ya existe un recurso con el nombre '{nombre}'"
                }), HTTP_BAD_REQUEST
        
        resultado = controlador_recursos.actualizar_recurso(
            id_recurso, nombre, cantidad, descripcion, usuario
        )
        
        if resultado:
            return jsonify({
                "success": True,
                "message": "Recurso actualizado exitosamente"
            }), HTTP_OK
        else:
            return jsonify({
                "success": False,
                "error": "No se pudo actualizar el recurso"
            }), HTTP_INTERNAL_ERROR
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@recursos_bp.route('/eliminar/<int:id_recurso>', methods=['DELETE'])
def eliminar_recurso(id_recurso):
    """DELETE - Elimina un recurso"""
    try:
        # Obtener usuario desde query params o body
        usuario = request.args.get('usuario', 'system')
        
        # Verificar que existe
        recurso = controlador_recursos.obtener_recurso_por_id(id_recurso)
        if not recurso:
            return jsonify({
                "success": False,
                "error": "Recurso no encontrado"
            }), HTTP_NOT_FOUND
        
        resultado = controlador_recursos.eliminar_recurso(id_recurso, usuario)
        
        if resultado:
            return jsonify({
                "success": True,
                "message": f"Recurso '{recurso['nombre']}' eliminado exitosamente"
            }), HTTP_OK
        else:
            return jsonify({
                "success": False,
                "error": "No se pudo eliminar el recurso"
            }), HTTP_INTERNAL_ERROR
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@recursos_bp.route('/actualizar-masivo', methods=['PUT'])
def actualizar_masivo():
    """PUT - Actualiza múltiples recursos a la vez"""
    try:
        data = request.get_json()
        
        actualizaciones = data.get('recursos', [])
        usuario = data.get('usuario', 'system')
        
        if not actualizaciones or not isinstance(actualizaciones, list):
            return jsonify({
                "success": False,
                "error": "Debe proporcionar una lista de recursos a actualizar"
            }), HTTP_BAD_REQUEST
        
        # Validar formato
        for item in actualizaciones:
            if 'nombre' not in item or 'cantidad' not in item:
                return jsonify({
                    "success": False,
                    "error": "Cada recurso debe tener 'nombre' y 'cantidad'"
                }), HTTP_BAD_REQUEST
            
            if not isinstance(item['cantidad'], int) or item['cantidad'] < 0:
                return jsonify({
                    "success": False,
                    "error": f"La cantidad de '{item['nombre']}' debe ser un número entero >= 0"
                }), HTTP_BAD_REQUEST
        
        resultado = controlador_recursos.actualizar_cantidad_masiva(actualizaciones, usuario)
        
        if resultado:
            return jsonify({
                "success": True,
                "message": f"{len(actualizaciones)} recursos actualizados exitosamente"
            }), HTTP_OK
        else:
            return jsonify({
                "success": False,
                "error": "Error al actualizar recursos"
            }), HTTP_INTERNAL_ERROR
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@recursos_bp.route('/estadisticas', methods=['GET'])
def obtener_estadisticas():
    """GET - Obtiene estadísticas generales de recursos"""
    try:
        stats = controlador_recursos.obtener_estadisticas_recursos()
        
        return jsonify({
            "success": True,
            "data": stats
        }), HTTP_OK
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@recursos_bp.route('/historial', methods=['GET'])
def obtener_historial():
    """GET - Obtiene el historial de cambios de recursos"""
    try:
        limit = request.args.get('limit', 50, type=int)
        id_recurso = request.args.get('id_recurso', None, type=int)
        
        if id_recurso:
            historial = controlador_recursos.obtener_historial_recurso(id_recurso, limit)
        else:
            historial = controlador_recursos.obtener_historial('RECURSO', None, limit)
        
        return jsonify({
            "success": True,
            "data": historial,
            "total": len(historial)
        }), HTTP_OK
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR