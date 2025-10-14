"""
modelo_PREDICCION_ESPACIAL.py
Extensión del modelo LSTM con predicción espacial por cuadrantes
"""

import pandas as pd
import numpy as np
import pickle
import os
from sklearn.cluster import KMeans
from scipy.spatial import cKDTree
import json

# Directorio para datos espaciales
SPATIAL_DIR = 'datos_espaciales'
os.makedirs(SPATIAL_DIR, exist_ok=True)


class PrediccionEspacial:
    """Maneja predicciones espaciales por cuadrantes"""
    
    def __init__(self):
        self.cuadrantes = None
        self.distribuciones_historicas = {}
        self.grid_bounds = None
        self.grid_size = (5, 5)  # 5x5 = 25 cuadrantes por defecto
        self.kdtree = None
        
    def calcular_limites_mapa(self, df):
        """Calcula límites geográficos del mapa"""
        lat_min, lat_max = df['lat'].min(), df['lat'].max()
        lon_min, lon_max = df['lon'].min(), df['lon'].max()
        
        # Añadir margen del 5%
        lat_margin = (lat_max - lat_min) * 0.05
        lon_margin = (lon_max - lon_min) * 0.05
        
        return {
            'lat_min': lat_min - lat_margin,
            'lat_max': lat_max + lat_margin,
            'lon_min': lon_min - lon_margin,
            'lon_max': lon_max + lon_margin
        }
    
    def crear_cuadrantes(self, df, n_filas=5, n_cols=5):
        """
        Divide el mapa en cuadrantes rectangulares
        
        Args:
            df: DataFrame con columnas 'lat', 'lon'
            n_filas: Número de filas en la grilla
            n_cols: Número de columnas en la grilla
        """
        print(f"\n🗺️  Creando grilla de {n_filas}x{n_cols} cuadrantes...")
        
        self.grid_size = (n_filas, n_cols)
        self.grid_bounds = self.calcular_limites_mapa(df)
        
        lat_min = self.grid_bounds['lat_min']
        lat_max = self.grid_bounds['lat_max']
        lon_min = self.grid_bounds['lon_min']
        lon_max = self.grid_bounds['lon_max']
        
        lat_step = (lat_max - lat_min) / n_filas
        lon_step = (lon_max - lon_min) / n_cols
        
        cuadrantes = []
        
        for i in range(n_filas):
            for j in range(n_cols):
                cuadrante = {
                    'id': i * n_cols + j,
                    'fila': i,
                    'columna': j,
                    'lat_min': lat_min + i * lat_step,
                    'lat_max': lat_min + (i + 1) * lat_step,
                    'lon_min': lon_min + j * lon_step,
                    'lon_max': lon_min + (j + 1) * lon_step,
                    'centro_lat': lat_min + (i + 0.5) * lat_step,
                    'centro_lon': lon_min + (j + 0.5) * lon_step
                }
                cuadrantes.append(cuadrante)
        
        self.cuadrantes = pd.DataFrame(cuadrantes)
        
        # Crear KDTree para búsqueda rápida
        centros = self.cuadrantes[['centro_lat', 'centro_lon']].values
        self.kdtree = cKDTree(centros)
        
        print(f"✅ {len(self.cuadrantes)} cuadrantes creados")
        return self.cuadrantes
    
    def asignar_cuadrante(self, lat, lon):
        """Asigna una coordenada al cuadrante más cercano"""
        if self.kdtree is None:
            return None
        
        # Buscar cuadrante más cercano
        _, idx = self.kdtree.query([lat, lon])
        return int(self.cuadrantes.iloc[idx]['id'])
    
    def analizar_distribucion_historica(self, df):
        """
        Analiza la distribución histórica de incidencias por cuadrante
        
        Args:
            df: DataFrame con columnas ['lat', 'lon', 'id_denuncia', 'id_numero_emergencia', 'fecha']
        """
        print("\n📊 Analizando distribución histórica por cuadrante...")
        
        # Asignar cuadrante a cada incidencia
        df['cuadrante_id'] = df.apply(
            lambda row: self.asignar_cuadrante(row['lat'], row['lon']), 
            axis=1
        )
        
        # Análisis de DENUNCIAS por cuadrante
        denuncias = df[df['id_denuncia'].notna()].copy()
        dist_denuncias = (denuncias
                          .groupby(['cuadrante_id', 'id_denuncia'])
                          .size()
                          .reset_index(name='count'))
        
        # Análisis de EMERGENCIAS por cuadrante
        emergencias = df[df['id_numero_emergencia'].notna()].copy()
        dist_emergencias = (emergencias
                            .groupby(['cuadrante_id', 'id_numero_emergencia'])
                            .size()
                            .reset_index(name='count'))
        
        # Calcular distribuciones porcentuales
        self.distribuciones_historicas = {
            'denuncias': {},
            'emergencias': {},
            'totales_cuadrante': {}
        }
        
        # Por cada cuadrante, calcular distribución de tipos
        for cuad_id in self.cuadrantes['id']:
            # DENUNCIAS
            den_cuad = dist_denuncias[dist_denuncias['cuadrante_id'] == cuad_id]
            total_den = den_cuad['count'].sum()
            
            if total_den > 0:
                distribucion_den = {}
                for _, row in den_cuad.iterrows():
                    tipo_id = int(row['id_denuncia'])
                    porcentaje = (row['count'] / total_den) * 100
                    distribucion_den[tipo_id] = {
                        'count': int(row['count']),
                        'porcentaje': round(porcentaje, 2)
                    }
                self.distribuciones_historicas['denuncias'][int(cuad_id)] = distribucion_den
            
            # EMERGENCIAS
            eme_cuad = dist_emergencias[dist_emergencias['cuadrante_id'] == cuad_id]
            total_eme = eme_cuad['count'].sum()
            
            if total_eme > 0:
                distribucion_eme = {}
                for _, row in eme_cuad.iterrows():
                    tipo_id = int(row['id_numero_emergencia'])
                    porcentaje = (row['count'] / total_eme) * 100
                    distribucion_eme[tipo_id] = {
                        'count': int(row['count']),
                        'porcentaje': round(porcentaje, 2)
                    }
                self.distribuciones_historicas['emergencias'][int(cuad_id)] = distribucion_eme
            
            # TOTALES
            self.distribuciones_historicas['totales_cuadrante'][int(cuad_id)] = {
                'denuncias': int(total_den),
                'emergencias': int(total_eme),
                'total': int(total_den + total_eme)
            }
        
        print(f"✅ Distribución histórica calculada para {len(self.cuadrantes)} cuadrantes")
        
        # Guardar en disco
        self.guardar_datos_espaciales()
        
        return self.distribuciones_historicas
    
    def predecir_cuadrantes(self, prediccion_global):
        """
        Distribuye la predicción global entre cuadrantes según patrones históricos
        CONSERVANDO EL TOTAL EXACTO predicho por el modelo LSTM
        
        Args:
            prediccion_global: Dict con 'denuncias' y 'emergencias' del modelo LSTM
                               {'denuncias': {1: 50, 2: 30, ...}, 'emergencias': {...}}
        
        Returns:
            Dict con predicciones por cuadrante
        """
        prediccion_cuadrantes = []
        
        # Calcular totales históricos globales
        total_historico_global_den = sum(
            t.get('denuncias', 0) 
            for t in self.distribuciones_historicas['totales_cuadrante'].values()
        )
        total_historico_global_eme = sum(
            t.get('emergencias', 0) 
            for t in self.distribuciones_historicas['totales_cuadrante'].values()
        )
        
        # Paso 1: Distribuir cada TIPO de incidencia por separado (más preciso)
        # Estructura: {tipo_id: {cuadrante_id: cantidad}}
        distribucion_denuncias_por_tipo = {}
        distribucion_emergencias_por_tipo = {}
        
        # Para cada tipo de DENUNCIA
        for tipo_id, cantidad_total in prediccion_global['denuncias'].items():
            distribucion_denuncias_por_tipo[tipo_id] = {}
            
            # Calcular cuánto de este tipo ocurrió en cada cuadrante históricamente
            totales_tipo_por_cuadrante = {}
            total_tipo = 0
            
            for cuad_id in self.cuadrantes['id']:
                dist_den_hist = self.distribuciones_historicas['denuncias'].get(cuad_id, {})
                count_tipo = dist_den_hist.get(tipo_id, {}).get('count', 0)
                totales_tipo_por_cuadrante[cuad_id] = count_tipo
                total_tipo += count_tipo
            
            # Si hay datos históricos para este tipo, distribuir proporcionalmente
            if total_tipo > 0:
                # Calcular proporciones exactas (sin redondear aún)
                proporciones = {}
                for cuad_id, count in totales_tipo_por_cuadrante.items():
                    proporciones[cuad_id] = (count / total_tipo) * cantidad_total
                
                # Redondear y ajustar para que sumen exactamente cantidad_total
                asignados = {cuad_id: int(prop) for cuad_id, prop in proporciones.items()}
                total_asignado = sum(asignados.values())
                diferencia = cantidad_total - total_asignado
                
                # Distribuir la diferencia a los cuadrantes con mayor residuo
                if diferencia != 0:
                    residuos = {cuad_id: proporciones[cuad_id] - asignados[cuad_id] 
                               for cuad_id in proporciones.keys()}
                    cuadrantes_ordenados = sorted(residuos.items(), key=lambda x: x[1], reverse=True)
                    
                    for i in range(abs(diferencia)):
                        cuad_id = cuadrantes_ordenados[i % len(cuadrantes_ordenados)][0]
                        asignados[cuad_id] += 1 if diferencia > 0 else -1
                
                distribucion_denuncias_por_tipo[tipo_id] = asignados
            else:
                # Si no hay datos históricos, distribuir uniformemente
                cantidad_por_cuadrante = cantidad_total // len(self.cuadrantes)
                resto = cantidad_total % len(self.cuadrantes)
                
                for idx, cuad_id in enumerate(self.cuadrantes['id']):
                    distribucion_denuncias_por_tipo[tipo_id][cuad_id] = cantidad_por_cuadrante + (1 if idx < resto else 0)
        
        # Para cada tipo de EMERGENCIA (mismo proceso)
        for tipo_id, cantidad_total in prediccion_global['emergencias'].items():
            distribucion_emergencias_por_tipo[tipo_id] = {}
            
            totales_tipo_por_cuadrante = {}
            total_tipo = 0
            
            for cuad_id in self.cuadrantes['id']:
                dist_eme_hist = self.distribuciones_historicas['emergencias'].get(cuad_id, {})
                count_tipo = dist_eme_hist.get(tipo_id, {}).get('count', 0)
                totales_tipo_por_cuadrante[cuad_id] = count_tipo
                total_tipo += count_tipo
            
            if total_tipo > 0:
                proporciones = {}
                for cuad_id, count in totales_tipo_por_cuadrante.items():
                    proporciones[cuad_id] = (count / total_tipo) * cantidad_total
                
                asignados = {cuad_id: int(prop) for cuad_id, prop in proporciones.items()}
                total_asignado = sum(asignados.values())
                diferencia = cantidad_total - total_asignado
                
                if diferencia != 0:
                    residuos = {cuad_id: proporciones[cuad_id] - asignados[cuad_id] 
                               for cuad_id in proporciones.keys()}
                    cuadrantes_ordenados = sorted(residuos.items(), key=lambda x: x[1], reverse=True)
                    
                    for i in range(abs(diferencia)):
                        cuad_id = cuadrantes_ordenados[i % len(cuadrantes_ordenados)][0]
                        asignados[cuad_id] += 1 if diferencia > 0 else -1
                
                distribucion_emergencias_por_tipo[tipo_id] = asignados
            else:
                cantidad_por_cuadrante = cantidad_total // len(self.cuadrantes)
                resto = cantidad_total % len(self.cuadrantes)
                
                for idx, cuad_id in enumerate(self.cuadrantes['id']):
                    distribucion_emergencias_por_tipo[tipo_id][cuad_id] = cantidad_por_cuadrante + (1 if idx < resto else 0)
        
        # Paso 2: Consolidar por cuadrante
        for _, cuad in self.cuadrantes.iterrows():
            cuad_id = int(cuad['id'])
            
            # Obtener distribución histórica
            dist_den_hist = self.distribuciones_historicas['denuncias'].get(cuad_id, {})
            dist_eme_hist = self.distribuciones_historicas['emergencias'].get(cuad_id, {})
            totales = self.distribuciones_historicas['totales_cuadrante'].get(cuad_id, {})
            
            # Consolidar denuncias para este cuadrante
            pred_denuncias = {}
            for tipo_id, distribucion in distribucion_denuncias_por_tipo.items():
                cantidad = distribucion.get(cuad_id, 0)
                if cantidad > 0:
                    pred_denuncias[int(tipo_id)] = cantidad
            
            # Consolidar emergencias para este cuadrante
            pred_emergencias = {}
            for tipo_id, distribucion in distribucion_emergencias_por_tipo.items():
                cantidad = distribucion.get(cuad_id, 0)
                if cantidad > 0:
                    pred_emergencias[int(tipo_id)] = cantidad
            
            # Identificar tipo dominante (el más frecuente histórico)
            tipo_dominante_den = None
            tipo_dominante_eme = None
            
            if dist_den_hist:
                tipo_dominante_den = max(dist_den_hist.items(), key=lambda x: x[1]['porcentaje'])
                tipo_dominante_den = {
                    'tipo_id': int(tipo_dominante_den[0]),
                    'porcentaje_historico': tipo_dominante_den[1]['porcentaje']
                }
            
            if dist_eme_hist:
                tipo_dominante_eme = max(dist_eme_hist.items(), key=lambda x: x[1]['porcentaje'])
                tipo_dominante_eme = {
                    'tipo_id': int(tipo_dominante_eme[0]),
                    'porcentaje_historico': tipo_dominante_eme[1]['porcentaje']
                }
            
            # Nivel de criticidad (basado en cantidad de incidencias)
            total_predicho = sum(pred_denuncias.values()) + sum(pred_emergencias.values())
            if total_predicho >= 50:
                nivel_criticidad = 'alto'
                color = '#d32f2f'
            elif total_predicho >= 20:
                nivel_criticidad = 'medio'
                color = '#f57c00'
            elif total_predicho >= 5:
                nivel_criticidad = 'bajo'
                color = '#fbc02d'
            else:
                nivel_criticidad = 'muy_bajo'
                color = '#388e3c'
            
            prediccion_cuadrantes.append({
                'cuadrante_id': cuad_id,
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
                'prediccion': {
                    'denuncias': pred_denuncias,
                    'emergencias': pred_emergencias,
                    'total': total_predicho
                },
                'tipo_dominante': {
                    'denuncia': tipo_dominante_den,
                    'emergencia': tipo_dominante_eme
                },
                'nivel_criticidad': nivel_criticidad,
                'color': color,
                'historico': {
                    'total_denuncias': totales.get('denuncias', 0),
                    'total_emergencias': totales.get('emergencias', 0)
                }
            })
        
        # Verificación: Imprimir totales para debug
        total_den_distribuido = sum(sum(c['prediccion']['denuncias'].values()) for c in prediccion_cuadrantes)
        total_eme_distribuido = sum(sum(c['prediccion']['emergencias'].values()) for c in prediccion_cuadrantes)
        total_den_original = sum(prediccion_global['denuncias'].values())
        total_eme_original = sum(prediccion_global['emergencias'].values())
        
        print(f"\n✅ Validación de distribución:")
        print(f"   Denuncias - Original: {total_den_original}, Distribuido: {total_den_distribuido}, Diferencia: {total_den_original - total_den_distribuido}")
        print(f"   Emergencias - Original: {total_eme_original}, Distribuido: {total_eme_distribuido}, Diferencia: {total_eme_original - total_eme_distribuido}")
        
        return prediccion_cuadrantes
    
    def guardar_datos_espaciales(self):
        """Guarda cuadrantes y distribuciones en disco"""
        # Guardar cuadrantes
        self.cuadrantes.to_pickle(f'{SPATIAL_DIR}/cuadrantes.pkl')
        
        # Guardar distribuciones
        with open(f'{SPATIAL_DIR}/distribuciones_historicas.pkl', 'wb') as f:
            pickle.dump(self.distribuciones_historicas, f)
        
        # Guardar grid_bounds
        with open(f'{SPATIAL_DIR}/grid_bounds.json', 'w') as f:
            json.dump(self.grid_bounds, f)
        
        print(f"✅ Datos espaciales guardados en {SPATIAL_DIR}/")
    
    def cargar_datos_espaciales(self):
        """Carga cuadrantes y distribuciones desde disco"""
        cuad_path = f'{SPATIAL_DIR}/cuadrantes.pkl'
        dist_path = f'{SPATIAL_DIR}/distribuciones_historicas.pkl'
        bounds_path = f'{SPATIAL_DIR}/grid_bounds.json'
        
        if not all([os.path.exists(p) for p in [cuad_path, dist_path, bounds_path]]):
            raise FileNotFoundError("No se encontraron datos espaciales. Ejecuta analizar_distribucion_historica() primero.")
        
        self.cuadrantes = pd.read_pickle(cuad_path)
        
        with open(dist_path, 'rb') as f:
            self.distribuciones_historicas = pickle.load(f)
        
        with open(bounds_path, 'r') as f:
            self.grid_bounds = json.load(f)
        
        # Recrear KDTree
        centros = self.cuadrantes[['centro_lat', 'centro_lon']].values
        self.kdtree = cKDTree(centros)
        
        print(f"✅ Datos espaciales cargados: {len(self.cuadrantes)} cuadrantes")


