import pandas as pd
import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler
import math
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

EARTH_R = 6371000.0  # Radio de la Tierra en metros

def haversine_m(lat1, lon1, lat2, lon2):
    """
    Distancia Haversine en metros entre dos puntos.
    Más precisa para distancias cortas.
    """
    # Convertir a radianes
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Diferencias
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    # Fórmula de Haversine
    a = (math.sin(dlat/2)**2 + 
         math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2)
    
    c = 2 * math.asin(math.sqrt(a))
    return EARTH_R * c

def validar_coordenadas(df):
    """Valida y limpia las coordenadas geográficas."""
    coords_invalidas = 0
    
    # Validar rangos de latitud y longitud
    mask_lat = (df['lat'].abs() <= 90) & (df['lat'] != 0)
    mask_lon = (df['lon'].abs() <= 180) & (df['lon'] != 0)
    mask_validas = mask_lat & mask_lon
    
    coords_invalidas = (~mask_validas).sum()
    
    if coords_invalidas > 0:
        logger.warning(f"Se encontraron {coords_invalidas} coordenadas inválidas que serán removidas")
    
    return df[mask_validas].copy()

def calcular_eps_optimo(coords_rad, percentil=90):
    """
    Calcula un eps óptimo basado en la distribución de distancias.
    """
    if len(coords_rad) < 10:
        return 500  # Valor por defecto si hay pocas muestras
    
    # Calcular matriz de distancias de una muestra
    sample_size = min(100, len(coords_rad))
    sample_idx = np.random.choice(len(coords_rad), sample_size, replace=False)
    sample_coords = coords_rad[sample_idx]
    
    distancias = []
    for i in range(len(sample_coords)):
        for j in range(i+1, len(sample_coords)):
            lat1, lon1 = sample_coords[i]
            lat2, lon2 = sample_coords[j]
            # Convertir de radianes a grados para haversine_m
            lat1, lon1 = math.degrees(lat1), math.degrees(lon1)
            lat2, lon2 = math.degrees(lat2), math.degrees(lon2)
            dist = haversine_m(lat1, lon1, lat2, lon2)
            distancias.append(dist)
    
    eps_sugerido = np.percentile(distancias, percentil)
    logger.info(f"EPS sugerido basado en percentil {percentil}: {eps_sugerido:.0f}m")
    return eps_sugerido

