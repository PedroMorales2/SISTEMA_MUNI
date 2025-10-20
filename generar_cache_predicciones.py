"""
generar_cache_predicciones.py
Script para pre-generar caché de predicciones masivo
Genera predicciones de 2025 a 2035 y guarda en cache
"""

import sys
import os
from datetime import datetime

# Importar tu modelo
from models.modelo_PREDICCION import ModeloPrediccionIncidencias

def generar_cache_masivo(year_inicio=2025, year_fin=2035):
    """
    Genera predicciones para todos los meses desde year_inicio hasta year_fin
    """
    print("="*80)
    print("GENERADOR DE CACHÉ MASIVO - PREDICCIONES")
    print("="*80)
    
    # Cargar modelo
    print("\n📊 Cargando modelo...")
    modelo = ModeloPrediccionIncidencias()
    
    try:
        modelo.cargar_modelos()
        print("✅ Modelo cargado exitosamente")
    except:
        print("❌ Error: No se encontraron modelos entrenados")
        print("   Primero ejecuta: python entrenar_sistema_completo.py")
        return
    
    # Calcular total de meses
    total_meses = (year_fin - year_inicio + 1) * 12
    print(f"\n🔮 Generando predicciones para {total_meses} meses...")
    print(f"   Desde: {year_inicio}-01")
    print(f"   Hasta: {year_fin}-12")
    print(f"\n{'='*80}")
    
    # Contador
    contador = 0
    errores = 0
    
    # Generar predicciones
    for year in range(year_inicio, year_fin + 1):
        for month in range(1, 13):
            try:
                print(f"\n[{contador+1}/{total_meses}] Prediciendo {year}-{month:02d}...", end=" ")
                
                # Hacer predicción (esto automáticamente guarda en caché)
                resultado = modelo.predecir_mes(year, month)
                
                # Contar predicciones
                total_den = sum(resultado['denuncias'].values()) if resultado.get('denuncias') else 0
                total_eme = sum(resultado['emergencias'].values()) if resultado.get('emergencias') else 0
                total = total_den + total_eme
                
                print(f"✅ Total: {total} ({total_den} den + {total_eme} eme)")
                contador += 1
                
            except Exception as e:
                print(f"❌ Error: {str(e)}")
                errores += 1
    
    # Resumen final
    print(f"\n{'='*80}")
    print("RESUMEN DE GENERACIÓN DE CACHÉ")
    print(f"{'='*80}")
    print(f"✅ Predicciones exitosas: {contador}")
    print(f"❌ Errores: {errores}")
    print(f"📦 Tamaño del caché: {len(modelo.cache_predicciones)} predicciones")
    print(f"\n💾 Caché guardado en: cache_predicciones/predicciones_cache.pkl")
    print(f"{'='*80}\n")
    
    # Mostrar muestra del caché
    print("\n📊 MUESTRA DEL CACHÉ (primeras 10 entradas):")
    for i, (key, value) in enumerate(list(modelo.cache_predicciones.items())[:10]):
        print(f"   {key}: {value}")
    
    print("\n✅ ¡Caché generado exitosamente!")
    print("   Ahora puedes copiar 'cache_predicciones/' a PythonAnywhere\n")


def verificar_cache():
    """
    Verifica el caché existente
    """
    print("="*80)
    print("VERIFICACIÓN DE CACHÉ")
    print("="*80)
    
    modelo = ModeloPrediccionIncidencias()
    
    print(f"\n📦 Total de predicciones en caché: {len(modelo.cache_predicciones)}")
    
    if len(modelo.cache_predicciones) > 0:
        # Analizar años disponibles
        años = set()
        for key in modelo.cache_predicciones.keys():
            # key formato: "denuncias_1_2025_01"
            partes = key.split('_')
            if len(partes) >= 3:
                try:
                    año = int(partes[2])
                    años.add(año)
                except:
                    pass
        
        print(f"📅 Años en caché: {sorted(años)}")
        print(f"📊 Rango: {min(años)} - {max(años)}")
        
        # Muestra de predicciones por año
        print(f"\n📈 Predicciones por año:")
        for año in sorted(años):
            count = sum(1 for key in modelo.cache_predicciones.keys() if f"_{año}_" in key)
            print(f"   {año}: {count} predicciones")
    else:
        print("\n⚠️  No hay predicciones en caché")
    
    print()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Generador de caché de predicciones')
    parser.add_argument('--inicio', type=int, default=2025, help='Año de inicio (default: 2025)')
    parser.add_argument('--fin', type=int, default=2035, help='Año de fin (default: 2035)')
    parser.add_argument('--verificar', action='store_true', help='Solo verificar caché existente')
    
    args = parser.parse_args()
    
    if args.verificar:
        verificar_cache()
    else:
        generar_cache_masivo(args.inicio, args.fin)
        verificar_cache()