"""
entrenar_sistema_completo.py
Script para entrenar ambos modelos (LSTM + Espacial) desde cero
"""

import os
import sys

# Agregar directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from modelo_PREDICCION import ModeloPrediccionIncidencias
from modelo_PREDICCION_ESPACIAL import entrenar_modelo_espacial


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
        return
    
    # ===============================================================
    # FASE 2: ENTRENAMIENTO DEL MODELO ESPACIAL
    # ===============================================================
    print("\n" + "="*80)
    print(" " * 25 + "FASE 2: MODELO ESPACIAL")
    print("="*80 + "\n")
    
    # Configurar grilla de cuadrantes
    print("📐 Configuración de la grilla de cuadrantes")
    print("-" * 80)
    
    usar_default = input("¿Usar configuración por defecto (5x5 = 25 cuadrantes)? (s/n): ").lower()
    
    if usar_default == 's':
        n_filas = 5
        n_cols = 5
    else:
        try:
            n_filas = int(input("Número de filas (2-10): "))
            n_cols = int(input("Número de columnas (2-10): "))
            
            if not (2 <= n_filas <= 10 and 2 <= n_cols <= 10):
                print("⚠️  Valores fuera de rango. Usando 5x5 por defecto.")
                n_filas = 5
                n_cols = 5
        except ValueError:
            print("⚠️  Entrada inválida. Usando 5x5 por defecto.")
            n_filas = 5
            n_cols = 5
    
    print(f"\n🗺️  Se creará una grilla de {n_filas}x{n_cols} = {n_filas * n_cols} cuadrantes\n")
    
    try:
        modelo_espacial = entrenar_modelo_espacial(
            csv_path=csv_path,
            n_filas=n_filas,
            n_cols=n_cols
        )
        
        print("\n✅ FASE 2 COMPLETADA: Modelo espacial entrenado exitosamente")
        print(f"   - Cuadrantes creados: {len(modelo_espacial.cuadrantes)}")
        print(f"   - Grilla: {n_filas}x{n_cols}")
        
    except Exception as e:
        print(f"\n❌ ERROR en FASE 2: {e}")
        print("\nEl entrenamiento del modelo espacial falló. El modelo LSTM sigue disponible.")
        print("Puedes intentar entrenar el modelo espacial más tarde desde la interfaz web.")
        return
    
    # ===============================================================
    # RESUMEN FINAL
    # ===============================================================
    print("\n" + "="*80)
    print(" " * 30 + "RESUMEN DEL ENTRENAMIENTO")
    print("="*80 + "\n")
    
    print("✅ SISTEMA COMPLETAMENTE ENTRENADO\n")
    
    print("📊 Modelo LSTM (Temporal):")
    print(f"   • Tipos de denuncias entrenados: {len(modelo_lstm.models_den)}")
    print(f"   • Tipos de emergencias entrenados: {len(modelo_lstm.models_eme)}")
    print(f"   • Lookback: {6} meses")
    print(f"   • Arquitectura: Bidirectional LSTM (64-32-16-1)")
    
    # Calcular métricas promedio
    maes_den = [info['metrics']['mae'] for info in modelo_lstm.models_den.values()]
    maes_eme = [info['metrics']['mae'] for info in modelo_lstm.models_eme.values()]
    
    mae_prom_den = sum(maes_den) / len(maes_den) if maes_den else 0
    mae_prom_eme = sum(maes_eme) / len(maes_eme) if maes_eme else 0
    
    print(f"   • MAE promedio denuncias: {mae_prom_den:.2f}")
    print(f"   • MAE promedio emergencias: {mae_prom_eme:.2f}")
    
    print(f"\n🗺️  Modelo Espacial:")
    print(f"   • Cuadrantes creados: {len(modelo_espacial.cuadrantes)}")
    print(f"   • Configuración: {n_filas}x{n_cols}")
    print(f"   • Distribuciones históricas calculadas: ✓")
    
    # Estadísticas de datos históricos
    total_den = sum(modelo_espacial.distribuciones_historicas['totales_cuadrante'].get(i, {}).get('denuncias', 0) 
                    for i in range(len(modelo_espacial.cuadrantes)))
    total_eme = sum(modelo_espacial.distribuciones_historicas['totales_cuadrante'].get(i, {}).get('emergencias', 0) 
                    for i in range(len(modelo_espacial.cuadrantes)))
    
    print(f"   • Total denuncias históricas: {total_den:,}")
    print(f"   • Total emergencias históricas: {total_eme:,}")
    
    print("\n" + "="*80)
    print("\n🚀 El sistema está listo para usarse!")
    print("\n📍 Pasos siguientes:")
    print("   1. Inicia el servidor Flask: python app.py")
    print("   2. Accede a la interfaz web en: http://localhost:5000")
    print("   3. Ve al módulo de 'Predicción de Incidencias'")
    print("   4. Prueba la predicción temporal y espacial")
    
    print("\n💡 Consejos:")
    print("   • La predicción temporal funciona para cualquier mes futuro")
    print("   • La predicción espacial muestra los cuadrantes en el mapa")
    print("   • Puedes exportar los resultados a CSV para análisis adicional")
    print("   • Reentrenar periódicamente con nuevos datos mejorará la precisión")
    
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