"""
entrenar_sistema_completo.py
Script para entrenar ambos modelos (LSTM + Espacial) con caché inteligente
"""

import os
import sys

# Agregar directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models.modelo_PREDICCION import ModeloPrediccionIncidencias
from models.modelo_PREDICCION_ESPACIAL import modelo_espacial


def main():
    """Entrena el sistema completo de predicción"""
    
    print("\n" + "="*80)
    print(" " * 20 + "SISTEMA DE PREDICCIÓN DE INCIDENCIAS REQUE")
    print(" " * 25 + "Entrenamiento Completo del Sistema")
    print("="*80 + "\n")
    
    # Ruta del dataset
    csv_path = 'data_modelo/dataset_incidencias_reque_2015_2024.csv'
    
    # Verificar que existe el archivo
    if not os.path.exists(csv_path):
        print(f"❌ ERROR: No se encontró el archivo {csv_path}")
        print("\nAsegúrate de que el archivo existe en la ruta correcta.")
        return
    
    print(f"📂 Dataset encontrado: {csv_path}")
    print(f"📊 Tamaño del archivo: {os.path.getsize(csv_path) / 1024 / 1024:.2f} MB\n")
    
    # ===============================================================
    # FASE 1: ENTRENAMIENTO DEL MODELO LSTM
    # ===============================================================
    print("\n" + "="*80)
    print(" " * 25 + "FASE 1: MODELO LSTM TEMPORAL")
    print("="*80 + "\n")
    
    try:
        modelo_lstm = ModeloPrediccionIncidencias()
        modelo_lstm.entrenar_modelos(csv_path)
        
        print("\n✅ FASE 1 COMPLETADA: Modelo LSTM entrenado exitosamente")
        print(f"   - Tipos de denuncias: {len(modelo_lstm.models_den)}")
        print(f"   - Tipos de emergencias: {len(modelo_lstm.models_eme)}")
        
    except Exception as e:
        print(f"\n❌ ERROR en FASE 1: {e}")
        print("\nEl entrenamiento del modelo LSTM falló. Revisa el error anterior.")
        import traceback
        traceback.print_exc()
        return
    
    # ===============================================================
    # FASE 2: CARGA Y ANÁLISIS DE SECTORES
    # ===============================================================
    print("\n" + "="*80)
    print(" " * 20 + "FASE 2: MODELO ESPACIAL POR SECTORES")
    print("="*80 + "\n")
    
    try:
        # Cargar sectores desde BD
        print("📍 Cargando sectores desde base de datos...")
        modelo_espacial.cargar_sectores()
        
        if len(modelo_espacial.sectores) == 0:
            print("⚠️  No hay sectores definidos en la base de datos.")
            print("   Por favor, crea sectores desde la interfaz web primero.")
            print("   El modelo LSTM está disponible para predicción temporal.")
            return
        
        print(f"✅ {len(modelo_espacial.sectores)} sectores cargados correctamente\n")
        
        # Mostrar sectores cargados
        print("📋 Sectores encontrados:")
        print("-" * 80)
        for sector in modelo_espacial.sectores:
            print(f"   • {sector['codigo_sector']}: {sector['nombre']}")
        print()
        
    except Exception as e:
        print(f"\n❌ ERROR al cargar sectores: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # ===============================================================
    # FASE 3: CÁLCULO DE DENSIDAD HISTÓRICA (CON CACHÉ)
    # ===============================================================
    print("\n" + "="*80)
    print(" " * 20 + "FASE 3: ANÁLISIS HISTÓRICO POR SECTOR")
    print("="*80 + "\n")
    
    # Preguntar si forzar recalculo
    usar_cache = input("¿Usar caché si está disponible? (s/n) [s]: ").lower()
    forzar_recalculo = usar_cache == 'n'
    
    if forzar_recalculo:
        print("🔄 Forzando recalculo completo (ignorando caché)...")
        modelo_espacial.invalidar_cache()
    
    try:
        print("🔍 Calculando densidad histórica del dataset 2015-2024...")
        print("   (Esto puede tardar varios minutos si no hay caché válido)\n")
        
        # Calcular densidad histórica (usa caché si es válido)
        densidad = modelo_espacial.calcular_densidad_historica(forzar_recalculo=forzar_recalculo)
        
        if not densidad:
            print("⚠️  No se pudo calcular la densidad histórica.")
            print("   Verifica que el dataset tenga coordenadas válidas.")
            return
        
        print("\n✅ FASE 3 COMPLETADA: Análisis histórico calculado")
        print(f"   - Sectores con data histórica: {len(modelo_espacial.sectores_con_data)}")
        print(f"   - Sectores sin data: {len(modelo_espacial.sectores) - len(modelo_espacial.sectores_con_data)}")
        
        # Verificar si hay caché
        if os.path.exists(modelo_espacial.cache_file):
            cache_size = os.path.getsize(modelo_espacial.cache_file) / 1024
            print(f"   - Caché guardado: {cache_size:.2f} KB")
        
        # Mostrar top 5 sectores con más incidencias
        sectores_ordenados = sorted(
            modelo_espacial.estadisticas_historicas.items(),
            key=lambda x: x[1]['total'],
            reverse=True
        )[:5]
        
        if sectores_ordenados:
            print("\n📊 Top 5 sectores con más incidencias históricas:")
            print("-" * 80)
            for id_sector, stats in sectores_ordenados:
                sector_info = next((s for s in modelo_espacial.sectores if s['id_sector'] == id_sector), None)
                if sector_info:
                    print(f"   {sector_info['codigo_sector']:10} | "
                          f"Total: {stats['total']:6,} | "
                          f"Denuncias: {stats['denuncias']:6,} | "
                          f"Emergencias: {stats['emergencias']:6,}")
        
    except Exception as e:
        print(f"\n❌ ERROR en FASE 3: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # ===============================================================
    # RESUMEN FINAL
    # ===============================================================
    print("\n" + "="*80)
    print(" " * 30 + "RESUMEN DEL ENTRENAMIENTO")
    print("="*80 + "\n")
    
    print("✅ SISTEMA COMPLETAMENTE ENTRENADO\n")
    
    # Resumen LSTM
    print("📊 Modelo LSTM (Temporal):")
    print(f"   • Tipos de denuncias entrenados: {len(modelo_lstm.models_den)}")
    print(f"   • Tipos de emergencias entrenados: {len(modelo_lstm.models_eme)}")
    print(f"   • Lookback: 6 meses")
    print(f"   • Arquitectura: Bidirectional LSTM (64-32-16-1)")
    
    # Calcular métricas promedio
    maes_den = [info['metrics']['mae'] for info in modelo_lstm.models_den.values()]
    maes_eme = [info['metrics']['mae'] for info in modelo_lstm.models_eme.values()]
    
    mae_prom_den = sum(maes_den) / len(maes_den) if maes_den else 0
    mae_prom_eme = sum(maes_eme) / len(maes_eme) if maes_eme else 0
    
    print(f"   • MAE promedio denuncias: {mae_prom_den:.2f}")
    print(f"   • MAE promedio emergencias: {mae_prom_eme:.2f}")
    
    # Resumen Espacial
    print(f"\n🗺️  Modelo Espacial por Sectores:")
    print(f"   • Sectores totales: {len(modelo_espacial.sectores)}")
    print(f"   • Sectores con data histórica: {len(modelo_espacial.sectores_con_data)}")
    print(f"   • Distribuciones históricas: ✓")
    print(f"   • Sistema de caché: ✓ ACTIVO")
    
    # Estadísticas totales
    total_historico = sum(s['total'] for s in modelo_espacial.estadisticas_historicas.values())
    total_den = sum(s['denuncias'] for s in modelo_espacial.estadisticas_historicas.values())
    total_eme = sum(s['emergencias'] for s in modelo_espacial.estadisticas_historicas.values())
    
    print(f"   • Total incidencias históricas: {total_historico:,}")
    print(f"   • Denuncias históricas: {total_den:,}")
    print(f"   • Emergencias históricas: {total_eme:,}")
    
    print("\n" + "="*80)
    print("\n🚀 El sistema está listo para usarse!")
    print("\n📍 Pasos siguientes:")
    print("   1. Inicia el servidor Flask: python app.py")
    print("   2. Accede a la interfaz web en: http://localhost:5000")
    print("   3. Ve al módulo de 'Predicción de Incidencias'")
    print("   4. Prueba las predicciones")
    
    print("\n💡 Sistema de Caché:")
    print("   • El histórico se guarda en: cache_espacial/")
    print("   • El caché se invalida automáticamente si:")
    print("     - Se agregan/eliminan sectores")
    print("     - Se modifican los límites de los sectores")
    print("     - El caché tiene más de 7 días")
    print("   • Para forzar recalculo: elimina el directorio cache_espacial/")
    
    print("\n⚡ Ventajas del caché:")
    print("   ✅ Inicio del servidor 10-20x más rápido")
    print("   ✅ No recalcula si los sectores no cambiaron")
    print("   ✅ Actualización automática al modificar sectores")
    
    print("\n" + "="*80 + "\n")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Entrenamiento interrumpido por el usuario.")
        print("Los modelos parcialmente entrenados pueden no estar disponibles.")
    except Exception as e:
        print(f"\n\n❌ ERROR CRÍTICO: {e}")
        import traceback
        traceback.print_exc()