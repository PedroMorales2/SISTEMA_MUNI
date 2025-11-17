#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para recalcular completamente la predicción espacial
Basado en el modelo ModeloPrediccionEspacial
"""

import os
import sys
from datetime import datetime

# Ajustar ruta raíz si se ejecuta fuera del entorno Flask
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(BASE_DIR))

# Importar el modelo
from models.modelo_PREDICCION_ESPACIAL import ModeloPrediccionEspacial


def main():
    print("🔄 INICIANDO RECÁLCULO COMPLETO DE PREDICCIÓN ESPACIAL...")
    print(f"📅 Fecha de ejecución: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 60)

    # Crear instancia del modelo
    modelo = ModeloPrediccionEspacial()

    # Paso 1: Cargar sectores (ya se carga automáticamente en __init__)
    print(f"\n✅ Sectores cargados: {len(modelo.sectores)}")
    
    if len(modelo.sectores) == 0:
        print("❌ No hay sectores disponibles para analizar")
        return

    # Paso 2: Invalidar caché existente para forzar recálculo
    print("\n🗑️ Invalidando caché anterior...")
    modelo.invalidar_cache()
    
    # Paso 3: Calcular densidad histórica (forzando recálculo)
    print("\n📊 Calculando densidad histórica de incidencias...")
    print("   (Esto puede tardar varios minutos...)")
    densidad = modelo.calcular_densidad_historica(forzar_recalculo=True)
    
    if not densidad:
        print("⚠️ No se pudo calcular la densidad histórica")
        return
    
    print(f"✅ Densidad histórica calculada para {len(densidad)} sectores")

    # Paso 4: Mostrar resumen de sectores con data
    print(f"\n📈 Sectores con datos históricos: {len(modelo.sectores_con_data)}/{len(modelo.sectores)}")
    
    # Mostrar estadísticas por sector
    print("\n📋 **Estadísticas por sector:**")
    for sector in modelo.sectores:
        id_sector = sector['id_sector']
        codigo = sector['codigo_sector']
        stats = modelo.estadisticas_historicas.get(id_sector, {})
        
        total = stats.get('total', 0)
        denuncias = stats.get('denuncias', 0)
        emergencias = stats.get('emergencias', 0)
        nivel = stats.get('nivel', 'muy_bajo')
        
        if total > 0:
            print(f"   ✅ {codigo}: {total} incidencias ({denuncias} den, {emergencias} emer) - Nivel: {nivel}")
        else:
            print(f"   ⚪ {codigo}: Sin datos históricos")

    # Paso 5: Mostrar totales generales
    print("\n📊 **Totales generales:**")
    total_incidencias = sum(s.get('total', 0) for s in modelo.estadisticas_historicas.values())
    total_denuncias = sum(s.get('denuncias', 0) for s in modelo.estadisticas_historicas.values())
    total_emergencias = sum(s.get('emergencias', 0) for s in modelo.estadisticas_historicas.values())
    
    print(f"   - Total incidencias: {total_incidencias}")
    print(f"   - Total denuncias: {total_denuncias}")
    print(f"   - Total emergencias: {total_emergencias}")
    print(f"   - Sectores con datos: {len(modelo.sectores_con_data)}")

    # Paso 6: Generar ejemplo de predicción (necesitas proporcionar predicción global)
    print("\n🔮 Ejemplo de predicción espacial...")
    print("   (Para generar predicciones, necesitas ejecutar primero el modelo LSTM)")
    print("   Usa: modelo.predecir_sectores(prediccion_global)")
    
    # Ejemplo de cómo llamar la predicción:
    # prediccion_global = {
    #     'denuncias': {1: 50, 2: 30, 3: 20},  # tipo_id: cantidad
    #     'emergencias': {1: 10, 2: 5}
    # }
    # predicciones = modelo.predecir_sectores(prediccion_global)

    print("\n💾 Caché guardado automáticamente")
    print("\n🎉 PROCESO FINALIZADO EXITOSAMENTE")
    print("-" * 60)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("\n❌ ERROR DURANTE EL RECÁLCULO:")
        print(f"   {str(e)}")
        
        # Mostrar traceback completo para debugging
        import traceback
        print("\n📋 Detalles del error:")
        traceback.print_exc()
        
        sys.exit(1)