// Configuración global
const API_URL = '{{ BASE_URL }}';

// Variables globales
let chartDenuncias, chartEmergencias, chartMetricas, chartComparacion, chartAnalisis, chartRecursos;
let modeloInfo = null;
let ultimaPrediccion = null;
let datosHistoricos = null;
let progressModal = null;
let progressBar = null;
let progressMessage = null;

// Mapeo de tipos de denuncia
const DENUNCIAS_MAP = {
  1: 'Ruidos molestos',
  2: 'Bullying y violencia familiar',
  3: 'Ocupación vía pública',
  4: 'Parques y jardines',
  5: 'Limpieza pública',
  6: 'Negocios informales',
  7: 'Otros',
  8: 'Peleas y conflictos',
  9: 'Lluvias intensas',
  10: 'Sismos',
  11: 'Incendio urbano',
  12: 'Riesgo de colapso'
};

// Mapeo de emergencias
const EMERGENCIAS_MAP = {
  2: 'Policía (911)',
  3: 'Serenazgo (955)',
  4: 'Ambulancia (666)',
  5: 'Bomberos Monsefú (444)',
  6: 'Bomberos Chiclayo (922)'
};

// Nombres de meses
const MESES_NOMBRE = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];