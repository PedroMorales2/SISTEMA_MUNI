"""
routes/api/prediccion_espacial.py
API para predicciones espaciales con cuadrantes
"""
from flask import Blueprint, request, jsonify, current_app
import traceback

espacial_bp = Blueprint('espacial', __name__)


@espacial_bp.route('/entrenar', methods=['POST'])
def entrenar_espacial():
    """
    Entrena el modelo espacial con datos históricos
    
    Body JSON:
    {
        "csv_path": "data_modelo/dataset_incidencias_reque_2015_2024.csv",
        "n_filas": 5,
        "n_cols": 5
    }
    """
    try:
        data = request.get_json() or {}
        csv_path = data.get('csv_path', 'data_modelo/dataset_incidencias_reque_2015_2024.csv')
        n_filas = data.get('n_filas', 5)
        n_cols = data.get('n_cols', 5)
        
        import os
        if not os.path.exists(csv_path):
            return jsonify({
                'success': False,
                'error': f'Archivo no encontrado: {csv_path}'
            }), 404
        
        from models.modelo_PREDICCION_ESPACIAL import entrenar_modelo_espacial
        modelo_espacial = entrenar_modelo_espacial(csv_path, n_filas, n_cols)
        
        # Guardar en app context
        current_app.modelo_espacial = modelo_espacial
        
        return jsonify({
            'success': True,
            'message': '✅ Modelo espacial entrenado exitosamente',
            'cuadrantes_creados': len(modelo_espacial.cuadrantes),
            'grid_size': f"{n_filas}x{n_cols}"
        }), 200
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Error al entrenar modelo espacial: {str(e)}'
        }), 500


