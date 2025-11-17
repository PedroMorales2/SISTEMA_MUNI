# routes/configuracion.py
from flask import Blueprint, request, jsonify
from controladores import controlador_configuracion
from utils.constants import *

configuracion_bp = Blueprint('configuracion', __name__)



@configuracion_bp.route('/ratios', methods=['GET'])
def obtener_ratios():
    """GET - Obtiene todos los ratios en formato para JavaScript"""
    try:
        ratios = controlador_configuracion.obtener_ratios_para_javascript()
        
        return jsonify({
            "success": True,
            "data": ratios
        }), HTTP_OK
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@configuracion_bp.route('/listar', methods=['GET'])
def listar_configuraciones():
    """GET - Lista todas las configuraciones"""
    try:
        configuraciones = controlador_configuracion.obtener_todas_configuraciones()
        
        return jsonify({
            "success": True,
            "data": configuraciones,
            "total": len(configuraciones)
        }), HTTP_OK
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@configuracion_bp.route('/listar-agrupado', methods=['GET'])
def listar_configuraciones_agrupadas():
    """GET - Lista configuraciones agrupadas por categoría y subcategoría"""
    try:
        agrupado = controlador_configuracion.obtener_configuraciones_agrupadas()
        
        return jsonify({
            "success": True,
            "data": agrupado
        }), HTTP_OK
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@configuracion_bp.route('/obtener/<int:id_config>', methods=['GET'])
def obtener_configuracion(id_config):
    """GET - Obtiene una configuración por ID"""
    try:
        config = controlador_configuracion.obtener_configuracion_por_id(id_config)
        
        if not config:
            return jsonify({
                "success": False,
                "error": "Configuración no encontrada"
            }), HTTP_NOT_FOUND
        
        return jsonify({
            "success": True,
            "data": config
        }), HTTP_OK
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@configuracion_bp.route('/categoria/<string:categoria>', methods=['GET'])
def obtener_por_categoria(categoria):
    """GET - Obtiene todas las configuraciones de una categoría"""
    try:
        configs = controlador_configuracion.obtener_configuraciones_por_categoria(categoria)
        
        return jsonify({
            "success": True,
            "data": configs,
            "total": len(configs)
        }), HTTP_OK
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@configuracion_bp.route('/crear', methods=['POST'])
def crear_configuracion():
    """POST - Crea una nueva configuración"""
    try:
        data = request.get_json()
        
        categoria = data.get('categoria')
        subcategoria = data.get('subcategoria')
        nombre_parametro = data.get('nombre_parametro')
        valor = data.get('valor')
        descripcion = data.get('descripcion')
        unidad = data.get('unidad')
        editable = data.get('editable', 1)
        usuario = data.get('usuario', 'system')
        
        # Validaciones
        if not all([categoria, subcategoria, nombre_parametro, valor is not None]):
            return jsonify({
                "success": False,
                "error": "Campos requeridos: categoria, subcategoria, nombre_parametro, valor"
            }), HTTP_BAD_REQUEST
        
        try:
            valor = float(valor)
        except (ValueError, TypeError):
            return jsonify({
                "success": False,
                "error": "El valor debe ser un número válido"
            }), HTTP_BAD_REQUEST
        
        # Verificar si ya existe
        existente = controlador_configuracion.obtener_configuracion_por_parametro(
            categoria, subcategoria, nombre_parametro
        )
        if existente:
            return jsonify({
                "success": False,
                "error": f"Ya existe una configuración: {categoria}.{subcategoria}.{nombre_parametro}"
            }), HTTP_BAD_REQUEST
        
        id_nuevo = controlador_configuracion.crear_configuracion(
            categoria, subcategoria, nombre_parametro, valor, 
            descripcion, unidad, editable, usuario
        )
        
        return jsonify({
            "success": True,
            "message": "Configuración creada exitosamente",
            "id": id_nuevo
        }), HTTP_CREATED
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@configuracion_bp.route('/actualizar/<int:id_config>', methods=['PUT'])
def actualizar_configuracion(id_config):
    """PUT - Actualiza una configuración"""
    try:
        data = request.get_json()
        
        valor = data.get('valor')
        descripcion = data.get('descripcion')
        unidad = data.get('unidad')
        editable = data.get('editable')
        usuario = data.get('usuario', 'system')
        
        if valor is None and descripcion is None and unidad is None and editable is None:
            return jsonify({
                "success": False,
                "error": "Debe proporcionar al menos un campo para actualizar"
            }), HTTP_BAD_REQUEST
        
        # Validar valor si se proporciona
        if valor is not None:
            try:
                valor = float(valor)
            except (ValueError, TypeError):
                return jsonify({
                    "success": False,
                    "error": "El valor debe ser un número válido"
                }), HTTP_BAD_REQUEST
        
        # Verificar que existe
        config_actual = controlador_configuracion.obtener_configuracion_por_id(id_config)
        if not config_actual:
            return jsonify({
                "success": False,
                "error": "Configuración no encontrada"
            }), HTTP_NOT_FOUND
        
        resultado = controlador_configuracion.actualizar_configuracion(
            id_config, valor, descripcion, unidad, editable, usuario
        )
        
        if resultado:
            return jsonify({
                "success": True,
                "message": "Configuración actualizada exitosamente"
            }), HTTP_OK
        else:
            return jsonify({
                "success": False,
                "error": "No se pudo actualizar la configuración"
            }), HTTP_INTERNAL_ERROR
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@configuracion_bp.route('/eliminar/<int:id_config>', methods=['DELETE'])
def eliminar_configuracion(id_config):
    """DELETE - Elimina una configuración"""
    try:
        usuario = request.args.get('usuario', 'system')
        
        # Verificar que existe
        config = controlador_configuracion.obtener_configuracion_por_id(id_config)
        if not config:
            return jsonify({
                "success": False,
                "error": "Configuración no encontrada"
            }), HTTP_NOT_FOUND
        
        resultado = controlador_configuracion.eliminar_configuracion(id_config, usuario)
        
        if resultado:
            return jsonify({
                "success": True,
                "message": f"Configuración '{config['nombre_parametro']}' eliminada exitosamente"
            }), HTTP_OK
        else:
            return jsonify({
                "success": False,
                "error": "No se pudo eliminar la configuración"
            }), HTTP_INTERNAL_ERROR
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@configuracion_bp.route('/actualizar-masivo', methods=['PUT'])
def actualizar_masivo():
    """PUT - Actualiza múltiples configuraciones"""
    try:
        data = request.get_json()
        
        actualizaciones = data.get('configuraciones', [])
        usuario = data.get('usuario', 'system')
        
        if not actualizaciones or not isinstance(actualizaciones, list):
            return jsonify({
                "success": False,
                "error": "Debe proporcionar una lista de configuraciones"
            }), HTTP_BAD_REQUEST
        
        # Validar formato
        for item in actualizaciones:
            if 'id_config' not in item or 'valor' not in item:
                return jsonify({
                    "success": False,
                    "error": "Cada configuración debe tener 'id_config' y 'valor'"
                }), HTTP_BAD_REQUEST
            
            try:
                float(item['valor'])
            except (ValueError, TypeError):
                return jsonify({
                    "success": False,
                    "error": f"Valor inválido para id_config {item['id_config']}"
                }), HTTP_BAD_REQUEST
        
        resultado = controlador_configuracion.actualizar_configuracion_masiva(
            actualizaciones, usuario
        )
        
        if resultado:
            return jsonify({
                "success": True,
                "message": f"{len(actualizaciones)} configuraciones actualizadas"
            }), HTTP_OK
        else:
            return jsonify({
                "success": False,
                "error": "Error al actualizar configuraciones"
            }), HTTP_INTERNAL_ERROR
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@configuracion_bp.route('/resetear', methods=['POST'])
def resetear_configuraciones():
    """POST - Resetea todas las configuraciones a valores por defecto"""
    try:
        data = request.get_json() or {}
        usuario = data.get('usuario', 'system')
        
        resultado = controlador_configuracion.resetear_configuraciones_default(usuario)
        
        if resultado:
            return jsonify({
                "success": True,
                "message": "Configuraciones reseteadas a valores por defecto exitosamente"
            }), HTTP_OK
        else:
            return jsonify({
                "success": False,
                "error": "Error al resetear configuraciones"
            }), HTTP_INTERNAL_ERROR
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@configuracion_bp.route('/estadisticas', methods=['GET'])
def obtener_estadisticas():
    """GET - Obtiene estadísticas de configuración por categoría"""
    try:
        stats = controlador_configuracion.obtener_estadisticas_configuracion()
        
        return jsonify({
            "success": True,
            "data": stats
        }), HTTP_OK
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), HTTP_INTERNAL_ERROR


@configuracion_bp.route('/historial', methods=['GET'])
def obtener_historial():
    """GET - Obtiene el historial de cambios de configuración"""
    try:
        limit = request.args.get('limit', 50, type=int)
        id_config = request.args.get('id_config', None, type=int)
        
        from controladores.controlador_recursos import obtener_historial, obtener_historial_configuracion
        if id_config:
            historial = obtener_historial_configuracion(id_config, limit)
        else:
            historial = obtener_historial('CONFIGURACION', None, limit)
        
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