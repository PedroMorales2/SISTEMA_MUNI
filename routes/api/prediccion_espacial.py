# routes/api/prediccion_espacial.py

from flask import Blueprint, request, jsonify, current_app
from models.modelo_PREDICCION import get_modelo
from models.modelo_PREDICCION_ESPACIAL import modelo_espacial
from utils.constants import *
import traceback

espacial_bp = Blueprint('prediccion_espacial', __name__)


@espacial_bp.route('/info', methods=['GET'])
def info_modelo_espacial():
    try:
        modelo_espacial.cargar_sectores()
        
        return jsonify({
            'success': True,
            'data': {
                'sectores_activos': len(modelo_espacial.sectores),
                'densidad_calculada': len(modelo_espacial.densidad_historica) > 0,
                'sectores': [
                    {
                        'id_sector': s['id_sector'],
                        'codigo': s['codigo_sector'],
                        'nombre': s['nombre'],
                        'centro': s['centro']
                    }
                    for s in modelo_espacial.sectores
                ]
            }
        }), HTTP_OK
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), HTTP_INTERNAL_ERROR


@espacial_bp.route('/calcular_densidad', methods=['POST'])
def calcular_densidad():
    try:
        data = request.get_json() or {}
        meses_atras = data.get('meses_atras', 12)
        
        densidad = modelo_espacial.calcular_densidad_historica(meses_atras)
        
        densidad_formateada = []
        for sector in modelo_espacial.sectores:
            id_sector = sector['id_sector']
            densidad_formateada.append({
                'id_sector': id_sector,
                'codigo_sector': sector['codigo_sector'],
                'nombre': sector['nombre'],
                'densidad_porcentaje': round(densidad.get(id_sector, 0) * 100, 2)
            })
        
        densidad_formateada.sort(key=lambda x: x['densidad_porcentaje'], reverse=True)
        
        return jsonify({
            'success': True,
            'message': f'Densidad histórica calculada ({meses_atras} meses)',
            'data': {
                'meses_analizados': meses_atras,
                'sectores': densidad_formateada
            }
        }), HTTP_OK
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), HTTP_INTERNAL_ERROR


@espacial_bp.route('/predecir/<int:year>/<int:month>', methods=['POST'])
def predecir_espacial(year, month):
    try:
        if month < 1 or month > 12:
            return jsonify({'success': False, 'error': 'El mes debe estar entre 1 y 12'}), HTTP_BAD_REQUEST
        
        data = request.get_json() or {}
        incluir_detalles = data.get('incluir_detalles', True)
        recalcular_densidad = data.get('recalcular_densidad', False)
        
        # Cargar modelo
        modelo = current_app.modelo if hasattr(current_app, 'modelo') else None
        
        if modelo is None or not modelo.trained:
            modelo = get_modelo()
            current_app.modelo = modelo
            
            if not modelo.trained:
                return jsonify({'success': False, 'error': 'Modelo no disponible'}), 503
        
        # Predecir
        prediccion_global = modelo.predecir_mes(year, month)
        
        # Recalcular densidad si se solicita
        if recalcular_densidad or not modelo_espacial.densidad_historica:
            modelo_espacial.calcular_densidad_historica()
            
        pred_global_desglose = prediccion_global.get('prediccion_por_tipo', prediccion_global)
        
        # Distribuir por sectores
        prediccion_sectores = modelo_espacial.predecir_sectores(
                    pred_global_desglose, 
                    incluir_detalles=incluir_detalles
                )        
        
        resumen = modelo_espacial.generar_resumen(prediccion_sectores)
        
        
        # --- INICIO DE LA MODIFICACIÓN ---
        # 1. Obtener los mapas desde la configuración de la app
        denuncias_map_int = current_app.config.get('DENUNCIAS_MAP', {})
        emergencias_map_int = current_app.config.get('EMERGENCIAS_MAP', {})

        # 2. ¡CRÍTICO! Convertir las claves de INT a STRING
        # Tu config usa 1: "Robo", pero JSON y tu modelo usan "1": "Robo"
        leyenda_denuncias = {str(k): v for k, v in denuncias_map_int.items()}
        leyenda_emergencias = {str(k): v for k, v in emergencias_map_int.items()}

        # 3. Crear el objeto 'tipos_leyenda'
        tipos_leyenda = {
            "denuncias": leyenda_denuncias,
            "emergencias": leyenda_emergencias
        }
        # --- FIN DE LA MODIFICACIÓN ---

        return jsonify({
            'success': True,
            'data': {
                'year': year,
                'month': month,
                'fecha_prediccion': f"{year}-{month:02d}",
                'prediccion_global': prediccion_global,
                'sectores': prediccion_sectores,
                'resumen': resumen,
                'tipos_leyenda': tipos_leyenda
            }
        }), HTTP_OK
        
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), HTTP_BAD_REQUEST
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': f'Error interno: {str(e)}'}), HTTP_INTERNAL_ERROR


