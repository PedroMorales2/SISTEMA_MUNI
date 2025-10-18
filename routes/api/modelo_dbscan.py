"""
routes/api/modelo_dbscan.py
API para clustering DBSCAN de incidencias
"""
from flask import Blueprint, request, jsonify
import pandas as pd
import traceback
import math
import numpy as np

from models import models_DBSCAN

dbscan_bp = Blueprint('dbscan', __name__)


def limpiar_nans(obj):
    """Convierte NaN/NaT en None de manera recursiva"""
    if isinstance(obj, dict):
        return {k: limpiar_nans(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [limpiar_nans(x) for x in obj]
    elif isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    else:
        return obj


@dbscan_bp.route('/procesar', methods=['GET'])
def procesar_modelo_dbscan():
    """
    Procesa modelo DBSCAN sobre incidencias
    
    Query params:
        - eps: Radio de vecindad en metros (default: 50)
        - min_samples: Mínimo de vecinos (default: 3)
        - auto_eps: Calcular eps automáticamente (default: false)
        - temporal: Incluir dimensión temporal (default: false)
    """
    try:
        # Leer CSV
        df_input = pd.read_csv("data_modelo/dataset_incidencias_reque.csv")
        
        # Parámetros
        eps_metros = request.args.get('eps', 50, type=int)
        min_samples = request.args.get('min_samples', 3, type=int)
        auto_eps = request.args.get('auto_eps', 'false').lower() == 'true'
        incluir_temporal = request.args.get('temporal', 'false').lower() == 'true'
        
        # Aplicar DBSCAN
        df_clusters = models_DBSCAN.dbscan_incidencias_mejorado(
            df_input,
            eps_m=eps_metros if not auto_eps else None,
            min_samples=min_samples,
            auto_eps=auto_eps,
            incluir_temporal=incluir_temporal
        )
        
        if df_clusters.empty:
            return jsonify({
                "status": "error",
                "message": "No se pudieron procesar los datos"
            }), 400
        
        # Mapeo de categorías
        denuncias_dict = {
            1: "Ruidos molestos",
            2: "Bullying y violencia familiar",
            3: "Ocupación vía pública",
            4: "Parques y jardines",
            5: "Limpieza pública",
            6: "Negocios informales",
            7: "Otros",
            8: "Peleas y conflictos",
            9: "Lluvias intensas",
            10: "Sismos",
            11: "Incendio urbano",
            12: "Riesgo de colapso"
        }
        
        emergencias_dict = {
            2: "Policía (911)",
            3: "Serenazgo (955)",
            4: "Ambulancia (666)",
            5: "Bomberos Monsefú (444)",
            6: "Bomberos Chiclayo (922)"
        }
        
        # Agregar columna tipo_categoria
        def obtener_categoria(row):
            if pd.notna(row['id_denuncia']) and row['id_denuncia'] in denuncias_dict:
                return denuncias_dict[int(row['id_denuncia'])]
            elif pd.notna(row['id_numero_emergencia']) and row['id_numero_emergencia'] in emergencias_dict:
                return emergencias_dict[int(row['id_numero_emergencia'])]
            else:
                return "Sin categoría"
        
        df_clusters['tipo_categoria'] = df_clusters.apply(obtener_categoria, axis=1)
        
        # Agregar nombre de emergencia
        df_clusters['nombre_emergencia'] = df_clusters['id_numero_emergencia'].apply(
            lambda x: emergencias_dict.get(int(x), None) if pd.notna(x) else None
        )
        
        # Estadísticas
        stats = {
            'total_registros': len(df_clusters),
            'clusters_encontrados': int(len(set(df_clusters['cluster'])) - (1 if -1 in df_clusters['cluster'].values else 0)),
            'puntos_ruido': int((df_clusters['cluster'] == -1).sum()),
            'porcentaje_agrupado': round((len(df_clusters) - (df_clusters['cluster'] == -1).sum()) / len(df_clusters) * 100, 2)
        }
        
        # Preparar datos para JSON
        df_clusters = df_clusters.where(pd.notna(df_clusters), None)
        df_clusters['cluster'] = df_clusters['cluster'].astype(int)
        
        # Convertir IDs a int cuando no son None
        for col in ['id_denuncia', 'id_numero_emergencia', 'id_tipo_incidencia', 'id_usuario']:
            if col in df_clusters.columns:
                df_clusters[col] = df_clusters[col].apply(
                    lambda x: int(x) if pd.notna(x) else None
                )
        
        resultado = df_clusters.to_dict(orient="records")
        resultado = limpiar_nans(resultado)

        return jsonify({
            "status": "success",
            "stats": stats,
            "clusters": resultado
        }), 200

    except FileNotFoundError:
        return jsonify({
            "status": "error",
            "message": "Archivo dataset_incidencias_reque.csv no encontrado"
        }), 404
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500