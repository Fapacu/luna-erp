let productoActual = null;

// 🔓 ABRIR MODAL
function abrirModal(id) {
    productoActual = id;
    document.getElementById("modalStock").style.display = "flex";
}

// ❌ CERRAR MODAL
function cerrarModal() {
    document.getElementById("modalStock").style.display = "none";
}

// 💾 GUARDAR AJUSTE
function guardarAjuste() {

    const cantidad = document.getElementById("cantidad").value;
    const motivo = document.getElementById("motivo").value;

    if (!cantidad) {
        alert("Ingresa cantidad");
        return;
    }

    fetch("http://127.0.0.1:8000/api/inventario/ajustar-stock/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({
            producto_id: productoActual,
            cantidad: parseInt(cantidad),
            motivo: motivo
        })
    })
    .then(res => res.json())
    .then(() => {
        cerrarModal();
        cargarProductos();
    });
}


// 📦 CARGAR PRODUCTOS
function cargarProductos() {

    fetch("http://127.0.0.1:8000/api/productos/", {
        headers: {
            "Authorization": "Bearer " + localStorage.getItem("token")
        }
    })
    .then(res => res.json())
    .then(data => {

        const tabla = document.getElementById("tablaProductos");
        tabla.innerHTML = "";

        data.forEach(p => {

            tabla.innerHTML += `
                <tr>
                    <td>${p.nombre}</td>
                    <td>${p.stock}</td>
                    <td>${p.stock_minimo}</td>
                    <td>
                        <button onclick="abrirModal(${p.id})">⚙</button>
                    </td>
                </tr>
            `;
        });

    });
}


// 🚀 AUTOLOAD
window.onload = cargarProductos;