@espacial_bp.route('/sectores_criticos/<int:year>/<int:month>', methods=['GET'])
def obtener_sectores_criticos(year, month):
    try:
        nivel_minimo = request.args.get('nivel_minimo', 'medio')
        top = int(request.args.get('top', 10))
        
        # Cargar modelo
        modelo = current_app.modelo if hasattr(current_app, 'modelo') else None
        if modelo is None or not modelo.trained:
            modelo = get_modelo()
            current_app.modelo = modelo
            if not modelo.trained:
                return jsonify({'success': False, 'error': 'Modelo no disponible'}), 503
        
        prediccion_global = modelo.predecir_mes(year, month)
        prediccion_sectores = modelo_espacial.predecir_sectores(prediccion_global)
        
        niveles_prioridad = {'muy_alto': 5, 'alto': 4, 'medio': 3, 'bajo': 2, 'muy_bajo': 1}
        prioridad_minima = niveles_prioridad.get(nivel_minimo, 3)
        
        sectores_criticos = [s for s in prediccion_sectores if s['prioridad'] >= prioridad_minima][:top]
        
        return jsonify({
            'success': True,
            'data': {
                'year': year,
                'month': month,
                'nivel_minimo': nivel_minimo,
                'total_sectores_criticos': len(sectores_criticos),
                'sectores': sectores_criticos
            }
        }), HTTP_OK
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), HTTP_INTERNAL_ERROR


@espacial_bp.route('/comparar_sectores', methods=['POST'])
def comparar_sectores():
    try:
        data = request.get_json()
        
        if not data.get('sectores_ids'):
            return jsonify({'success': False, 'error': 'Debe proporcionar sectores_ids'}), HTTP_BAD_REQUEST
        
        year = data.get('year')
        month = data.get('month')
        sectores_ids = data.get('sectores_ids')
        
        # Cargar modelo
        modelo = current_app.modelo if hasattr(current_app, 'modelo') else None
        if modelo is None or not modelo.trained:
            modelo = get_modelo()
            current_app.modelo = modelo
            if not modelo.trained:
                return jsonify({'success': False, 'error': 'Modelo no disponible'}), 503
        
        prediccion_global = modelo.predecir_mes(year, month)
        prediccion_sectores = modelo_espacial.predecir_sectores(prediccion_global)
        
        sectores_comparar = [s for s in prediccion_sectores if s['id_sector'] in sectores_ids]
        
        return jsonify({
            'success': True,
            'data': {
                'year': year,
                'month': month,
                'sectores': sectores_comparar,
                'comparacion': {
                    'sector_mas_critico': max(sectores_comparar, key=lambda x: x['prediccion']['total']) if sectores_comparar else None,
                    'sector_menos_critico': min(sectores_comparar, key=lambda x: x['prediccion']['total']) if sectores_comparar else None,
                    'promedio_denuncias': sum(s['prediccion']['denuncias'] for s in sectores_comparar) / len(sectores_comparar) if sectores_comparar else 0,
                    'promedio_emergencias': sum(s['prediccion']['emergencias'] for s in sectores_comparar) / len(sectores_comparar) if sectores_comparar else 0
                }
            }
        }), HTTP_OK
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), HTTP_INTERNAL_ERROR


@espacial_bp.route('/predecir_rango', methods=['POST'])
def predecir_rango_espacial():
    try:
        data = request.get_json()
        
        year_inicio = data.get('year_inicio')
        month_inicio = data.get('month_inicio')
        year_fin = data.get('year_fin')
        month_fin = data.get('month_fin')
        
        if not all([year_inicio, month_inicio, year_fin, month_fin]):
            return jsonify({'success': False, 'error': 'Faltan parámetros de rango'}), HTTP_BAD_REQUEST
        
        # Cargar modelo
        modelo = current_app.modelo if hasattr(current_app, 'modelo') else None
        if modelo is None or not modelo.trained:
            modelo = get_modelo()
            current_app.modelo = modelo
            if not modelo.trained:
                return jsonify({'success': False, 'error': 'Modelo no disponible'}), 503
        
        # Generar meses
        from datetime import datetime
        fecha_inicio = datetime(year_inicio, month_inicio, 1)
        fecha_fin = datetime(year_fin, month_fin, 1)
        
        meses = []
        fecha_actual = fecha_inicio
        
        while fecha_actual <= fecha_fin:
            meses.append({'year': fecha_actual.year, 'month': fecha_actual.month})
            if fecha_actual.month == 12:
                fecha_actual = datetime(fecha_actual.year + 1, 1, 1)
            else:
                fecha_actual = datetime(fecha_actual.year, fecha_actual.month + 1, 1)
        
        # Predecir
        series_por_sector = {}
        
        for mes_data in meses:
            prediccion_global = modelo.predecir_mes(mes_data['year'], mes_data['month'])
            prediccion_sectores = modelo_espacial.predecir_sectores(prediccion_global, incluir_detalles=False)
            
            for sector in prediccion_sectores:
                id_sector = sector['id_sector']
                
                if id_sector not in series_por_sector:
                    series_por_sector[id_sector] = {
                        'id_sector': id_sector,
                        'codigo_sector': sector['codigo_sector'],
                        'nombre': sector['nombre'],
                        'serie_temporal': []
                    }
                
                series_por_sector[id_sector]['serie_temporal'].append({
                    'year': mes_data['year'],
                    'month': mes_data['month'],
                    'fecha': f"{mes_data['year']}-{mes_data['month']:02d}",
                    'total': sector['prediccion']['total'],
                    'denuncias': sector['prediccion']['denuncias'],
                    'emergencias': sector['prediccion']['emergencias'],
                    'nivel': sector['nivel_criticidad']
                })
        
        return jsonify({
            'success': True,
            'data': {
                'rango': {
                    'inicio': f"{year_inicio}-{month_inicio:02d}",
                    'fin': f"{year_fin}-{month_fin:02d}",
                    'total_meses': len(meses)
                },
                'sectores': list(series_por_sector.values())
            }
        }), HTTP_OK
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), HTTP_INTERNAL_ERROR