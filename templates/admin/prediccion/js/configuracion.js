// Reentrenar modelo
async function reentrenarModelo() {
  if (!confirm('¿Estás seguro de reentrenar el modelo? Este proceso puede tomar 5-10 minutos.')) {
    return;
  }
  
  const btn = event.target;
  btn.disabled = true;
  document.getElementById('entrenamientoProgress').style.display = 'block';

  try {
    const response = await fetch(`${API_URL}/api/modelo/prediccion/entrenar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();

    if (data.success) {
      alert(`✅ Modelo reentrenado exitosamente!\n\nTipos de denuncias: ${data.tipos_denuncias}\nTipos de emergencias: ${data.tipos_emergencias}`);
      location.reload();
    } else {
      alert('Error: ' + data.error);
    }
  } catch (error) {
    alert('Error de conexión: ' + error.message);
  } finally {
    btn.disabled = false;
    document.getElementById('entrenamientoProgress').style.display = 'none';
  }
}