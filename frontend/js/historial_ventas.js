async function cargarVentas() {
    const response = await fetch('http://127.0.0.1:8000/api/ventas/historial/');

    const ventas = await response.json();

    const tabla = document.getElementById('tablaVentas');

    tabla.innerHTML = '';

    ventas.forEach(venta => {
        tabla.innerHTML += `
            <tr>
                <td>${venta.ticket}</td>
                <td>${venta.fecha}</td>
                <td>${venta.usuario}</td>
                <td>${venta.cliente}</td>
                <td>${venta.metodo_pago}</td>
                <td>Gs. ${venta.total}</td>
            </tr>
        `;
    });
}

cargarVentas();