@espacial_bp.route('/cuadrantes', methods=['GET'])
def obtener_cuadrantes():
    """Obtiene información de todos los cuadrantes"""
    try:
        # Cargar modelo espacial
        if not hasattr(current_app, 'modelo_espacial') or current_app.modelo_espacial is None:
            from models.modelo_PREDICCION_ESPACIAL import get_modelo_espacial
            current_app.modelo_espacial = get_modelo_espacial()
        
        modelo_espacial = current_app.modelo_espacial
        
        if modelo_espacial.cuadrantes is None:
            return jsonify({
                'success': False,
                'error': 'Modelo espacial no entrenado. Ejecuta /entrenar primero.'
            }), 503
        
        # Convertir cuadrantes a formato JSON
        cuadrantes_data = []
        for _, cuad in modelo_espacial.cuadrantes.iterrows():
            cuad_id = int(cuad['id'])
            totales = modelo_espacial.distribuciones_historicas['totales_cuadrante'].get(cuad_id, {})
            
            cuadrantes_data.append({
                'id': cuad_id,
                'fila': int(cuad['fila']),
                'columna': int(cuad['columna']),
                'bounds': {
                    'lat_min': float(cuad['lat_min']),
                    'lat_max': float(cuad['lat_max']),
                    'lon_min': float(cuad['lon_min']),
                    'lon_max': float(cuad['lon_max'])
                },
                'centro': {
                    'lat': float(cuad['centro_lat']),
                    'lon': float(cuad['centro_lon'])
                },
                'historico': totales
            })
        
        return jsonify({
            'success': True,
            'data': {
                'cuadrantes': cuadrantes_data,
                'grid_bounds': modelo_espacial.grid_bounds,
                'grid_size': modelo_espacial.grid_size
            }
        }), 200
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@espacial_bp.route('/predecir', methods=['POST'])
def predecir_espacial():
    """
    Predice incidencias por cuadrante para un mes específico
    
    Body JSON:
    {
        "year": 2027,
        "month": 3
    }
    """
    try:
        # Validar entrada
        if not request.json:
            return jsonify({
                'success': False,
                'error': 'Se requiere body JSON'
            }), 400
        
        year = int(request.json.get('year'))
        month = int(request.json.get('month'))
        
        if not (1 <= month <= 12):
            return jsonify({
                'success': False,
                'error': 'month debe estar entre 1 y 12'
            }), 400
        
        # Cargar modelos
        if not hasattr(current_app, 'modelo') or current_app.modelo is None:
            from models.modelo_PREDICCION import get_modelo
            current_app.modelo = get_modelo()
        
        if not hasattr(current_app, 'modelo_espacial') or current_app.modelo_espacial is None:
            from models.modelo_PREDICCION_ESPACIAL import get_modelo_espacial
            current_app.modelo_espacial = get_modelo_espacial()
        
        modelo = current_app.modelo
        modelo_espacial = current_app.modelo_espacial
        
        if not modelo.trained:
            return jsonify({
                'success': False,
                'error': 'Modelo LSTM no entrenado'
            }), 503
        
        if modelo_espacial.cuadrantes is None:
            return jsonify({
                'success': False,
                'error': 'Modelo espacial no entrenado'
            }), 503
        
        # 1. Obtener predicción global del modelo LSTM
        print(f"🔮 Prediciendo espacialmente: {year}-{month:02d}")
        prediccion_global = modelo.predecir_mes(year, month)
        
        # 2. Distribuir predicción por cuadrantes
        prediccion_cuadrantes = modelo_espacial.predecir_cuadrantes(prediccion_global)
        
        # 3. Calcular estadísticas generales
        total_denuncias = sum(c['prediccion']['total'] for c in prediccion_cuadrantes)
        cuadrante_mas_critico = max(prediccion_cuadrantes, key=lambda x: x['prediccion']['total'])
        
        return jsonify({
            'success': True,
            'data': {
                'year': year,
                'month': month,
                'fecha_prediccion': f"{year}-{month:02d}",
                'cuadrantes': prediccion_cuadrantes,
                'resumen': {
                    'total_incidencias_predichas': total_denuncias,
                    'cuadrante_mas_critico': {
                        'id': cuadrante_mas_critico['cuadrante_id'],
                        'total': cuadrante_mas_critico['prediccion']['total'],
                        'nivel': cuadrante_mas_critico['nivel_criticidad']
                    },
                    'distribucion_niveles': {
                        'alto': len([c for c in prediccion_cuadrantes if c['nivel_criticidad'] == 'alto']),
                        'medio': len([c for c in prediccion_cuadrantes if c['nivel_criticidad'] == 'medio']),
                        'bajo': len([c for c in prediccion_cuadrantes if c['nivel_criticidad'] == 'bajo']),
                        'muy_bajo': len([c for c in prediccion_cuadrantes if c['nivel_criticidad'] == 'muy_bajo'])
                    }
                }
            }
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


@espacial_bp.route('/cuadrante/<int:cuadrante_id>', methods=['GET'])
def obtener_detalle_cuadrante(cuadrante_id):
    """Obtiene detalles históricos de un cuadrante específico"""
    try:
        if not hasattr(current_app, 'modelo_espacial') or current_app.modelo_espacial is None:
            from models.modelo_PREDICCION_ESPACIAL import get_modelo_espacial
            current_app.modelo_espacial = get_modelo_espacial()
        
        modelo_espacial = current_app.modelo_espacial
        
        if modelo_espacial.cuadrantes is None:
            return jsonify({
                'success': False,
                'error': 'Modelo espacial no entrenado'
            }), 503
        
        # Buscar cuadrante
        cuadrante = modelo_espacial.cuadrantes[modelo_espacial.cuadrantes['id'] == cuadrante_id]
        
        if cuadrante.empty:
            return jsonify({
                'success': False,
                'error': f'Cuadrante {cuadrante_id} no encontrado'
            }), 404
        
        cuad = cuadrante.iloc[0]
        
        # Obtener distribuciones
        dist_den = modelo_espacial.distribuciones_historicas['denuncias'].get(cuadrante_id, {})
        dist_eme = modelo_espacial.distribuciones_historicas['emergencias'].get(cuadrante_id, {})
        totales = modelo_espacial.distribuciones_historicas['totales_cuadrante'].get(cuadrante_id, {})
        
        return jsonify({
            'success': True,
            'data': {
                'cuadrante_id': cuadrante_id,
                'bounds': {
                    'lat_min': float(cuad['lat_min']),
                    'lat_max': float(cuad['lat_max']),
                    'lon_min': float(cuad['lon_min']),
                    'lon_max': float(cuad['lon_max'])
                },
                'centro': {
                    'lat': float(cuad['centro_lat']),
                    'lon': float(cuad['centro_lon'])
                },
                'distribucion_historica': {
                    'denuncias': dist_den,
                    'emergencias': dist_eme
                },
                'totales_historicos': totales
            }
        }), 200
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@espacial_bp.route('/mapa_calor', methods=['POST'])
def generar_mapa_calor():
    """
    Genera datos para mapa de calor basado en predicción
    
    Body JSON:
    {
        "year": 2027,
        "month": 3,
        "tipo": "total" | "denuncias" | "emergencias"
    }
    """
    try:
        data = request.get_json() or {}
        year = int(data.get('year'))
        month = int(data.get('month'))
        tipo_mapa = data.get('tipo', 'total')
        
        # Cargar modelos
        if not hasattr(current_app, 'modelo') or current_app.modelo is None:
            from models.modelo_PREDICCION import get_modelo
            current_app.modelo = get_modelo()
        
        if not hasattr(current_app, 'modelo_espacial') or current_app.modelo_espacial is None:
            from models.modelo_PREDICCION_ESPACIAL import get_modelo_espacial
            current_app.modelo_espacial = get_modelo_espacial()
        
        modelo = current_app.modelo
        modelo_espacial = current_app.modelo_espacial
        
        # Obtener predicción
        prediccion_global = modelo.predecir_mes(year, month)
        prediccion_cuadrantes = modelo_espacial.predecir_cuadrantes(prediccion_global)
        
        # Preparar datos para mapa de calor
        mapa_calor = []
        for cuad in prediccion_cuadrantes:
            if tipo_mapa == 'denuncias':
                intensidad = sum(cuad['prediccion']['denuncias'].values())
            elif tipo_mapa == 'emergencias':
                intensidad = sum(cuad['prediccion']['emergencias'].values())
            else:  # total
                intensidad = cuad['prediccion']['total']
            
            mapa_calor.append({
                'lat': cuad['centro']['lat'],
                'lon': cuad['centro']['lon'],
                'intensidad': intensidad,
                'cuadrante_id': cuad['cuadrante_id']
            })
        
        return jsonify({
            'success': True,
            'data': {
                'puntos': mapa_calor,
                'tipo': tipo_mapa,
                'fecha': f"{year}-{month:02d}"
            }
        }), 200
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500