let carrito = [];
let total = 0;

document.getElementById("usuarioInfo").innerText =
    localStorage.getItem("username") + 
    " (" + localStorage.getItem("rol") + ")";

const input = document.getElementById("codigo");
const resultadosDiv = document.getElementById("resultados");

function logout() {
    localStorage.clear();
    window.location.href = "../login.html";
}

function calcularVuelto() {
    const recibido = parseFloat(document.getElementById("recibido").value) || 0;
    const vuelto = recibido - total;

    document.getElementById("vuelto").innerText =
        vuelto >= 0 ? vuelto : 0;
}

input.addEventListener("keyup", function() {
    const termino = this.value.trim();
    if (termino.length < 2) {
        resultadosDiv.innerHTML = "";
        return;
    }

    

    fetch(`http://127.0.0.1:8000/api/inventario/buscar/${termino}/`)
        .then(res => res.json())
        .then(data => {
            resultadosDiv.innerHTML = "";

            if (data.error) return;

            data.forEach(producto => {
                const div = document.createElement("div");
                div.innerText = `${producto.nombre} - ${producto.precio}`;
                div.onclick = () => {
                    agregarAlCarrito(producto);
                    resultadosDiv.innerHTML = "";
                    input.value = "";
                };
                resultadosDiv.appendChild(div);
            });
        });
});

function agregarAlCarrito(producto) {
    let existente = carrito.find(p => p.id === producto.id);

    if (existente) {
        existente.cantidad += 1;
        existente.subtotal = existente.cantidad * existente.precio;
    } else {
        carrito.push({
            id: producto.id,
            nombre: producto.nombre,
            precio: producto.precio,
            cantidad: 1,
            subtotal: producto.precio
        });
    }

    actualizarTabla();
}

function actualizarTabla() {
    const tabla = document.getElementById("tabla");
    tabla.innerHTML = "";
    total = 0;

    carrito.forEach((p, index) => {
        total += p.subtotal;

        tabla.innerHTML += `
            <tr>
                <td>${p.nombre}</td>
                <td>${p.cantidad}</td>
                <td>${p.precio}</td>
                <td>${p.subtotal}</td>
                <td><button onclick="eliminarProducto(${index})">X</button></td>
            </tr>
        `;
    });

    document.getElementById("total").innerText = total;
}

function eliminarProducto(index) {
    carrito.splice(index, 1);
    actualizarTabla();
}

function finalizarVenta() {

    const recibido = parseFloat(document.getElementById("recibido").value) || 0;

    if (recibido < total && document.getElementById("metodo_pago").value === "EFECTIVO") {
        alert("Dinero insuficiente");
        return;
    }

    const metodoPago = document.getElementById("metodo_pago").value;

    if(metodoPago === "LIBRETA" && !clienteSeleccionado){

        alert("Seleccione o escriba el nombre del cliente.");

        return;

    }
    console.log(clienteSeleccionado);
    fetch("http://127.0.0.1:8000/api/ventas/crear/", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify({

        metodo_pago: metodoPago,

        cliente_nombre:
            metodoPago === "LIBRETA"
                ? clienteSeleccionado
                : "",

        productos: carrito.map(p => ({

            id: p.id,

            cantidad: p.cantidad

        }))

    })
})
    .then(async res => {

        const data = await res.json();

        console.log("Respuesta del servidor:", data);
        console.log("Status:", res.status);

        if (!res.ok) {

            alert(JSON.stringify(data));

            return;

        }

        // continúa el resto del código...

        localStorage.setItem("ticket", JSON.stringify({

            productos: carrito,

            total: total

        }));

        window.open("ticket.html","_blank");

        generarTicket();

        carrito = [];

        actualizarTabla();

        document.getElementById("recibido").value = "";

        document.getElementById("vuelto").innerText = 0;

        alert("Venta realizada correctamente");

    });
}

