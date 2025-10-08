"""
modelo_PREDICCION_OPTIMIZADO.py
Versión optimizada con caché y predicciones batch
"""

import pandas as pd
import numpy as np
import pickle
import os
from sklearn.preprocessing import RobustScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error
import tensorflow as tf
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense, Dropout, Bidirectional
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
from tensorflow.keras.regularizers import l2
from functools import lru_cache
import hashlib
import json

# Configuración de reproducibilidad
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)
tf.random.set_seed(RANDOM_SEED)

# Rutas de archivos
MODEL_DIR = 'modelos_entrenados'
DATA_DIR = 'datos_procesados'
CACHE_DIR = 'cache_predicciones'


class ModeloPrediccionIncidencias:
    """Clase optimizada para predicción de incidencias"""
    
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
            print(f"⚠️  Error guardando caché: {e}")
    
    def _get_cache_key(self, year, month, tipo_id, tipo_modelo):
        """Genera clave única para caché"""
        return f"{tipo_modelo}_{tipo_id}_{year}_{month:02d}"
    
    def build_monthly_series(self, df_in, col_id):
        """Construye serie temporal mensual con features temporales"""
        ts = (df_in
              .loc[df_in[col_id].notna()]
              .assign(year=lambda x: x.fecha.dt.year,
                      month=lambda x: x.fecha.dt.month)
              .groupby(['year', 'month', col_id])
              .size()
              .reset_index(name='count'))
        
        years = ts['year'].unique()
        months = range(1, 13)
        tipos = ts[col_id].unique()
        
        full = (ts
                .set_index(['year', 'month', col_id])
                .reindex(pd.MultiIndex.from_product(
                    [years, months, tipos],
                    names=['year', 'month', col_id]), fill_value=0)
                .reset_index())
        
        # Features temporales
        full['sin_m'] = np.sin(2 * np.pi * full.month / 12)
        full['cos_m'] = np.cos(2 * np.pi * full.month / 12)
        full['sin_q'] = np.sin(2 * np.pi * full.month / 3)
        full['cos_q'] = np.cos(2 * np.pi * full.month / 3)
        full['trend'] = np.arange(len(full))
        full['month_idx'] = full['month']
        
        return full.sort_values(['year', 'month', col_id]).reset_index(drop=True)
    
    def make_lstm_dataset(self, df_in, lookback=6):
        """Prepara dataset para LSTM"""
        feat = ['sin_m', 'cos_m', 'sin_q', 'cos_q', 'trend', 'month_idx', 'count']
        df = df_in[feat].copy()
        
        scalers = {c: RobustScaler() for c in feat}
        for c in feat:
            df[c] = scalers[c].fit_transform(df[[c]])
        
        X, y = [], []
        for i in range(lookback, len(df)):
            X.append(df.iloc[i-lookback:i].values)
            y.append(df.iloc[i]['count'])
        
        return np.array(X), np.array(y), scalers
    
    def train_model_per_type(self, df_month, tipo_id, lookback=6, epochs=300):
        """Entrena modelo LSTM para un tipo específico"""
        col_tipo = df_month.columns[2]
        sub = df_month[df_month[col_tipo] == tipo_id].copy()
        
        if len(sub) < lookback + 12:
            print(f"⚠️  Tipo {tipo_id}: Datos insuficientes ({len(sub)} meses)")
            return None
        
        X, y, scalers = self.make_lstm_dataset(sub, lookback)
        
        split_idx = int(len(X) * 0.8)
        X_train, X_test = X[:split_idx], X[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]
        
        # Arquitectura del modelo
        model = Sequential([
            Bidirectional(LSTM(64, return_sequences=True, 
                              kernel_regularizer=l2(0.001)), 
                         input_shape=(lookback, X.shape[-1])),
            Dropout(0.3),
            Bidirectional(LSTM(32, return_sequences=False,
                              kernel_regularizer=l2(0.001))),
            Dropout(0.3),
            Dense(16, activation='relu', kernel_regularizer=l2(0.001)),
            Dropout(0.2),
            Dense(1, activation='linear')
        ])
        
        optimizer = tf.keras.optimizers.Adam(learning_rate=0.001)
        model.compile(optimizer=optimizer, loss='huber', metrics=['mae'])
        
        callbacks = [
            EarlyStopping(monitor='val_loss', patience=30, 
                         restore_best_weights=True, min_delta=0.001),
            ReduceLROnPlateau(monitor='val_loss', patience=10, 
                             factor=0.5, min_lr=1e-6, verbose=0)
        ]
        
        history = model.fit(
            X_train, y_train,
            validation_data=(X_test, y_test),
            epochs=epochs,
            batch_size=4,
            callbacks=callbacks,
            verbose=0
        )
        
        # Evaluación
        y_pred = model.predict(X_test, verbose=0)
        y_pred_res = scalers['count'].inverse_transform(y_pred).ravel()
        y_test_res = scalers['count'].inverse_transform(y_test.reshape(-1, 1)).ravel()
        y_pred_res = np.maximum(0, y_pred_res)
        
        mae = mean_absolute_error(y_test_res, y_pred_res)
        rmse = np.sqrt(mean_squared_error(y_test_res, y_pred_res))

        print(f"Tipo {int(tipo_id):2d}  →  MAE: {mae:5.1f}  |  RMSE: {rmse:5.1f}")

        return {
            'model': model,
            'scalers': scalers,
            'lookback': lookback,
            'metrics': {'mae': mae, 'rmse': rmse}
        }
    
    def entrenar_modelos(self, csv_path='data_modelo/dataset_incidencias_reque_2015_2024.csv'):
        """Entrena todos los modelos y guarda en disco"""
        print("="*70)
        print("INICIANDO ENTRENAMIENTO DE MODELOS")
        print("="*70)
        
        # Cargar datos
        df = pd.read_csv(csv_path, parse_dates=['fecha'])
        
        for col in ["id_numero_emergencia", "id_denuncia"]:
            df[col] = pd.to_numeric(df[col], errors="coerce").astype("Int64")
        
        # Construir series mensuales
        self.den_monthly = self.build_monthly_series(df, 'id_denuncia')
        self.eme_monthly = self.build_monthly_series(df, 'id_numero_emergencia')
        
        print(f"\nDenuncias: {len(self.den_monthly)} registros, {self.den_monthly['id_denuncia'].nunique()} tipos")
        print(f"Emergencias: {len(self.eme_monthly)} registros, {self.eme_monthly['id_numero_emergencia'].nunique()} tipos")
        
        # Entrenar denuncias
        print("\n" + "="*70)
        print("ENTRENANDO MODELOS - DENUNCIAS")
        print("="*70)
        tipos_den = sorted(self.den_monthly['id_denuncia'].unique())
        for t in tipos_den:
            result = self.train_model_per_type(self.den_monthly, t)
            if result:
                self.models_den[t] = result
        
        # Entrenar emergencias
        print("\n" + "="*70)
        print("ENTRENANDO MODELOS - EMERGENCIAS")
        print("="*70)
        tipos_eme = sorted(self.eme_monthly['id_numero_emergencia'].unique())
        for t in tipos_eme:
            result = self.train_model_per_type(self.eme_monthly, t)
            if result:
                self.models_eme[t] = result
        
        self.trained = True
        
        # Guardar modelos
        self.guardar_modelos()
        
        # Limpiar caché al reentrenar
        self.cache_predicciones = {}
        self._guardar_cache_disco()
        
        print("\n✅ Modelos entrenados y guardados exitosamente")
    
    def guardar_modelos(self):
        """Guarda modelos y datos en disco"""
        # Guardar modelos de keras
        for tipo_id, info in self.models_den.items():
            info['model'].save(f'{MODEL_DIR}/den_tipo_{tipo_id}.keras')
        
        for tipo_id, info in self.models_eme.items():
            info['model'].save(f'{MODEL_DIR}/eme_tipo_{tipo_id}.keras')
        
        # Guardar scalers y metadata
        metadata = {
            'den_scalers': {t: info['scalers'] for t, info in self.models_den.items()},
            'eme_scalers': {t: info['scalers'] for t, info in self.models_eme.items()},
            'den_lookback': {t: info['lookback'] for t, info in self.models_den.items()},
            'eme_lookback': {t: info['lookback'] for t, info in self.models_eme.items()},
            'den_metrics': {t: info['metrics'] for t, info in self.models_den.items()},
            'eme_metrics': {t: info['metrics'] for t, info in self.models_eme.items()},
        }
        
        with open(f'{MODEL_DIR}/metadata.pkl', 'wb') as f:
            pickle.dump(metadata, f)
        
        # Guardar datos mensuales
        self.den_monthly.to_pickle(f'{DATA_DIR}/den_monthly.pkl')
        self.eme_monthly.to_pickle(f'{DATA_DIR}/eme_monthly.pkl')
    
    def cargar_modelos(self):
        """Carga modelos desde disco"""
        if not os.path.exists(f'{MODEL_DIR}/metadata.pkl'):
            raise FileNotFoundError("No se encontraron modelos entrenados. Ejecuta entrenar_modelos() primero.")
        
        print("Cargando modelos desde disco...")
        
        # Cargar metadata
        with open(f'{MODEL_DIR}/metadata.pkl', 'rb') as f:
            metadata = pickle.load(f)
        
        # Cargar modelos de denuncias
        for tipo_id in metadata['den_scalers'].keys():
            model_path = f'{MODEL_DIR}/den_tipo_{tipo_id}.keras'
            if os.path.exists(model_path):
                self.models_den[tipo_id] = {
                    'model': load_model(model_path),
                    'scalers': metadata['den_scalers'][tipo_id],
                    'lookback': metadata['den_lookback'][tipo_id],
                    'metrics': metadata['den_metrics'][tipo_id]
                }
        
        # Cargar modelos de emergencias
        for tipo_id in metadata['eme_scalers'].keys():
            model_path = f'{MODEL_DIR}/eme_tipo_{tipo_id}.keras'
            if os.path.exists(model_path):
                self.models_eme[tipo_id] = {
                    'model': load_model(model_path),
                    'scalers': metadata['eme_scalers'][tipo_id],
                    'lookback': metadata['eme_lookback'][tipo_id],
                    'metrics': metadata['eme_metrics'][tipo_id]
                }
        
        # Cargar datos mensuales
        self.den_monthly = pd.read_pickle(f'{DATA_DIR}/den_monthly.pkl')
        self.eme_monthly = pd.read_pickle(f'{DATA_DIR}/eme_monthly.pkl')
        
        self.trained = True
        print(f"✅ Modelos cargados: {len(self.models_den)} denuncias, {len(self.models_eme)} emergencias")
    
    def predecir_mes(self, year, month, tipo=None):
        """
        Predice incidencias para un mes específico (CON CACHÉ)
        """
        if not self.trained:
            raise Exception("Modelos no entrenados. Ejecuta entrenar_modelos() o cargar_modelos() primero.")
        
        # Calcular steps
        last_year_den = self.den_monthly['year'].max()
        last_month_den = self.den_monthly['month'].max()
        
        steps = (year - last_year_den) * 12 + (month - last_month_den)
        
        if steps <= 0:
            raise ValueError(f"El mes {year}-{month:02d} ya está en los datos históricos o es anterior.")
        
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
        """
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
            
            # Predecir iterativamente (PERO guardando en caché cada paso)
            for pred_year, pred_month in months_needed:
                # Verificar si este mes intermedio ya está cacheado
                inter_cache_key = self._get_cache_key(pred_year, pred_month, tipo_id, tipo_modelo)
                
                if inter_cache_key in self.cache_predicciones:
                    # Usar predicción cacheada
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
                    
                    # Guardar en caché (YA COMO ENTERO)
                    self.cache_predicciones[inter_cache_key] = pred_count_raw
                
                # Agregar a temp_data
                temp_data.append({
                    'year': pred_year,
                    'month': pred_month,
                    'sin_m': sin_m_raw if pred_year == target_year and pred_month == target_month else np.sin(2 * np.pi * pred_month / 12),
                    'cos_m': cos_m_raw if pred_year == target_year and pred_month == target_month else np.cos(2 * np.pi * pred_month / 12),
                    'sin_q': sin_q_raw if pred_year == target_year and pred_month == target_month else np.sin(2 * np.pi * pred_month / 3),
                    'cos_q': cos_q_raw if pred_year == target_year and pred_month == target_month else np.cos(2 * np.pi * pred_month / 3),
                    'trend': trend_raw if pred_year == target_year and pred_month == target_month else len(temp_data),
                    'month_idx': month_idx_raw if pred_year == target_year and pred_month == target_month else pred_month,
                    'count': pred_count_raw
                })
                
                # Si llegamos al mes objetivo, guardar resultado
                if pred_year == target_year and pred_month == target_month:
                    predictions[int(tipo_id)] = int(max(0, round(pred_count_raw)))
        
        # NO guardar aquí, se guarda en predecir_mes()
        
        return predictions
    
    def limpiar_cache(self):
        """Limpia caché de predicciones"""
        self.cache_predicciones = {}
        self._guardar_cache_disco()
        print("✅ Caché limpiado")
    
    def obtener_metricas(self):
        """Retorna métricas de todos los modelos"""
        if not self.trained:
            raise Exception("Modelos no entrenados.")
        
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
        try:
            _modelo_global.cargar_modelos()
        except FileNotFoundError:
            print("No hay modelos guardados. Se necesita entrenar primero.")
    return _modelo_global


if __name__ == "__main__":
    print("Entrenando modelos...")
    modelo = ModeloPrediccionIncidencias()
    modelo.entrenar_modelos('data_modelo/dataset_incidencias_reque_2015_2024.csv')
    print("\n✅ Proceso completado")