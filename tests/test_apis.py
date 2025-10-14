# test_apis.py
"""
Script de pruebas para las APIs de recursos y configuración
Ejecutar: python test_apis.py
"""

import requests
import json

BASE_URL = "http://127.0.0.1:5000"

def test_recursos():
    print("\n" + "="*60)
    print("PRUEBAS DE API DE RECURSOS")
    print("="*60)
    
    # 1. Listar todos los recursos
    print("\n1. Listando todos los recursos...")
    response = requests.get(f"{BASE_URL}/api/recursos/listar")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
    
    # 2. Obtener inventario
    print("\n2. Obteniendo inventario...")
    response = requests.get(f"{BASE_URL}/api/recursos/inventario")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
    
    # 3. Crear nuevo recurso
    print("\n3. Creando nuevo recurso...")
    nuevo_recurso = {
        "nombre": "recursos_test",
        "cantidad": 10,
        "descripcion": "Recurso de prueba",
        "usuario": "test_user"
    }
    response = requests.post(
        f"{BASE_URL}/api/recursos/crear",
        json=nuevo_recurso
    )
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
    
    # 4. Obtener estadísticas
    print("\n4. Obteniendo estadísticas...")
    response = requests.get(f"{BASE_URL}/api/recursos/estadisticas")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))


def test_configuracion():
    print("\n" + "="*60)
    print("PRUEBAS DE API DE CONFIGURACIÓN")
    print("="*60)
    
    # 1. Obtener ratios para JavaScript
    print("\n1. Obteniendo ratios para JavaScript...")
    response = requests.get(f"{BASE_URL}/api/configuracion/ratios")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
    
    # 2. Listar configuraciones agrupadas
    print("\n2. Listando configuraciones agrupadas...")
    response = requests.get(f"{BASE_URL}/api/configuracion/listar-agrupado")
    print(f"Status: {response.status_code}")
    # Solo mostrar categorías para no saturar
    if response.status_code == 200:
        data = response.json()
        if data['success']:
            categorias = list(data['data'].keys())
            print(f"Categorías encontradas: {categorias}")
    
    # 3. Obtener configuraciones de una categoría
    print("\n3. Obteniendo configuraciones de PRESUPUESTO...")
    response = requests.get(f"{BASE_URL}/api/configuracion/categoria/PRESUPUESTO")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
    
    # 4. Obtener estadísticas
    print("\n4. Obteniendo estadísticas...")
    response = requests.get(f"{BASE_URL}/api/configuracion/estadisticas")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))


if __name__ == "__main__":
    print("\n🧪 INICIANDO PRUEBAS DE APIs")
    print("Asegúrese de que el servidor Flask esté corriendo en localhost:5000\n")
    
    try:
        test_recursos()
        test_configuracion()
        print("\n✅ Pruebas completadas")
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: No se pudo conectar al servidor")
        print("Asegúrese de que Flask esté corriendo en localhost:5000")
    except Exception as e:
        print(f"\n❌ Error durante las pruebas: {e}")