function generarTicket() {

    let contenido = `
        <h2>MINIMERCADO</h2>
        <hr>
    `;

    carrito.forEach(p => {
        contenido += `
            <p>${p.nombre} x${p.cantidad} - ${p.subtotal}</p>
        `;
    });

    contenido += `
        <hr>
        <h3>Total: ${total}</h3>
        <p>Gracias por su compra</p>
    `;

    const ventana = window.open('', '', 'width=300,height=600');
    ventana.document.write(contenido);
    ventana.document.close();
    ventana.print();
}

function verCierre() {

    fetch("http://127.0.0.1:8000/api/ventas/cierre/", {
        method: "GET",
        headers: {
            "Authorization": "Bearer " + localStorage.getItem("token")
        }
    })
    .then(res => res.json())
    .then(data => {

        alert(`
Cierre de Caja - ${data.usuario}
Fecha: ${data.fecha}

Ventas realizadas: ${data.cantidad_ventas}

Total General: ${data.total_general}

Efectivo: ${data.efectivo}
Tarjeta: ${data.tarjeta}
Transferencia: ${data.transferencia}
        `);

    });
}

function abrirCaja() {

    fetch("http://127.0.0.1:8000/api/ventas/abrir-caja/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({
            monto_inicial: document.getElementById("monto_inicial").value
        })
    })
    .then(res => res.json())
    .then(data => alert(data.mensaje || data.error));
}


function cerrarCaja() {

    fetch("http://127.0.0.1:8000/api/ventas/cerrar-caja/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({
            monto_cierre: document.getElementById("monto_cierre").value
        })
    })
    .then(res => res.json())
    .then(data => {

        if (data.error) {
            alert(data.error);
            return;
        }

        alert(`
Cierre realizado:

Total vendido: ${data.total_vendido}
Monto inicial: ${data.monto_inicial}
Monto contado: ${data.monto_cierre}

Diferencia: ${data.diferencia}
        `);
    });
}

const rol = localStorage.getItem("rol")

if(rol === "CAJERO"){

const dash = document.getElementById("menuDashboard")

if(dash){
dash.style.display="none"
}

}

document
.getElementById("metodo_pago")
.addEventListener("change", function(){

    document.getElementById("bloqueLibreta").style.display =

        this.value === "LIBRETA"

        ? "block"

        : "none";

});

let clienteSeleccionado = null;

document
.getElementById("clienteLibreta")
.addEventListener("input", buscarLibreta);

async function buscarLibreta(){

    const texto = document
        .getElementById("clienteLibreta")
        .value
        .trim();

    if(texto.length < 2){

        document.getElementById("sugerenciasLibreta").innerHTML = "";

        clienteSeleccionado = null;

        return;

    }

    const res = await fetch(

        `http://127.0.0.1:8000/api/ventas/libreta/buscar/?q=${texto}`,

        {

            headers:{
                "Authorization":"Bearer " + localStorage.getItem("token")
            }

        }

    );

    const data = await res.json();

    let html = "";

    data.forEach(c=>{

        html += `

        <div class="item-libreta"

            onclick="seleccionarCliente('${c.nombre}')">

            <strong>${c.nombre}</strong>

            <br>

            Saldo:

            Gs. ${Number(c.saldo).toLocaleString()}

        </div>

        `;

    });

    if(data.length===0){

        html += `

        <div class="item-crear"

            onclick="crearClienteNuevo()">

            ➕ Crear libreta para

            <strong>${texto}</strong>

        </div>

        `;

    }

    document.getElementById("sugerenciasLibreta").innerHTML = html;

}

function seleccionarCliente(nombre){

    clienteSeleccionado = nombre;

    document.getElementById("clienteLibreta").value = nombre;

    document.getElementById("sugerenciasLibreta").innerHTML = "";

}

function crearClienteNuevo(){

    clienteSeleccionado =

        document
        .getElementById("clienteLibreta")
        .value;

    document.getElementById("sugerenciasLibreta").innerHTML = "";

}