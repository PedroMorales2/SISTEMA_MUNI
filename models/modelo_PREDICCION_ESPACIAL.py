# models/modelo_PREDICCION_ESPACIAL.py

import json
import os
import pandas as pd
from shapely.geometry import Point, Polygon
from config import get_config
import pickle
import hashlib
from datetime import datetime

config = get_config()

class ModeloPrediccionEspacial:
    """
    Modelo de Predicción Espacial por Sectores
    
    Incluye predicción y análisis histórico por TIPOS de denuncias y emergencias.
    """
    
    def __init__(self):
        self.sectores = []
        self.densidad_historica = {}
        self.sectores_con_data = []
        self.estadisticas_historicas = {}
        self.tipos_denuncias = config.DENUNCIAS_MAP  # Desde config
        self.tipos_emergencias = config.EMERGENCIAS_MAP  # Desde config
        self.dataset_path = "data_modelo/dataset_incidencias_reque_2015_2024.csv"
        
        # ✅ Configuración de caché
        self.cache_dir = 'cache_espacial'
        self.cache_file = os.path.join(self.cache_dir, 'historico_sectores.pkl')
        self.cache_hash_file = os.path.join(self.cache_dir, 'sectores_hash.txt')
        
        # Crear directorio de caché si no existe
        os.makedirs(self.cache_dir, exist_ok=True)
        
        self.cargar_sectores()
    
    
    
    def _calcular_hash_sectores(self):
        """
        Calcula hash único de los sectores actuales para detectar cambios
        """
        sectores_str = json.dumps([
            {
                'id': s['id_sector'],
                'codigo': s['codigo_sector'],
                'bounds': s['bounds']
            }
            for s in self.sectores
        ], sort_keys=True)
        
        return hashlib.md5(sectores_str.encode()).hexdigest()
    
    
    def _cache_es_valido(self):
        """
        Verifica si el caché es válido comparando hash de sectores
        """
        if not os.path.exists(self.cache_file):
            print("📦 No existe caché previo")
            return False
        
        if not os.path.exists(self.cache_hash_file):
            print("📦 No existe hash de caché")
            return False
        
        try:
            # Leer hash guardado
            with open(self.cache_hash_file, 'r') as f:
                hash_guardado = f.read().strip()
            
            # Calcular hash actual
            hash_actual = self._calcular_hash_sectores()
            
            if hash_guardado != hash_actual:
                print("📦 Los sectores han cambiado, caché inválido")
                return False
            
            # Verificar antigüedad del caché (opcional: 7 días)
            cache_mtime = os.path.getmtime(self.cache_file)
            dias_antiguedad = (datetime.now().timestamp() - cache_mtime) / 86400
            
            if dias_antiguedad > 7:
                print(f"📦 Caché tiene {dias_antiguedad:.1f} días, se recalculará")
                return False
            
            print(f"✅ Caché válido (antigüedad: {dias_antiguedad:.1f} días)")
            return True
            
        except Exception as e:
            print(f"⚠️ Error verificando caché: {e}")
            return False
    
    
    def cargar_cache_historico(self):
        """
        Carga histórico desde caché si es válido
        """
        try:
            if not self._cache_es_valido():
                return False
            
            print("📦 Cargando histórico desde caché...")
            
            with open(self.cache_file, 'rb') as f:
                cache_data = pickle.load(f)
            
            self.densidad_historica = cache_data['densidad_historica']
            self.sectores_con_data = cache_data['sectores_con_data']
            self.estadisticas_historicas = cache_data['estadisticas_historicas']
            
            print(f"✅ Caché cargado: {len(self.sectores_con_data)} sectores con data")
            return True
            
        except Exception as e:
            print(f"❌ Error cargando caché: {e}")
            return False
    
    
    def guardar_cache_historico(self):
        """
        Guarda histórico en caché
        """
        try:
            print("\n💾 Guardando histórico en caché...")
            
            cache_data = {
                'densidad_historica': self.densidad_historica,
                'sectores_con_data': self.sectores_con_data,
                'estadisticas_historicas': self.estadisticas_historicas,
                'fecha_calculo': datetime.now().isoformat()
            }
            
            # Guardar datos
            with open(self.cache_file, 'wb') as f:
                pickle.dump(cache_data, f)
            
            # Guardar hash
            hash_actual = self._calcular_hash_sectores()
            with open(self.cache_hash_file, 'w') as f:
                f.write(hash_actual)
            
            size_mb = os.path.getsize(self.cache_file) / 1024 / 1024
            print(f"✅ Caché guardado ({size_mb:.2f} MB)")
            
        except Exception as e:
            print(f"❌ Error guardando caché: {e}")
    
    
    def invalidar_cache(self):
        """
        Elimina el caché para forzar recalculo
        """
        try:
            if os.path.exists(self.cache_file):
                os.remove(self.cache_file)
                print("🗑️ Caché eliminado")
            
            if os.path.exists(self.cache_hash_file):
                os.remove(self.cache_hash_file)
                print("🗑️ Hash de caché eliminado")
            
            return True
            
        except Exception as e:
            print(f"❌ Error eliminando caché: {e}")
            return False
        
        
    
    def calcular_historico_sector_individual(self, id_sector):
        """
        Calcula el histórico SOLO de un sector específico y lo agrega al caché existente.
        Útil cuando se crea un nuevo sector para evitar recalcular todo.
        """
        try:
            print(f"\n🔄 Calculando histórico para sector ID: {id_sector}")
            
            # Buscar el sector en la lista cargada
            sector = None
            for s in self.sectores:
                if s['id_sector'] == id_sector:
                    sector = s
                    break
            
            if not sector:
                print(f"❌ Sector {id_sector} no encontrado")
                return False
            
            # Verificar que tengamos dataset
            if not os.path.exists(self.dataset_path):
                print(f"⚠️ Dataset no encontrado: {self.dataset_path}")
                self._inicializar_estadisticas_vacias(id_sector)
                return True
            
            # Cargar dataset
            print(f"📊 Cargando dataset desde {self.dataset_path}...")
            df = pd.read_csv(self.dataset_path)
            
            # Filtrar datos dentro del sector
            datos_sector = []
            poligono = sector.get('poligono_shapely') or sector.get('poligono_obj')
            
            if poligono:
                print("📊 Columnas del DataFrame:", df.columns.tolist())

                for _, row in df.iterrows():
                    punto = Point(row['lon'], row['lat'])
                    if poligono.contains(punto):
                        datos_sector.append(row)
            
            if not datos_sector:
                print(f"   ⚠️ Sin datos históricos para sector {sector['codigo_sector']}")
                self._inicializar_estadisticas_vacias(id_sector)
                self.densidad_historica[id_sector] = 0.0
                return True
            
            # Convertir a DataFrame
            df_sector = pd.DataFrame(datos_sector)
            total_sector = len(df_sector)
            
            # --- Denuncias ---
            denuncias_df = df_sector[df_sector['id_tipo_incidencia'] == 1]
            denuncias_por_tipo = {}
            if not denuncias_df.empty and 'id_denuncia' in denuncias_df.columns:
                conteo = denuncias_df.groupby('id_denuncia').size().to_dict()
                for tipo_id, count in conteo.items():
                    tipo_id_int = int(tipo_id)
                    tipo_nombre = self.tipos_denuncias.get(tipo_id_int)
                    if tipo_nombre:  # Solo agregar si existe en el mapa
                        denuncias_por_tipo[tipo_nombre] = int(count)

            # --- Emergencias ---
            emergencias_df = df_sector[df_sector['id_tipo_incidencia'] == 2]
            emergencias_por_tipo = {}
            if not emergencias_df.empty and 'id_numero_emergencia' in emergencias_df.columns:
                conteo = emergencias_df.groupby('id_numero_emergencia').size().to_dict()
                for tipo_id, count in conteo.items():
                    tipo_id_int = int(tipo_id)
                    tipo_nombre = self.tipos_emergencias.get(tipo_id_int)
                    if tipo_nombre:  # Solo agregar si existe en el mapa
                        emergencias_por_tipo[tipo_nombre] = int(count)

            
            nivel_info = self._calcular_nivel_criticidad(total_sector)
            
            # Guardar estadísticas del sector
            self.estadisticas_historicas[id_sector] = {
                'total': total_sector,
                'denuncias': len(denuncias_df),
                'emergencias': len(emergencias_df),
                'denuncias_por_tipo': denuncias_por_tipo,
                'emergencias_por_tipo': emergencias_por_tipo,
                'nivel': nivel_info['nivel'],
                'color': nivel_info['color']
            }
            
            # Calcular densidad (necesitamos el total global para esto)
            total_incidencias_global = len(df)
            self.densidad_historica[id_sector] = total_sector / total_incidencias_global if total_incidencias_global > 0 else 0.0
            
            # Agregar a lista de sectores con data si tiene datos
            if id_sector not in self.sectores_con_data:
                self.sectores_con_data.append(id_sector)
            
            print(f"✅ Histórico calculado para {sector['codigo_sector']}: {total_sector} incidencias")
            
            # Guardar caché actualizado
            self.guardar_cache_historico()
            
            return True
            
        except Exception as e:
            print(f"❌ Error calculando histórico individual: {e}")
            import traceback
            traceback.print_exc()
            return False
        
        
    def cargar_sectores(self):
        """Carga sectores activos desde BD"""
        try:
            from utils.database import obtenerconexion as obtener_conexion
            
            conexion = obtener_conexion()
            cursor = conexion.cursor()
            
            sql = """
                SELECT 
                    id_sector, codigo_sector, nombre,
                    lat_min, lat_max, lon_min, lon_max,
                    centro_lat, centro_lon, poligono_geojson
                FROM sectores
                WHERE activo = TRUE
                ORDER BY codigo_sector
            """
            
            cursor.execute(sql)
            resultados = cursor.fetchall()
            
            self.sectores = []
            for row in resultados:
                poligono_json = json.loads(row['poligono_geojson']) if row['poligono_geojson'] else None
                
                poligono_shapely = None
                if poligono_json:
                    try:
                        coords = poligono_json['geometry']['coordinates'][0]
                        poligono_shapely = Polygon([(c[0], c[1]) for c in coords])
                    except Exception as e:
                        print(f"⚠️ Error en polígono {row['codigo_sector']}: {e}")
                
                sector = {
                    'id_sector': row['id_sector'],
                    'codigo_sector': row['codigo_sector'],
                    'nombre': row['nombre'],
                    'bounds': {
                        'lat_min': float(row['lat_min']),
                        'lat_max': float(row['lat_max']),
                        'lon_min': float(row['lon_min']),
                        'lon_max': float(row['lon_max'])
                    },
                    'centro': {
                        'lat': float(row['centro_lat']) if row['centro_lat'] else 0,
                        'lon': float(row['centro_lon']) if row['centro_lon'] else 0
                    },
                    'poligono': poligono_json,
                    'poligono_shapely': poligono_shapely
                }
                self.sectores.append(sector)
            
            cursor.close()
            conexion.close()
            
            print(f"✅ {len(self.sectores)} sectores cargados")
            
        except Exception as e:
            print(f"❌ Error cargando sectores: {str(e)}")
            import traceback
            traceback.print_exc()
            self.sectores = []
    
    
    def calcular_densidad_historica(self, forzar_recalculo=False):
        """
        Calcula densidad histórica con sistema de caché inteligente
        """
        # ✅ Intentar cargar desde caché
        if not forzar_recalculo:
            if self.cargar_cache_historico():
                return self.densidad_historica
        
        # Si no hay caché válido, calcular desde cero
        try:
            if not self.sectores:
                print("⚠️ No hay sectores definidos")
                return {}
            
            if not os.path.exists(self.dataset_path):
                print(f"⚠️ Dataset no encontrado: {self.dataset_path}")
                return {}
            
            print(f"\n📂 Analizando dataset: {self.dataset_path}")
            df = pd.read_csv(self.dataset_path)
            
            # Filtrar válidos
            df_coords = df[
                (df['lat'].notna()) & 
                (df['lon'].notna())
            ].copy()
            
            print(f"📍 {len(df_coords)} incidencias válidas")
            
            if len(df_coords) == 0:
                return {}
            
            # Análisis por sector
            print(f"\n🔍 Analizando sectores...")
            
            densidad = {}
            self.sectores_con_data = []
            self.estadisticas_historicas = {}
            total_incidencias = 0
            
            for sector in self.sectores:
                if sector['poligono_shapely'] is None:
                    densidad[sector['id_sector']] = 0
                    self._inicializar_estadisticas_vacias(sector['id_sector'])
                    continue
                
                poligono = sector['poligono_shapely']
                incidencias_sector = []
                
                # Filtrar incidencias dentro del polígono
                for idx, row in df_coords.iterrows():
                    try:
                        punto = Point(row['lon'], row['lat'])
                        if poligono.contains(punto):
                            incidencias_sector.append(row)
                    except:
                        continue
                
                count_sector = len(incidencias_sector)
                
                if count_sector > 0:
                    df_sector = pd.DataFrame(incidencias_sector)
                    
                    # Separar denuncias y emergencias POR id_tipo_incidencia
                    df_denuncias = df_sector[df_sector['id_tipo_incidencia'] == 1]
                    df_emergencias = df_sector[df_sector['id_tipo_incidencia'] == 2]
                    
                    total_denuncias = len(df_denuncias)
                    total_emergencias = len(df_emergencias)
                    
                    # Por tipo con nombres - DENUNCIAS
                    denuncias_por_tipo = {}
                    if len(df_denuncias) > 0 and 'id_denuncia' in df_denuncias.columns:
                        conteo = df_denuncias.groupby('id_denuncia').size().to_dict()
                        for tipo_id, cantidad in conteo.items():
                            tipo_id_int = int(tipo_id)
                            nombre_tipo = self.tipos_denuncias.get(tipo_id_int)
                            if nombre_tipo:  # Solo agregar si existe en el mapa
                                denuncias_por_tipo[nombre_tipo] = int(cantidad)
                    
                    # Por tipo con nombres - EMERGENCIAS
                    emergencias_por_tipo = {}
                    if len(df_emergencias) > 0 and 'id_numero_emergencia' in df_emergencias.columns:
                        conteo = df_emergencias.groupby('id_numero_emergencia').size().to_dict()
                        for tipo_id, cantidad in conteo.items():
                            tipo_id_int = int(tipo_id)
                            nombre_tipo = self.tipos_emergencias.get(tipo_id_int)
                            if nombre_tipo:  # Solo agregar si existe en el mapa
                                emergencias_por_tipo[nombre_tipo] = int(cantidad)
                    
                    nivel_historico = self._calcular_nivel_criticidad(count_sector)
                    
                    self.estadisticas_historicas[sector['id_sector']] = {
                        'total': count_sector,
                        'denuncias': total_denuncias,
                        'emergencias': total_emergencias,
                        'denuncias_por_tipo': denuncias_por_tipo,
                        'emergencias_por_tipo': emergencias_por_tipo,
                        'nivel': nivel_historico['nivel'],
                        'color': nivel_historico['color']
                    }
                    
                    self.sectores_con_data.append(sector['id_sector'])
                    total_incidencias += count_sector
                    
                    print(f"✅ {sector['codigo_sector']}: {count_sector} incidencias históricas ({total_denuncias} den, {total_emergencias} emer)")
                else:
                    densidad[sector['id_sector']] = 0
                    self._inicializar_estadisticas_vacias(sector['id_sector'])
                    print(f"⚪ {sector['codigo_sector']}: Sin data histórica")
            
            # Calcular porcentajes
            if total_incidencias > 0:
                for id_sector in self.estadisticas_historicas:
                    count = self.estadisticas_historicas[id_sector]['total']
                    densidad[id_sector] = count / total_incidencias if count > 0 else 0.0
            else:
                for sector in self.sectores:
                    densidad[sector['id_sector']] = 0.0
            
            self.densidad_historica = densidad
            
            print(f"\n✅ Análisis completo: {len(self.sectores_con_data)}/{len(self.sectores)} sectores con data")
            
            # ✅ Guardar en caché
            self.guardar_cache_historico()
            
            return densidad
            
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            import traceback
            traceback.print_exc()
            return {}
    
    
    def _inicializar_estadisticas_vacias(self, id_sector):
        """Inicializa estadísticas vacías para sectores sin data"""
        self.estadisticas_historicas[id_sector] = {
            'total': 0,
            'denuncias': 0,
            'emergencias': 0,
            'denuncias_por_tipo': {},
            'emergencias_por_tipo': {},
            'nivel': 'muy_bajo',
            'color': '#4caf50'
        }
    
    
    def predecir_sectores(self, prediccion_global, incluir_detalles=True):
        """
        Distribuye predicción CON TIPOS entre sectores
        """
        try:
            self.cargar_sectores()
            
            if not self.sectores:
                return []
            
            if not self.densidad_historica:
                self.calcular_densidad_historica()
            
            # Totales de predicción global
            denuncias_globales = prediccion_global.get('denuncias', {})
            emergencias_globales = prediccion_global.get('emergencias', {})
            
            total_denuncias = sum(denuncias_globales.values())
            total_emergencias = sum(emergencias_globales.values())
            
            print(f"\n🎯 Distribuyendo predicción por tipos:")
            print(f"   Total: {total_denuncias + total_emergencias} ({total_denuncias} den, {total_emergencias} emer)")
            
            predicciones_sectores = []
            
            for sector in self.sectores:
                id_sector = sector['id_sector']
                densidad = self.densidad_historica.get(id_sector, 0.0)
                historico = self.estadisticas_historicas.get(id_sector, {
                    'total': 0, 'denuncias': 0, 'emergencias': 0,
                    'denuncias_por_tipo': {}, 'emergencias_por_tipo': {},
                    'nivel': 'muy_bajo', 'color': '#4caf50'
                })
                
                # Predicción total
                if densidad == 0:
                    denuncias_sector = 0.0
                    emergencias_sector = 0.0
                    total_sector = 0.0
                    denuncias_por_tipo_pred = {}
                    emergencias_por_tipo_pred = {}
                else:
                    denuncias_sector = total_denuncias * densidad
                    emergencias_sector = total_emergencias * densidad
                    total_sector = denuncias_sector + emergencias_sector
                    
                    # Predicción POR TIPO
                    denuncias_por_tipo_pred = {}
                    for tipo_id, cantidad in denuncias_globales.items():
                        tipo_id_int = int(tipo_id)
                        nombre_tipo = self.tipos_denuncias.get(tipo_id_int, f"Tipo {tipo_id_int}")
                        denuncias_por_tipo_pred[nombre_tipo] = {
                            'cantidad': round(cantidad * densidad, 2),
                            'id_tipo': tipo_id_int
                        }
                    
                    emergencias_por_tipo_pred = {}
                    for tipo_id, cantidad in emergencias_globales.items():
                        tipo_id_int = int(tipo_id)
                        nombre_tipo = self.tipos_emergencias.get(tipo_id_int, f"Tipo {tipo_id_int}")
                        emergencias_por_tipo_pred[nombre_tipo] = {
                            'cantidad': round(cantidad * densidad, 2),
                            'id_tipo': tipo_id_int
                        }
                
                nivel = self._calcular_nivel_criticidad(total_sector)
                
                prediccion_sector = {
                    'id_sector': id_sector,
                    'codigo_sector': sector['codigo_sector'],
                    'nombre': sector['nombre'],
                    'centro': sector['centro'],
                    'bounds': sector['bounds'],
                    'poligono': sector['poligono'],
                    'prediccion': {
                        'total': round(total_sector, 2),
                        'denuncias': round(denuncias_sector, 2),
                        'emergencias': round(emergencias_sector, 2),
                        'denuncias_por_tipo': denuncias_por_tipo_pred,
                        'emergencias_por_tipo': emergencias_por_tipo_pred
                    },
                    'historico': historico,
                    'densidad_historica': round(densidad * 100, 2),
                    'nivel_criticidad': nivel['nivel'],
                    'color': nivel['color'],
                    'prioridad': nivel['prioridad'],
                    'tiene_data_historica': densidad > 0
                }
                
                predicciones_sectores.append(prediccion_sector)
            
            predicciones_sectores.sort(key=lambda x: x['prioridad'], reverse=True)
            
            return predicciones_sectores
            
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            import traceback
            traceback.print_exc()
            return []
    
    
    def _calcular_nivel_criticidad(self, total_incidencias):
        """Calcula nivel de criticidad"""
        if total_incidencias >= 100:
            return {'nivel': 'muy_alto', 'color': '#d32f2f', 'prioridad': 5}
        elif total_incidencias >= 50:
            return {'nivel': 'alto', 'color': '#f44336', 'prioridad': 4}
        elif total_incidencias >= 20:
            return {'nivel': 'medio', 'color': '#ff9800', 'prioridad': 3}
        elif total_incidencias >= 5:
            return {'nivel': 'bajo', 'color': '#ffc107', 'prioridad': 2}
        else:
            return {'nivel': 'muy_bajo', 'color': '#4caf50', 'prioridad': 1}
    
    
    def generar_resumen(self, predicciones_sectores):
        """Genera resumen estadístico"""
        if not predicciones_sectores:
            return {}
        
        sectores_activos = [s for s in predicciones_sectores if s['prediccion']['total'] > 0]
        
        # Predicción
        total_denuncias = sum(s['prediccion']['denuncias'] for s in predicciones_sectores)
        total_emergencias = sum(s['prediccion']['emergencias'] for s in predicciones_sectores)
        total_incidencias = sum(s['prediccion']['total'] for s in predicciones_sectores)
        
        # Histórico
        total_historico = sum(s['historico']['total'] for s in predicciones_sectores)
        den_historico = sum(s['historico']['denuncias'] for s in predicciones_sectores)
        emer_historico = sum(s['historico']['emergencias'] for s in predicciones_sectores)
        
        # Sector crítico
        sector_critico = max(sectores_activos, key=lambda x: x['prediccion']['total']) if sectores_activos else None
        
        # Distribución niveles
        distribucion_niveles = {
            'muy_alto': len([s for s in predicciones_sectores if s['nivel_criticidad'] == 'muy_alto']),
            'alto': len([s for s in predicciones_sectores if s['nivel_criticidad'] == 'alto']),
            'medio': len([s for s in predicciones_sectores if s['nivel_criticidad'] == 'medio']),
            'bajo': len([s for s in predicciones_sectores if s['nivel_criticidad'] == 'bajo']),
            'muy_bajo': len([s for s in predicciones_sectores if s['nivel_criticidad'] == 'muy_bajo'])
        }
        
        # Top 5
        top_5_criticos = sorted(sectores_activos, key=lambda x: x['prediccion']['total'], reverse=True)[:5]
        
        return {
            'total_sectores': len(predicciones_sectores),
            'sectores_con_prediccion': len(sectores_activos),
            'sectores_sin_prediccion': len(predicciones_sectores) - len(sectores_activos),
            'prediccion': {
                'total_incidencias': round(total_incidencias, 2),
                'total_denuncias': round(total_denuncias, 2),
                'total_emergencias': round(total_emergencias, 2)
            },
            'historico': {
                'total_incidencias': total_historico,
                'total_denuncias': den_historico,
                'total_emergencias': emer_historico
            },
            'sector_mas_critico': {
                'id_sector': sector_critico['id_sector'],
                'codigo': sector_critico['codigo_sector'],
                'nombre': sector_critico['nombre'],
                'total': sector_critico['prediccion']['total'],
                'nivel': sector_critico['nivel_criticidad']
            } if sector_critico else None,
            'distribucion_niveles': distribucion_niveles,
            'top_5_criticos': [
                {
                    'codigo': s['codigo_sector'],
                    'nombre': s['nombre'],
                    'total': s['prediccion']['total'],
                    'nivel': s['nivel_criticidad']
                }
                for s in top_5_criticos
            ]
        }


# Instancia global
modelo_espacial = ModeloPrediccionEspacial()