def dbscan_incidencias_mejorado(datos, eps_m=None, min_samples=3, auto_eps=True, 
                               incluir_temporal=False, peso_temporal=0.1):
    """
    Aplica DBSCAN espacial (y opcionalmente temporal) a incidencias.
    
    Parámetros:
    -----------
    datos: DataFrame o lista con los datos
    eps_m: radio de vecindad en metros (se calcula automáticamente si es None)
    min_samples: vecinos mínimos para ser núcleo
    auto_eps: si True, calcula eps automáticamente
    incluir_temporal: si incluir dimensión temporal
    peso_temporal: peso de la dimensión temporal (0-1)
    """
    
    # Convertir a DataFrame si es necesario
    if isinstance(datos, list):
        df = pd.DataFrame(datos)
    else:
        df = datos.copy()

    logger.info(f"Procesando {len(df)} registros iniciales")

    # Extraer coordenadas si están en formato 'ubicacion'
    if 'lat' not in df.columns or 'lon' not in df.columns:
        if 'ubicacion' in df.columns:
            try:
                latlon = df['ubicacion'].astype(str).str.split(',', expand=True)
                df['lat'] = pd.to_numeric(latlon[0], errors='coerce')
                df['lon'] = pd.to_numeric(latlon[1], errors='coerce')
                logger.info("Coordenadas extraídas del campo 'ubicacion'")
            except Exception as e:
                logger.error(f"Error extrayendo coordenadas: {e}")
                raise ValueError("No se pudieron extraer las coordenadas")
        else:
            raise ValueError("No se encontraron campos 'lat', 'lon' o 'ubicacion'")

    # Remover registros con coordenadas faltantes
    df_inicial = len(df)
    df = df.dropna(subset=['lat', 'lon']).copy()
    removidos_nan = df_inicial - len(df)
    
    if removidos_nan > 0:
        logger.warning(f"Removidos {removidos_nan} registros con coordenadas faltantes")

    if len(df) == 0:
        logger.error("No quedan registros válidos después de limpiar coordenadas")
        return pd.DataFrame()

    # Validar coordenadas
    df = validar_coordenadas(df)
    
    if len(df) < min_samples:
        logger.warning(f"Solo quedan {len(df)} registros válidos, menos que min_samples={min_samples}")
        df['cluster'] = -1  # Todos son ruido
        return df.reset_index(drop=True)

    # Preparar coordenadas
    coords_deg = df[['lat', 'lon']].to_numpy()
    coords_rad = np.radians(coords_deg)

    # Calcular eps automáticamente si se solicita
    if auto_eps and eps_m is None:
        eps_m = calcular_eps_optimo(coords_rad)
    elif eps_m is None:
        eps_m = 300  # Valor por defecto

    logger.info(f"Usando eps={eps_m}m, min_samples={min_samples}")

    # Preparar datos para clustering
    if incluir_temporal and 'fecha' in df.columns:
        # Clustering espacio-temporal
        try:
            df['timestamp'] = pd.to_datetime(df['fecha'])
            df['timestamp_num'] = df['timestamp'].astype(np.int64) // 10**9  # Segundos desde epoch
            
            # Normalizar coordenadas y tiempo
            scaler_coords = StandardScaler()
            scaler_time = StandardScaler()
            
            coords_norm = scaler_coords.fit_transform(coords_rad)
            time_norm = scaler_time.fit_transform(df[['timestamp_num']])
            
            # Combinar dimensiones
            features = np.hstack([coords_norm, time_norm * peso_temporal])
            
            # Ajustar eps para el espacio normalizado
            eps_norm = eps_m / (6371.0088 * 1000)  # Aproximación
            
            db = DBSCAN(eps=eps_norm, min_samples=min_samples, metric='euclidean')
            logger.info("Aplicando clustering espacio-temporal")
            
        except Exception as e:
            logger.warning(f"Error en clustering temporal, usando solo espacial: {e}")
            incluir_temporal = False

    if not incluir_temporal:
        # Clustering solo espacial
        kms_per_radian = 6371.0088
        eps_rad = eps_m / 1000.0 / kms_per_radian
        
        db = DBSCAN(eps=eps_rad, min_samples=min_samples, metric='haversine')
        features = coords_rad
        logger.info("Aplicando clustering espacial")

    # Aplicar clustering
    try:
        labels = db.fit_predict(features)
    except Exception as e:
        logger.error(f"Error en clustering: {e}")
        raise

    # Asignar resultados
    df['cluster'] = labels
    
    # Estadísticas del clustering
    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    n_noise = list(labels).count(-1)
    
    logger.info(f"Clustering completado:")
    logger.info(f"  - Clusters encontrados: {n_clusters}")
    logger.info(f"  - Puntos de ruido: {n_noise}")
    logger.info(f"  - Puntos agrupados: {len(df) - n_noise}")

    # Agregar estadísticas por cluster
    cluster_stats = []
    for cluster_id in set(labels):
        if cluster_id == -1:
            continue
        cluster_data = df[df['cluster'] == cluster_id]
        
        # Calcular centroide
        centroid_lat = cluster_data['lat'].mean()
        centroid_lon = cluster_data['lon'].mean()
        
        # Calcular dispersión (radio promedio desde centroide)
        dispersions = [haversine_m(row['lat'], row['lon'], centroid_lat, centroid_lon) 
                      for _, row in cluster_data.iterrows()]
        dispersion_avg = np.mean(dispersions)
        
        cluster_stats.append({
            'cluster_id': cluster_id,
            'size': len(cluster_data),
            'centroid_lat': centroid_lat,
            'centroid_lon': centroid_lon,
            'dispersion_avg_m': dispersion_avg
        })
    
    # Ordenar por tamaño de cluster
    cluster_stats.sort(key=lambda x: x['size'], reverse=True)
    
    for stat in cluster_stats:
        logger.info(f"  Cluster {stat['cluster_id']}: {stat['size']} puntos, "
                   f"dispersión promedio: {stat['dispersion_avg_m']:.0f}m")
    
    return df.reset_index(drop=True)

# Función auxiliar para análisis de parámetros
def analizar_parametros_optimos(datos, eps_range=None, min_samples_range=None):
    """
    Analiza diferentes combinaciones de parámetros para encontrar los óptimos.
    """
    if eps_range is None:
        eps_range = [100, 200, 300, 500, 1000]
    if min_samples_range is None:
        min_samples_range = [2, 3, 5, 10]
    
    resultados = []
    
    for eps in eps_range:
        for min_samp in min_samples_range:
            try:
                df_result = dbscan_incidencias_mejorado(
                    datos, eps_m=eps, min_samples=min_samp, auto_eps=False
                )
                
                n_clusters = len(set(df_result['cluster'])) - (1 if -1 in df_result['cluster'].values else 0)
                n_noise = (df_result['cluster'] == -1).sum()
                
                resultados.append({
                    'eps': eps,
                    'min_samples': min_samp,
                    'n_clusters': n_clusters,
                    'n_noise': n_noise,
                    'pct_grouped': (len(df_result) - n_noise) / len(df_result) * 100
                })
            except:
                continue
    
    return pd.DataFrame(resultados).sort_values('pct_grouped', ascending=False)
