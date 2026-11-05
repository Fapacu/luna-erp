async function cargarVentas() {
    const response = await fetch('https://berry-previews-compensation-big.trycloudflare.com/api/ventas/historial/');

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





