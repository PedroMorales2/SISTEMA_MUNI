// Calcular recursos necesarios
async function calcularRecursos() {
  const mesPlan = document.getElementById('mesPlanificacion').value;
  
  if (!mesPlan) {
    alert('Seleccione un mes para planificar');
    return;
  }

  const [year, month] = mesPlan.split('-');
  
  try {
    const response = await fetch(`${API_URL}/api/modelo/prediccion/predecir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: parseInt(year), month: parseInt(month) })
    });

    const data = await response.json();

    if (data.success) {
      mostrarPlanRecursos(data.data);
    }
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// Mostrar plan de recursos
function mostrarPlanRecursos(prediccion) {
  document.getElementById('resultadoRecursos').style.display = 'block';
  
  const totalCasos = Object.values(prediccion.denuncias).reduce((a, b) => a + b, 0);
  const totalEmergencias = Object.values(prediccion.emergencias).reduce((a, b) => a + b, 0);
  const total = totalCasos + totalEmergencias;
  
  // Cálculos
  const personal = Math.ceil(totalCasos / 10);
  const vehiculos = Math.ceil(totalEmergencias / 20);
  const presupuesto = (total * 50).toLocaleString('es-PE');
  const horas = (total * 2).toLocaleString('es-PE');
  
  document.getElementById('personalRequerido').textContent = personal;
  document.getElementById('vehiculosNecesarios').textContent = vehiculos;
  document.getElementById('presupuestoEstimado').textContent = `S/ ${presupuesto}`;
  document.getElementById('horasTrabajo').textContent = horas;
  
  // Gráfico de recursos por tipo
  const tipos = Object.entries(prediccion.denuncias)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  
  if (chartRecursos) chartRecursos.destroy();
  
  chartRecursos = new Chart(document.getElementById('chartRecursos'), {
    type: 'doughnut',
    data: {
      labels: tipos.map(([id]) => DENUNCIAS_MAP[id]),
      datasets: [{
        data: tipos.map(([, val]) => val),
        backgroundColor: [
          'rgba(244, 67, 54, 0.8)',
          'rgba(233, 30, 99, 0.8)',
          'rgba(156, 39, 176, 0.8)',
          'rgba(103, 58, 183, 0.8)',
          'rgba(63, 81, 181, 0.8)',
          'rgba(33, 150, 243, 0.8)',
          'rgba(0, 188, 212, 0.8)',
          'rgba(0, 150, 136, 0.8)'
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'right' },
        tooltip: {
          callbacks: {
            label: function(context) {
              const percent = ((context.parsed / totalCasos) * 100).toFixed(1);
              return `${context.label}: ${context.parsed} casos (${percent}%)`;
            }
          }
        }
      }
    }
  });
  
  // Plan de acción
  const prioridades = tipos.slice(0, 3);
  document.getElementById('planAccion').innerHTML = `
    <h4>Prioridades para ${prediccion.fecha_prediccion}</h4>
    <ol style="line-height: 2;">
      ${prioridades.map(([id, casos]) => `
        <li><strong>${DENUNCIAS_MAP[id]}</strong>: ${casos} casos esperados
          <br><small style="opacity: 0.7;">→ Asignar ${Math.ceil(casos/10)} personas dedicadas</small>
        </li>
      `).join('')}
    </ol>
    
    <div class="alert alert-success" style="margin-top: 15px;">
      <span>✅</span>
      <div>
        <strong>Recomendación General:</strong> Considere contratar ${personal} personas y preparar ${vehiculos} vehículos para el mes seleccionado.
      </div>
    </div>
  `;
}