# Función de inicialización
def entrenar_modelo_espacial(csv_path='data_modelo/dataset_incidencias_reque_2015_2024.csv', 
                              n_filas=15, n_cols=15):
    """
    Entrena el modelo espacial con datos históricos
    
    Args:
        csv_path: Ruta al CSV con datos históricos
        n_filas: Número de filas en la grilla
        n_cols: Número de columnas en la grilla
    """
    print("="*70)
    print("ENTRENAMIENTO DE MODELO ESPACIAL")
    print("="*70)
    
    # Cargar datos
    df = pd.read_csv(csv_path, parse_dates=['fecha'])
    
    # Convertir tipos
    for col in ["id_numero_emergencia", "id_denuncia"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").astype("Int64")
    
    print(f"\n📂 Datos cargados: {len(df)} incidencias")
    print(f"   Rango temporal: {df['fecha'].min()} a {df['fecha'].max()}")
    print(f"   Rango geográfico: lat [{df['lat'].min():.4f}, {df['lat'].max():.4f}]")
    print(f"                    lon [{df['lon'].min():.4f}, {df['lon'].max():.4f}]")
    
    # Crear modelo espacial
    modelo_espacial = PrediccionEspacial()
    
    # Crear cuadrantes
    modelo_espacial.crear_cuadrantes(df, n_filas, n_cols)
    
    # Analizar distribución histórica
    modelo_espacial.analizar_distribucion_historica(df)
    
    print("\n✅ Modelo espacial entrenado exitosamente")
    
    return modelo_espacial


# Singleton global
_modelo_espacial_global = None

def get_modelo_espacial():
    """Obtiene instancia singleton del modelo espacial"""
    global _modelo_espacial_global
    if _modelo_espacial_global is None:
        _modelo_espacial_global = PrediccionEspacial()
        try:
            _modelo_espacial_global.cargar_datos_espaciales()
        except FileNotFoundError:
            print("⚠️  No hay modelo espacial guardado. Se necesita entrenar primero.")
    return _modelo_espacial_global


if __name__ == "__main__":
    # Ejemplo de uso
    modelo = entrenar_modelo_espacial(
        csv_path='data_modelo/dataset_incidencias_reque_2015_2024.csv',
        n_filas=5,
        n_cols=5
    )
    
    print("\n📊 Ejemplo de distribución en cuadrante 0:")
    print(json.dumps(modelo.distribuciones_historicas['denuncias'].get(0, {}), indent=2))