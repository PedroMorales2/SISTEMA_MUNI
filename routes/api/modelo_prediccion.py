"""
routes/api/modelo_prediccion.py
API para predicciones con modelo LSTM
"""
from flask import Blueprint, request, jsonify, current_app
import traceback
from datetime import datetime

prediccion_bp = Blueprint('prediccion', __name__)


@prediccion_bp.route('/health', methods=['GET'])
def health_check():
    """Health check del servicio de predicción"""
    modelo = current_app.modelo
    return jsonify({
        'status': 'ok',
        'service': 'Predicción de Incidencias',
        'modelo_cargado': modelo is not None and modelo.trained if modelo else False
    }), 200


@prediccion_bp.route('/predecir', methods=['POST'])
def predecir():
    """
    Predice incidencias para un mes específico
    
    Body JSON:
    {
        "year": 2027,
        "month": 3
    }
    """
    modelo = current_app.modelo
    
    try:
        if not request.json:
            return jsonify({
                'success': False,
                'error': 'Se requiere body JSON'
            }), 400
        
        year = request.json.get('year')
        month = request.json.get('month')
        
        if year is None or month is None:
            return jsonify({
                'success': False,
                'error': 'Se requieren los campos "year" y "month"'
            }), 400
        
        try:
            year = int(year)
            month = int(month)
        except (ValueError, TypeError):
            return jsonify({
                'success': False,
                'error': 'year y month deben ser números enteros'
            }), 400
        
        if not (1 <= month <= 12):
            return jsonify({
                'success': False,
                'error': 'month debe estar entre 1 y 12'
            }), 400
        
        if year < 2020 or year > 2050:
            return jsonify({
                'success': False,
                'error': 'year debe estar entre 2020 y 2050'
            }), 400
        
        # Cargar modelo si no está cargado
        if modelo is None or not modelo.trained:
            from models.modelo_PREDICCION import get_modelo
            modelo = get_modelo()
            current_app.modelo = modelo
            
            if not modelo.trained:
                return jsonify({
                    'success': False,
                    'error': 'Modelo no disponible. Entrena el modelo primero.'
                }), 503
        
        # Realizar predicción
        print(f"🔮 Prediciendo: {year}-{month:02d}")
        prediccion = modelo.predecir_mes(year, month)
        print(f"✅ Predicción completada para {year}-{month:02d}")
        
        return jsonify({
            'success': True,
            'data': prediccion
        }), 200
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Error interno: {str(e)}'
        }), 500


@prediccion_bp.route('/predecir/rango', methods=['POST'])
def predecir_rango():
    """
    Predice múltiples meses
    
    Body JSON:
    {
        "year_inicio": 2027,
        "month_inicio": 1,
        "meses": 3
    }
    """
    modelo = current_app.modelo
    
    try:
        if not request.json:
            return jsonify({
                'success': False,
                'error': 'Se requiere body JSON'
            }), 400
        
        year_inicio = int(request.json.get('year_inicio'))
        month_inicio = int(request.json.get('month_inicio'))
        meses = int(request.json.get('meses', 1))
        
        if not (1 <= month_inicio <= 12):
            return jsonify({
                'success': False,
                'error': 'month_inicio debe estar entre 1 y 12'
            }), 400
        
        if meses < 1 or meses > 24:
            return jsonify({
                'success': False,
                'error': 'meses debe estar entre 1 y 24'
            }), 400
        
        # Cargar modelo
        if modelo is None or not modelo.trained:
            from models.modelo_PREDICCION import get_modelo
            modelo = get_modelo()
            current_app.modelo = modelo
            
            if not modelo.trained:
                return jsonify({
                    'success': False,
                    'error': 'Modelo no disponible'
                }), 503
        
        # Predecir cada mes
        predicciones = []
        current_year = year_inicio
        current_month = month_inicio
        
        for _ in range(meses):
            pred = modelo.predecir_mes(current_year, current_month)
            predicciones.append(pred)
            
            current_month += 1
            if current_month > 12:
                current_month = 1
                current_year += 1
        
        return jsonify({
            'success': True,
            'data': predicciones,
            'total_meses': len(predicciones)
        }), 200
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Error interno: {str(e)}'
        }), 500


