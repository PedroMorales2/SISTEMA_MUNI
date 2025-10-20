"""
modelo_PREDICCION_produccion.py
Versión de PRODUCCIÓN - Solo CARGA modelos preentrenados
Mantiene toda la funcionalidad del original pero sin entrenar
"""

import pandas as pd
import numpy as np
import pickle
import os

# Configuración para forzar CPU
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

from sklearn.preprocessing import RobustScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error
from functools import lru_cache
import hashlib
import json

try:
    import tensorflow as tf
    tf.config.set_visible_devices([], 'GPU')
    TENSORFLOW_OK = True
except Exception as e:
    print(f"⚠️ TensorFlow no disponible: {e}")
    TENSORFLOW_OK = False

# Configuración de reproducibilidad
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)
if TENSORFLOW_OK:
    tf.random.set_seed(RANDOM_SEED)

# Rutas de archivos
MODEL_DIR = 'modelos_entrenados'
DATA_DIR = 'datos_procesados'
CACHE_DIR = 'cache_predicciones'


class ModeloPrediccionIncidencias:
    """
    Clase para predicción de incidencias - VERSIÓN PRODUCCIÓN
    Solo CARGA modelos .keras preentrenados, NO entrena
    """

    def __init__(self):
        self.models_den = {}
        self.models_eme = {}
        self.den_monthly = None
        self.eme_monthly = None
        self.trained = False
        self.cache_predicciones = {}  # Caché en memoria

        # Crear directorios
        os.makedirs(MODEL_DIR, exist_ok=True)
        os.makedirs(DATA_DIR, exist_ok=True)
        os.makedirs(CACHE_DIR, exist_ok=True)

        # Cargar caché de disco si existe
        self._cargar_cache_disco()

        # Intentar cargar modelos automáticamente
        if TENSORFLOW_OK:
            try:
                self.cargar_modelos()
            except Exception as e:
                print(f"⚠️ No se pudieron cargar modelos automáticamente: {e}")

    def _cargar_cache_disco(self):
        """Carga caché de predicciones previas"""
        cache_path = f'{CACHE_DIR}/predicciones_cache.pkl'
        if os.path.exists(cache_path):
            try:
                with open(cache_path, 'rb') as f:
                    self.cache_predicciones = pickle.load(f)
                print(f"✅ Caché cargado: {len(self.cache_predicciones)} predicciones")
            except:
                self.cache_predicciones = {}

    def _guardar_cache_disco(self):
        """Guarda caché en disco"""
        cache_path = f'{CACHE_DIR}/predicciones_cache.pkl'
        try:
            with open(cache_path, 'wb') as f:
                pickle.dump(self.cache_predicciones, f)
        except Exception as e:
            print(f"⚠️ Error guardando caché: {e}")

    def _get_cache_key(self, year, month, tipo_id, tipo_modelo):
        """Genera clave única para caché"""
        return f"{tipo_modelo}_{tipo_id}_{year}_{month:02d}"

    def cargar_modelos(self):
        """
        CARGA MODELOS PREENTRENADOS desde disco (.keras)
        Este método REEMPLAZA al entrenamiento
        """
        if not TENSORFLOW_OK:
            raise Exception("TensorFlow no disponible")

        print("="*70)
        print("CARGANDO MODELOS PREENTRENADOS - MODO PRODUCCIÓN")
        print("="*70)

        try:
            # Cargar datos mensuales procesados
            den_path = f'{DATA_DIR}/denuncias_monthly.pkl'
            eme_path = f'{DATA_DIR}/emergencias_monthly.pkl'

            if os.path.exists(den_path) and os.path.exists(eme_path):
                with open(den_path, 'rb') as f:
                    self.den_monthly = pickle.load(f)
                with open(eme_path, 'rb') as f:
                    self.eme_monthly = pickle.load(f)
                print("✅ Datos mensuales cargados")
            else:
                print("⚠️ Datos mensuales no encontrados, se usarán valores por defecto")
                self.den_monthly = None
                self.eme_monthly = None

            # Cargar modelos de DENUNCIAS (12 tipos)
            print("\n📂 Cargando modelos de DENUNCIAS...")
            for tipo in range(1, 13):
                modelo_path = f'{MODEL_DIR}/den_tipo_{tipo}.keras'
                scalers_path = f'{MODEL_DIR}/den_tipo_{tipo}_scalers.pkl'
                metrics_path = f'{MODEL_DIR}/den_tipo_{tipo}_metrics.pkl'

                if os.path.exists(modelo_path):
                    # Cargar modelo
                    model = tf.keras.models.load_model(modelo_path, compile=False)

                    # Cargar scalers
                    scalers = None
                    if os.path.exists(scalers_path):
                        with open(scalers_path, 'rb') as f:
                            scalers = pickle.load(f)

                    # Cargar métricas
                    metrics = {'mae': 0, 'rmse': 0}
                    if os.path.exists(metrics_path):
                        with open(metrics_path, 'rb') as f:
                            metrics = pickle.load(f)

                    self.models_den[tipo] = {
                        'model': model,
                        'scalers': scalers,
                        'lookback': 6,  # Valor por defecto
                        'metrics': metrics
                    }

                    print(f"  ✅ Denuncia tipo {tipo:2d} - MAE: {metrics.get('mae', 0):.1f}")
                else:
                    print(f"  ⚠️ Denuncia tipo {tipo:2d} - NO ENCONTRADO")

            # Cargar modelos de EMERGENCIAS (6 tipos)
            print("\n📂 Cargando modelos de EMERGENCIAS...")
            for tipo in range(1, 7):
                modelo_path = f'{MODEL_DIR}/eme_tipo_{tipo}.keras'
                scalers_path = f'{MODEL_DIR}/eme_tipo_{tipo}_scalers.pkl'
                metrics_path = f'{MODEL_DIR}/eme_tipo_{tipo}_metrics.pkl'

                if os.path.exists(modelo_path):
                    # Cargar modelo
                    model = tf.keras.models.load_model(modelo_path, compile=False)

                    # Cargar scalers
                    scalers = None
                    if os.path.exists(scalers_path):
                        with open(scalers_path, 'rb') as f:
                            scalers = pickle.load(f)

                    # Cargar métricas
                    metrics = {'mae': 0, 'rmse': 0}
                    if os.path.exists(metrics_path):
                        with open(metrics_path, 'rb') as f:
                            metrics = pickle.load(f)

                    self.models_eme[tipo] = {
                        'model': model,
                        'scalers': scalers,
                        'lookback': 6,
                        'metrics': metrics
                    }

                    print(f"  ✅ Emergencia tipo {tipo:2d} - MAE: {metrics.get('mae', 0):.1f}")
                else:
                    print(f"  ⚠️ Emergencia tipo {tipo:2d} - NO ENCONTRADO")

            # Verificar que se cargaron modelos
            total_den = len(self.models_den)
            total_eme = len(self.models_eme)

            if total_den > 0 and total_eme > 0:
                self.trained = True
                print("\n" + "="*70)
                print(f"✅ MODELOS CARGADOS: {total_den} denuncias + {total_eme} emergencias")
                print("="*70)
            else:
                print("\n⚠️ NO SE CARGARON MODELOS SUFICIENTES")
                self.trained = False

        except Exception as e:
            print(f"\n❌ Error cargando modelos: {e}")
            import traceback
            traceback.print_exc()
            self.trained = False

    def predecir_mes(self, year, month):
        """
        Predice incidencias para un mes específico
        IDÉNTICO al original
        """
        if not self.trained:
            raise Exception("Modelos no disponibles. Cargar primero con cargar_modelos()")

        # Predecir denuncias (CON CACHÉ)
        pred_den = self._forecast_single_month_cached(
            self.models_den, self.den_monthly, year, month, 'denuncias'
        )

        # Predecir emergencias (CON CACHÉ)
        pred_eme = self._forecast_single_month_cached(
            self.models_eme, self.eme_monthly, year, month, 'emergencias'
        )

        # GUARDAR CACHÉ DESPUÉS DE CADA PREDICCIÓN
        self._guardar_cache_disco()

        resultado = {
            'year': year,
            'month': month,
            'denuncias': pred_den,
            'emergencias': pred_eme,
            'fecha_prediccion': f"{year}-{month:02d}"
        }

        return resultado

    def _forecast_single_month_cached(self, model_dict, df_month, target_year, target_month, tipo_modelo):
        """
        VERSIÓN OPTIMIZADA CON CACHÉ - RETORNA ENTEROS
        IDÉNTICO al original
        """
        if df_month is None:
            # Si no hay datos mensuales, usar valores predeterminados
            return {}

        col_tipo = df_month.columns[2]
        predictions = {}

        # Procesar TODOS los tipos en paralelo (batch)
        tipos_a_predecir = []
        for tipo_id, model_info in model_dict.items():
            if model_info is None:
                continue

            # Verificar caché
            cache_key = self._get_cache_key(target_year, target_month, tipo_id, tipo_modelo)
            if cache_key in self.cache_predicciones:
                predictions[int(tipo_id)] = int(round(self.cache_predicciones[cache_key]))
                continue

            tipos_a_predecir.append(tipo_id)

        # Si todos están en caché, retornar inmediatamente
        if not tipos_a_predecir:
            return predictions

        # Predecir solo los tipos que no están en caché
        print(f"🔮 Calculando {len(tipos_a_predecir)} tipos para {target_year}-{target_month:02d}...")

        for tipo_id in tipos_a_predecir:
            model_info = model_dict[tipo_id]
            model = model_info['model']
            scalers = model_info['scalers']
            lookback = model_info['lookback']

            if scalers is None:
                # Sin scalers, usar predicción simple
                predictions[int(tipo_id)] = 0
                continue

            # Obtener datos históricos
            tipo_df = df_month[df_month[col_tipo] == tipo_id].copy()
            last_year = tipo_df['year'].max()
            last_month = tipo_df['month'].max()

            # Calcular meses intermedios necesarios
            months_needed = []
            current_month = last_month
            current_year = last_year

            while (current_year < target_year) or (current_year == target_year and current_month < target_month):
                current_month += 1
                if current_month > 12:
                    current_month = 1
                    current_year += 1
                months_needed.append((current_year, current_month))

            # Construir buffer de datos históricos
            temp_data = []
            for _, row in tipo_df.iterrows():
                temp_data.append({
                    'year': row['year'],
                    'month': row['month'],
                    'sin_m': row['sin_m'],
                    'cos_m': row['cos_m'],
                    'sin_q': row['sin_q'],
                    'cos_q': row['cos_q'],
                    'trend': row['trend'],
                    'month_idx': row['month_idx'],
                    'count': row['count']
                })

            # Predecir iterativamente
            for pred_year, pred_month in months_needed:
                # Verificar caché intermedio
                inter_cache_key = self._get_cache_key(pred_year, pred_month, tipo_id, tipo_modelo)

                if inter_cache_key in self.cache_predicciones:
                    pred_count_raw = self.cache_predicciones[inter_cache_key]
                else:
                    # Calcular predicción
                    sin_m_raw = np.sin(2 * np.pi * pred_month / 12)
                    cos_m_raw = np.cos(2 * np.pi * pred_month / 12)
                    sin_q_raw = np.sin(2 * np.pi * pred_month / 3)
                    cos_q_raw = np.cos(2 * np.pi * pred_month / 3)
                    trend_raw = len(temp_data)
                    month_idx_raw = pred_month

                    # Ventana de lookback
                    recent_data = temp_data[-lookback:]

                    # Escalar datos
                    window_data = []
                    for entry in recent_data:
                        row_scaled = [
                            scalers['sin_m'].transform([[entry['sin_m']]])[0, 0],
                            scalers['cos_m'].transform([[entry['cos_m']]])[0, 0],
                            scalers['sin_q'].transform([[entry['sin_q']]])[0, 0],
                            scalers['cos_q'].transform([[entry['cos_q']]])[0, 0],
                            scalers['trend'].transform([[entry['trend']]])[0, 0],
                            scalers['month_idx'].transform([[entry['month_idx']]])[0, 0],
                            scalers['count'].transform([[entry['count']]])[0, 0]
                        ]
                        window_data.append(row_scaled)

                    X = np.array(window_data).reshape(1, lookback, -1)

                    # Predicción
                    pred_scaled = model.predict(X, verbose=0)[0, 0]
                    pred_count_raw = scalers['count'].inverse_transform([[pred_scaled]])[0, 0]
                    pred_count_raw = int(max(0, round(pred_count_raw)))

                    # Guardar en caché
                    self.cache_predicciones[inter_cache_key] = pred_count_raw

                # Agregar a temp_data
                temp_data.append({
                    'year': pred_year,
                    'month': pred_month,
                    'sin_m': np.sin(2 * np.pi * pred_month / 12),
                    'cos_m': np.cos(2 * np.pi * pred_month / 12),
                    'sin_q': np.sin(2 * np.pi * pred_month / 3),
                    'cos_q': np.cos(2 * np.pi * pred_month / 3),
                    'trend': len(temp_data),
                    'month_idx': pred_month,
                    'count': pred_count_raw
                })

                # Si llegamos al mes objetivo, guardar resultado
                if pred_year == target_year and pred_month == target_month:
                    predictions[int(tipo_id)] = int(max(0, round(pred_count_raw)))

        return predictions

    def limpiar_cache(self):
        """Limpia caché de predicciones"""
        self.cache_predicciones = {}
        self._guardar_cache_disco()
        print("✅ Caché limpiado")

    def obtener_metricas(self):
        """Retorna métricas de todos los modelos"""
        if not self.trained:
            raise Exception("Modelos no cargados.")

        metricas = {
            'denuncias': {
                int(t): info['metrics'] for t, info in self.models_den.items()
            },
            'emergencias': {
                int(t): info['metrics'] for t, info in self.models_eme.items()
            }
        }

        return metricas


# Singleton global
_modelo_global = None

def get_modelo():
    """Obtiene instancia singleton del modelo"""
    global _modelo_global
    if _modelo_global is None:
        _modelo_global = ModeloPrediccionIncidencias()
    return _modelo_global


if __name__ == "__main__":
    print("Modo producción - solo carga modelos")
    modelo = ModeloPrediccionIncidencias()
    modelo.cargar_modelos()

    if modelo.trained:
        print("\n✅ Listo para hacer predicciones")
        # Test
        pred = modelo.predecir_mes(2025, 1)
        print(f"\nPredicción ejemplo: {pred}")
    else:
        print("\n⚠️ No se pudieron cargar los modelos")