// Comparar predicciones entre años
async function compararAnos() {
  const mes = parseInt(document.getElementById('mesComparacion').value);
  const anos = [2027, 2028, 2029, 2030];
  
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = '⏳ Comparando...';

  try {
    const predicciones = await Promise.all(
      anos.map(year => 
        fetch(`${API_URL}/api/modelo/prediccion/predecir`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year, month: mes })
        }).then(r => r.json())
      )
    );

    const datos = predicciones.filter(p => p.success).map(p => p.data);
    
    if (datos.length > 0) {
      mostrarComparacion(datos, mes);
    } else {
      alert('No se pudieron obtener las predicciones');
    }
  } catch (error) {
    alert('Error: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Comparar entre Años';
  }
}

// Mostrar comparación temporal
function mostrarComparacion(datos, mes) {
  document.getElementById('resultadoComparacion').style.display = 'block';
  
  const labels = datos.map(d => d.year.toString());
  const totalDenuncias = datos.map(d => Object.values(d.denuncias).reduce((a, b) => a + b, 0));
  const totalEmergencias = datos.map(d => Object.values(d.emergencias).reduce((a, b) => a + b, 0));
  
  crearGraficoComparacion(labels, totalDenuncias, totalEmergencias, mes);
  crearTablaComparacion(datos, totalDenuncias, totalEmergencias, mes);
  
  document.getElementById('resultadoComparacion').scrollIntoView({ 
    behavior: 'smooth', 
    block: 'nearest' 
  });
}

// Crear gráfico de comparación
function crearGraficoComparacion(labels, totalDenuncias, totalEmergencias, mes) {
  if (chartComparacion) chartComparacion.destroy();
  
  chartComparacion = new Chart(document.getElementById('chartComparacion'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Denuncias Totales',
          data: totalDenuncias,
          borderColor: 'rgba(74, 144, 226, 1)',
          backgroundColor: 'rgba(74, 144, 226, 0.2)',
          fill: true,
          tension: 0.4,
          pointRadius: 6
        },
        {
          label: 'Emergencias Totales',
          data: totalEmergencias,
          borderColor: 'rgba(244, 67, 54, 1)',
          backgroundColor: 'rgba(244, 67, 54, 0.2)',
          fill: true,
          tension: 0.4,
          pointRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `Comparación de ${MESES_NOMBRE[mes]} entre Diferentes Años`,
          font: { size: 16, weight: 'bold' }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  });
}

// Crear tabla comparativa
function crearTablaComparacion(datos, totalDenuncias, totalEmergencias, mes) {
  let tableHTML = `
    <thead>
      <tr>
        <th>Año</th>
        <th>Denuncias</th>
        <th>Emergencias</th>
        <th>Cambio vs Año Anterior<br><small>Denuncias</small></th>
        <th>Cambio vs Año Anterior<br><small>Emergencias</small></th>
      </tr>
    </thead>
    <tbody>
  `;
  
  datos.forEach((d, idx) => {
    const varDen = idx > 0 ? totalDenuncias[idx] - totalDenuncias[idx - 1] : 0;
    const varEme = idx > 0 ? totalEmergencias[idx] - totalEmergencias[idx - 1] : 0;
    const varDenColor = varDen > 0 ? 'color: #f44336; font-weight: bold;' : varDen < 0 ? 'color: #4caf50; font-weight: bold;' : '';
    const varEmeColor = varEme > 0 ? 'color: #f44336; font-weight: bold;' : varEme < 0 ? 'color: #4caf50; font-weight: bold;' : '';
    
    const flechaDen = varDen > 0 ? '▲' : varDen < 0 ? '▼' : '—';
    const flechaEme = varEme > 0 ? '▲' : varEme < 0 ? '▼' : '—';
    
    tableHTML += `
      <tr>
        <td><strong>${d.year}</strong></td>
        <td style="text-align: center;"><strong>${totalDenuncias[idx]}</strong></td>
        <td style="text-align: center;"><strong>${totalEmergencias[idx]}</strong></td>
        <td style="text-align: center; ${varDenColor}">
          ${idx > 0 ? `${flechaDen} ${varDen > 0 ? '+' : ''}${varDen}` : '—'}
        </td>
        <td style="text-align: center; ${varEmeColor}">
          ${idx > 0 ? `${flechaEme} ${varEme > 0 ? '+' : ''}${varEme}` : '—'}
        </td>
      </tr>
    `;
  });
  
  tableHTML += '</tbody>';
  document.getElementById('tablaComparacion').innerHTML = tableHTML;
  
  // Interpretación
  const tendenciaDen = totalDenuncias[totalDenuncias.length - 1] > totalDenuncias[0];
  const tendenciaEme = totalEmergencias[totalEmergencias.length - 1] > totalEmergencias[0];
  
  const interpretacion = `
    <div class="alert ${tendenciaDen || tendenciaEme ? 'alert-warning' : 'alert-success'}" style="margin-top: 20px;">
      <span>${tendenciaDen || tendenciaEme ? '📈' : '📉'}</span>
      <div>
        <strong>Interpretación de Tendencias:</strong><br>
        <small>
          ${tendenciaDen ? 
            `Las denuncias en ${MESES_NOMBRE[mes]} están <strong>aumentando</strong> con el tiempo.` : 
            `Las denuncias en ${MESES_NOMBRE[mes]} se mantienen <strong>estables</strong>.`}
          <br>
          ${tendenciaEme ? 
            `Las emergencias en ${MESES_NOMBRE[mes]} están <strong>aumentando</strong> con el tiempo.` : 
            `Las emergencias en ${MESES_NOMBRE[mes]} se mantienen <strong>estables</strong>.`}
        </small>
      </div>
    </div>
  `;
  
  document.getElementById('tablaComparacion').insertAdjacentHTML('afterend', interpretacion);
}