@prediccion_bp.route('/metricas', methods=['GET'])
def obtener_metricas():
    """Obtiene métricas de calidad del modelo"""
    modelo = current_app.modelo
    
    try:
        if modelo is None or not modelo.trained:
            from models.modelo_PREDICCION import get_modelo
            modelo = get_modelo()
            current_app.modelo = modelo
            
            if not modelo.trained:
                return jsonify({
                    'success': False,
                    'error': 'Modelo no disponible'
                }), 503
        
        metricas = modelo.obtener_metricas()
        
        return jsonify({
            'success': True,
            'data': metricas
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Error interno: {str(e)}'
        }), 500


@prediccion_bp.route('/entrenar', methods=['POST'])
def entrenar_modelo():
    """Entrena el modelo con datos actualizados"""
    try:
        csv_path = 'data_modelo/dataset_incidencias_reque_2015_2024.csv'

        if request.is_json:
            data = request.get_json(silent=True) or {}
            if 'csv_path' in data:
                csv_path = data['csv_path']
        
        import os
        if not os.path.exists(csv_path):
            return jsonify({
                'success': False,
                'error': f'Archivo no encontrado: {csv_path}'
            }), 404
        
        # Crear y entrenar modelo
        from models.modelo_PREDICCION import ModeloPrediccionIncidencias
        modelo = ModeloPrediccionIncidencias()
        modelo.entrenar_modelos(csv_path)
        
        # Actualizar modelo global
        current_app.modelo = modelo
        
        return jsonify({
            'success': True,
            'message': '✅ Modelo entrenado exitosamente',
            'tipos_denuncias': len(modelo.models_den),
            'tipos_emergencias': len(modelo.models_eme)
        }), 200
    
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'⚠️ Error al entrenar: {str(e)}'
        }), 500


@prediccion_bp.route('/limpiar_cache', methods=['POST'])
def limpiar_cache():
    """Limpia el caché de predicciones"""
    modelo = current_app.modelo
    
    try:
        if modelo is None:
            from models.modelo_PREDICCION import get_modelo
            modelo = get_modelo()
            current_app.modelo = modelo
        
        modelo.limpiar_cache()
        
        return jsonify({
            'success': True,
            'message': 'Caché limpiado exitosamente'
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@prediccion_bp.route('/info', methods=['GET'])
def info_modelo():
    """
    Información detallada sobre el modelo, métricas de precisión y estadísticas
    """
    modelo = current_app.modelo
    
    try:
        if modelo is None or not modelo.trained:
            return jsonify({
                'success': False,
                'error': 'Modelo no disponible'
            }), 503
        
        # Calcular métricas agregadas de denuncias
        metricas_den = modelo.obtener_metricas()['denuncias']
        mae_den_values = [m['mae'] for m in metricas_den.values()]
        rmse_den_values = [m['rmse'] for m in metricas_den.values()]
        
        # Calcular métricas agregadas de emergencias
        metricas_eme = modelo.obtener_metricas()['emergencias']
        mae_eme_values = [m['mae'] for m in metricas_eme.values()]
        rmse_eme_values = [m['rmse'] for m in metricas_eme.values()]
        
        # Estadísticas de datos históricos - Denuncias
        den_stats = modelo.den_monthly.groupby('id_denuncia')['count'].agg([
            ('promedio', 'mean'),
            ('maximo', 'max'),
            ('minimo', 'min'),
            ('desviacion', 'std'),
            ('total_registros', 'count')
        ]).round(2)
        
        # Estadísticas de datos históricos - Emergencias
        eme_stats = modelo.eme_monthly.groupby('id_numero_emergencia')['count'].agg([
            ('promedio', 'mean'),
            ('maximo', 'max'),
            ('minimo', 'min'),
            ('desviacion', 'std'),
            ('total_registros', 'count')
        ]).round(2)
        
        # Calcular precisión relativa (MAE / promedio histórico)
        precision_denuncias = {}
        for tipo_id in metricas_den.keys():
            mae = metricas_den[tipo_id]['mae']
            promedio = den_stats.loc[tipo_id, 'promedio']
            error_relativo = (mae / promedio * 100) if promedio > 0 else 0
            precision_denuncias[int(tipo_id)] = {
                'mae': round(mae, 2),
                'rmse': round(metricas_den[tipo_id]['rmse'], 2),
                'promedio_historico': round(promedio, 2),
                'error_relativo_porcentaje': round(error_relativo, 2),
                'precision_porcentaje': round(max(0, 100 - error_relativo), 2),
                'interpretacion': _interpretar_precision(error_relativo)
            }
        
        precision_emergencias = {}
        for tipo_id in metricas_eme.keys():
            mae = metricas_eme[tipo_id]['mae']
            promedio = eme_stats.loc[tipo_id, 'promedio']
            error_relativo = (mae / promedio * 100) if promedio > 0 else 0
            precision_emergencias[int(tipo_id)] = {
                'mae': round(mae, 2),
                'rmse': round(metricas_eme[tipo_id]['rmse'], 2),
                'promedio_historico': round(promedio, 2),
                'error_relativo_porcentaje': round(error_relativo, 2),
                'precision_porcentaje': round(max(0, 100 - error_relativo), 2),
                'interpretacion': _interpretar_precision(error_relativo)
            }
        
        # Forzar a int() para evitar "Unknown format code 'd'"
        ultimo_mes_den = f"{int(modelo.den_monthly['year'].max())}-{int(modelo.den_monthly['month'].max()):02d}"
        periodo_datos_den = f"{int(modelo.den_monthly['year'].min())}-{int(modelo.den_monthly['month'].min()):02d} a {int(modelo.den_monthly['year'].max())}-{int(modelo.den_monthly['month'].max()):02d}"

        ultimo_mes_eme = f"{int(modelo.eme_monthly['year'].max())}-{int(modelo.eme_monthly['month'].max()):02d}"
        periodo_datos_eme = f"{int(modelo.eme_monthly['year'].min())}-{int(modelo.eme_monthly['month'].min()):02d} a {int(modelo.eme_monthly['year'].max())}-{int(modelo.eme_monthly['month'].max()):02d}"

        # Resumen general
        info = {
            'modelo': {
                'arquitectura': 'Bidirectional LSTM (64-32-16-1)',
                'lookback_meses': 6,
                'features_temporales': ['mensual', 'trimestral', 'tendencia'],
                'regularizacion': 'L2 + Dropout (20-30%)',
                'funcion_perdida': 'Huber Loss',
                'optimizador': 'Adam (lr=0.001)',
                'seed_reproducibilidad': 42
            },
            
            'datos': {
                'denuncias': {
                    'tipos_unicos': len(modelo.models_den),
                    'ultimo_mes': ultimo_mes_den,
                    'periodo_datos': periodo_datos_den,
                    'total_meses_historicos': len(modelo.den_monthly['month'].unique()) * len(modelo.den_monthly['year'].unique())
                },
                'emergencias': {
                    'tipos_unicos': len(modelo.models_eme),
                    'ultimo_mes': ultimo_mes_eme,
                    'periodo_datos': periodo_datos_eme,
                    'total_meses_historicos': len(modelo.eme_monthly['month'].unique()) * len(modelo.eme_monthly['year'].unique())
                }
            },
            
            'metricas_agregadas': {
                'denuncias': {
                    'mae_promedio': round(sum(mae_den_values) / len(mae_den_values), 2),
                    'mae_minimo': round(min(mae_den_values), 2),
                    'mae_maximo': round(max(mae_den_values), 2),
                    'rmse_promedio': round(sum(rmse_den_values) / len(rmse_den_values), 2),
                    'rmse_minimo': round(min(rmse_den_values), 2),
                    'rmse_maximo': round(max(rmse_den_values), 2),
                    'interpretacion': _interpretar_mae_global(sum(mae_den_values) / len(mae_den_values))
                },
                'emergencias': {
                    'mae_promedio': round(sum(mae_eme_values) / len(mae_eme_values), 2),
                    'mae_minimo': round(min(mae_eme_values), 2),
                    'mae_maximo': round(max(mae_eme_values), 2),
                    'rmse_promedio': round(sum(rmse_eme_values) / len(rmse_eme_values), 2),
                    'rmse_minimo': round(min(rmse_eme_values), 2),
                    'rmse_maximo': round(max(rmse_eme_values), 2),
                    'interpretacion': _interpretar_mae_global(sum(mae_eme_values) / len(mae_eme_values))
                }
            },
            
            'precision_por_tipo': {
                'denuncias': precision_denuncias,
                'emergencias': precision_emergencias
            },
            
            'estadisticas_historicas': {
                'denuncias': {int(k): v for k, v in den_stats.to_dict('index').items()},
                'emergencias': {int(k): v for k, v in eme_stats.to_dict('index').items()}
            },
            
            'calidad_global': {
                'denuncias': _evaluar_calidad_global(
                    sum(mae_den_values) / len(mae_den_values),
                    sum([p['error_relativo_porcentaje'] for p in precision_denuncias.values()]) / len(precision_denuncias)
                ),
                'emergencias': _evaluar_calidad_global(
                    sum(mae_eme_values) / len(mae_eme_values),
                    sum([p['error_relativo_porcentaje'] for p in precision_emergencias.values()]) / len(precision_emergencias)
                )
            },
            
            'recomendaciones': _generar_recomendaciones(
                sum(mae_den_values) / len(mae_den_values),
                sum(mae_eme_values) / len(mae_eme_values),
                len(modelo.den_monthly),
                len(modelo.eme_monthly)
            )
        }
        
        return jsonify({
            'success': True,
            'data': info
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


def _interpretar_precision(error_relativo):
    """Interpreta el error relativo"""
    if error_relativo < 10:
        return 'Excelente - Error muy bajo'
    elif error_relativo < 20:
        return 'Buena - Error aceptable'
    elif error_relativo < 35:
        return 'Moderada - Error considerable'
    elif error_relativo < 50:
        return 'Regular - Error alto'
    else:
        return 'Baja - Error muy alto'


def _interpretar_mae_global(mae):
    """Interpreta el MAE global"""
    if mae < 2:
        return 'Excelente - Predicciones muy precisas'
    elif mae < 4:
        return 'Buena - Predicciones confiables'
    elif mae < 6:
        return 'Moderada - Predicciones aceptables'
    else:
        return 'Regular - Considerar mejorar el modelo'


def _evaluar_calidad_global(mae_promedio, error_relativo_promedio):
    """Evalúa la calidad global del modelo"""
    score = 100 - (error_relativo_promedio * 1.5)  # Solo usar % de error
    score = max(0, min(100, score))
    
    if score >= 85:
        nivel = 'Excelente'
        color = 'verde'
        confianza = 'Alta'
    elif score >= 70:
        nivel = 'Buena'
        color = 'verde-claro'
        confianza = 'Moderada-Alta'
    elif score >= 55:
        nivel = 'Aceptable'
        color = 'amarillo'
        confianza = 'Moderada'
    else:
        nivel = 'Mejorable'
        color = 'naranja'
        confianza = 'Baja-Moderada'
    
    return {
        'score': round(score, 2),
        'nivel': nivel,
        'color': color,
        'confianza': confianza,
        'descripcion': f'El modelo tiene una calidad {nivel.lower()} con un score de {round(score, 2)}/100'
    }


def _generar_recomendaciones(mae_den, mae_eme, n_datos_den, n_datos_eme):
    """Genera recomendaciones basadas en las métricas"""
    recomendaciones = []
    
    if mae_den > 5 or mae_eme > 5:
        recomendaciones.append({
            'tipo': 'warning',
            'mensaje': 'MAE alto detectado. Considera reentrenar con más datos históricos.',
            'accion': 'Agregar más meses de datos históricos al dataset'
        })
    
    if n_datos_den < 500:
        recomendaciones.append({
            'tipo': 'info',
            'mensaje': 'Dataset de denuncias relativamente pequeño.',
            'accion': 'Incrementar el período de datos históricos para mejorar precisión'
        })
    
    if n_datos_eme < 500:
        recomendaciones.append({
            'tipo': 'info',
            'mensaje': 'Dataset de emergencias relativamente pequeño.',
            'accion': 'Incrementar el período de datos históricos para mejorar precisión'
        })
    
    if mae_den < 3 and mae_eme < 3:
        recomendaciones.append({
            'tipo': 'success',
            'mensaje': '¡Modelo con excelente desempeño!',
            'accion': 'Las predicciones son confiables para toma de decisiones'
        })
    
    recomendaciones.append({
        'tipo': 'tip',
        'mensaje': 'Validación continua recomendada',
        'accion': 'Comparar predicciones con datos reales mensualmente y reentrenar si es necesario'
    })
    
    return recomendaciones
