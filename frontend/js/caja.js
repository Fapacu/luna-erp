let carrito = []
let total = 0
let productoTemp = null

const token = localStorage.getItem("token")

if (!token) {
    window.location.href = "../login.html"
}

const headers = {
    "Content-Type":"application/json",
    "Authorization":"Bearer " + token
}


/* ======================
LOGOUT
====================== */

function logout(){

    localStorage.clear()

    window.location.href = "../login.html"
}


/* ======================
SONIDO
====================== */

function beep(){

    new Audio(
        "https://www.soundjay.com/buttons/sounds/button-16.mp3"
    ).play()
}


/* ======================
BUSCAR PRODUCTO
====================== */

const input =
document.getElementById("busquedaProducto")

input.addEventListener("input", function(){

    const query = input.value.trim()

    if(query.length < 2){

        document.getElementById(
            "sugerencias"
        ).innerHTML = ""

        return
    }

    fetch(

        `http://127.0.0.1:8000/api/inventario/buscar/?q=${query}`,

        {
            headers:{
                "Authorization":"Bearer " + token
            }
        }
    )

    .then(res => res.json())

    .then(data => {

        const cont =
        document.getElementById(
            "sugerencias"
        )

        cont.innerHTML = ""

        data.forEach(p => {

            cont.innerHTML += `
            <div
            onclick='seleccionarProducto(${JSON.stringify(p)})'

            style="
            padding:10px;
            cursor:pointer;
            border-bottom:1px solid #eee;
            transition:0.2s;
            ">

                ${p.nombre}

            </div>
            `
        })

    })

})


/* ======================
SELECCIONAR PRODUCTO
====================== */

function seleccionarProducto(p){

    document.getElementById(
        "sugerencias"
    ).innerHTML = ""

    document.getElementById(
        "busquedaProducto"
    ).value = ""

    beep()

    if(p.unidad === "kg"){

        productoTemp = p

        document.getElementById(
            "modalCantidad"
        ).style.display = "flex"

        document.getElementById(
            "nombreProductoModal"
        ).innerText = p.nombre

        return
    }

    agregarProducto(p, 1)
}


/* ======================
KG
====================== */

function confirmarCantidad(){

    const cantidad = parseFloat(
        document.getElementById(
            "inputCantidadKg"
        ).value
    )

    if(!cantidad || cantidad <= 0){

        alert("Cantidad inválida")

        return
    }

    agregarProducto(
        productoTemp,
        cantidad
    )

    cerrarModalCantidad()
}


function cerrarModalCantidad(){

    document.getElementById(
        "modalCantidad"
    ).style.display = "none"

    document.getElementById(
        "inputCantidadKg"
    ).value = ""

    productoTemp = null
}


/* ======================
AGREGAR PRODUCTO
====================== */

function agregarProducto(p, cantidad){

    let existente = carrito.find(
        item => item.id === p.id
    )

    if(existente){

        existente.cantidad += cantidad

        existente.total =
        existente.cantidad *
        existente.precio

    }else{

        carrito.push({

            id: p.id,

            nombre: p.nombre,

            precio: parseFloat(
                p.precio_venta
            ),

            cantidad: cantidad,

            total:
            parseFloat(
                p.precio_venta
            ) * cantidad,

            unidad: p.unidad
        })
    }

    calcularTotal()

    renderTabla()
}


/* ======================
TABLA
====================== */

function renderTabla(){

    const tabla =
    document.getElementById(
        "tablaVentas"
    )

    tabla.innerHTML = ""

    carrito.forEach((item, index) => {

        tabla.innerHTML += `
        <tr>

            <td>

                ${item.nombre}

                <br>

                <small style="color:#999;">

                    ${item.unidad === "kg"
                    ? "Por peso"
                    : "Unidad"}

                </small>

            </td>

            <td>

                <button
                onclick="cambiarCantidad(${index}, -1)">
                    -
                </button>

                ${item.cantidad}

                ${item.unidad === "kg"
                ? "kg"
                : ""}

                <button
                onclick="cambiarCantidad(${index}, 1)">
                    +
                </button>

            </td>

            <td>

                Gs.
                ${item.precio.toLocaleString('es-CL')}

            </td>

            <td>

                Gs.
                ${item.total.toLocaleString('es-CL')}

            </td>

            <td>

                <button
                onclick="eliminarProducto(${index})">

                    ❌

                </button>

            </td>

        </tr>
        `
    })

}


/* ======================
CANTIDAD
====================== */

function cambiarCantidad(index, cambio){

    carrito[index].cantidad += cambio

    if(carrito[index].cantidad <= 0){

        carrito.splice(index, 1)

    }else{

        carrito[index].total =
        carrito[index].cantidad *
        carrito[index].precio
    }

    calcularTotal()

    renderTabla()
}


/* ======================
ELIMINAR
====================== */

function eliminarProducto(index){

    carrito.splice(index, 1)

    calcularTotal()

    renderTabla()
}


/* ======================
TOTAL
====================== */

function calcularTotal(){

    total = carrito.reduce(
        (acc, item) => acc + item.total,
        0
    )

    document.getElementById(
        "totalVenta"
    ).innerText =
    "Gs. " + total.toLocaleString('es-CL')

    calcularVuelto()
}


/* ======================
VUELTO
====================== */

function calcularVuelto(){

    const recibido =
    parseFloat(

        document.getElementById(
            "montoRecibido"
        )?.value

    ) || 0

    const vuelto = recibido - total

    document.getElementById(
        "vuelto"
    ).innerText =
    "Gs. " +
    vuelto.toLocaleString('es-CL')
}


document.getElementById(
    "montoRecibido"
)?.addEventListener(
    "input",
    calcularVuelto
)


/* ======================
FINALIZAR VENTA
====================== */

function finalizarVenta(){

    if(carrito.length === 0){

        alert("No hay productos")

        return
    }

    const metodo_pago =
    document.getElementById(
        "metodoPago"
    ).value

    const cliente_nombre = clienteSeleccionado;

    const recibido =
    parseFloat(

        document.getElementById(
            "montoRecibido"
        )?.value

    ) || 0

    if(
        metodo_pago === "LIBRETA"
        &&
        !clienteSeleccionado
    ){

        alert(
            "Ingrese nombre del cliente"
        )

        return
    }

    if(
        metodo_pago === "EFECTIVO"
        &&
        recibido < total
    ){

        alert("Dinero insuficiente")

        return
    }

    const btnCobrar =
    document.querySelector(
        ".btn-cobrar"
    )

    btnCobrar.disabled = true

    btnCobrar.innerText =
    "Procesando..."

    fetch(
        "http://127.0.0.1:8000/api/ventas/",
        {

            method:"POST",

            headers: headers,

            body: JSON.stringify({

                productos: carrito,

                metodo_pago,

                cliente_nombre
            })
        }
    )

    .then(async res => {

        const text =
        await res.text()

        let data

        try{

            data = JSON.parse(text)

        }catch{

            console.error(text)

            throw new Error(
                "Error interno servidor"
            )
        }

        if(!res.ok){

            throw new Error(
                data.error || "Error"
            )
        }

        return data
    })

    .then(data => {

        alert(
            "Venta realizada"
        )

        carrito = []

        total = 0

        renderTabla()

        calcularTotal()

        mostrarCajaActual()

        document.getElementById(
            "montoRecibido"
        ).value = ""

        calcularVuelto()

        btnCobrar.disabled = false

        btnCobrar.innerText =
        "💰 COBRAR"

    })

    .catch(error => {

        console.error(error)

        alert(error.message)

        btnCobrar.disabled = false

        btnCobrar.innerText =
        "💰 COBRAR"

    })
}


/* ======================
CAJA ACTUAL ERP
====================== */

function mostrarCajaActual(){

    fetch(

        "http://127.0.0.1:8000/api/ventas/caja/actual/",

        {
            headers:{
                "Authorization":"Bearer " + token
            }
        }
    )

    .then(async res => {

        const data = await res.json();

        if(!res.ok){

            throw new Error(
                data.error || "Error obteniendo caja"
            );
        }

        return data;
    })

    .then(data => {

        console.log("Caja actual:", data);

        document.getElementById(
            "cajaInicial"
        ).innerText =
        "Gs. " +
        Number(data.monto_inicial || 0)
        .toLocaleString();

        document.getElementById(
            "cajaVentas"
        ).innerText =
        "Gs. " +
        Number(data.ingresos || 0)
        .toLocaleString();

        document.getElementById(
            "cajaTotal"
        ).innerText =
        "Gs. " +
        Number(data.total || 0)
        .toLocaleString();



        /*
        ==========================
        KPIs
        ==========================
        */

        if(document.getElementById("kpiIngresos")){

            document.getElementById(
                "kpiIngresos"
            ).innerText =
            "Gs. " +
            Number(data.ingresos || 0)
            .toLocaleString();

            document.getElementById(
                "kpiRetiros"
            ).innerText =
            "Gs. " +
            Number(data.retiros || 0)
            .toLocaleString();

            document.getElementById(
                "kpiGastos"
            ).innerText =
            "Gs. " +
            Number(data.gastos || 0)
            .toLocaleString();
        }



        /*
        ==========================
        ESTADISTICAS
        ==========================
        */

        if(document.getElementById("ventasHoy")){

            document.getElementById(
                "ventasHoy"
            ).innerText =
            data.ventas_hoy || 0;
        }

        if(document.getElementById("productosHoy")){

            document.getElementById(
                "productosHoy"
            ).innerText =
            data.productos_hoy || 0;
        }

    })

    .catch(error => {

        console.error(
            "Error caja actual:",
            error
        );
    });

}

/* ======================
RETIRO ERP
====================== */

async function registrarRetiro(){

    const descripcion =
    document.getElementById(
        "retiroDescripcion"
    ).value

    const monto =
    document.getElementById(
        "retiroMonto"
    ).value

    const res = await fetch(

        "http://127.0.0.1:8000/api/ventas/retiro/",

        {

            method:"POST",

            headers: headers,

            body: JSON.stringify({
                descripcion,
                monto
            })
        }
    )

    const data = await res.json()

    alert(
        data.success
        ? "Retiro registrado"
        : data.error
    )

    mostrarCajaActual()
}


/* ======================
GASTO ERP
====================== */

async function registrarGasto(){

    const descripcion =
    document.getElementById(
        "gastoDescripcion"
    ).value

    const monto =
    document.getElementById(
        "gastoMonto"
    ).value

    const res = await fetch(

        "http://127.0.0.1:8000/api/ventas/gasto/",

        {

            method:"POST",

            headers: headers,

            body: JSON.stringify({
                descripcion,
                monto
            })
        }
    )

    const data = await res.json()

    alert(
        data.success
        ? "Gasto registrado"
        : data.error
    )

    mostrarCajaActual()
}


/* ======================
ESTADO CAJA
====================== */

function verificarCaja(){

    fetch(

        "http://127.0.0.1:8000/api/ventas/caja/estado/",

        {
            headers:{
                "Authorization":"Bearer " + token
            }
        }
    )

    .then(res => res.json())

    .then(data => {

        const btnAbrir =
        document.getElementById(
            "btnAbrir"
        )

        const btnCerrar =
        document.getElementById(
            "btnCerrar"
        )

        const estado =
        document.getElementById(
            "estadoCaja"
        )

        if(data.abierta){

            btnAbrir.style.display =
            "none"

            btnCerrar.style.display =
            "inline-block"

            estado.innerText =
            "🟢 ABIERTA"

            estado.style.color =
            "green"

        }else{

            btnAbrir.style.display =
            "inline-block"

            btnCerrar.style.display =
            "none"

            estado.innerText =
            "🔴 CERRADA"

            estado.style.color =
            "red"
        }

    })

}


/* ======================
ABRIR CAJA
====================== */

function abrirCaja(){

    const monto =
    prompt("Ingrese monto inicial");

    if(!monto) return;

    fetch(

        "http://127.0.0.1:8000/api/ventas/caja/abrir/",

        {

            method:"POST",

            headers: headers,

            body: JSON.stringify({
                monto_inicial: monto
            })
        }
    )

    .then(async res => {

        const data = await res.json();

        if(!res.ok){

            throw new Error(
                data.error || "Error abriendo caja"
            );
        }

        return data;
    })

    .then(data => {

        alert("✅ Caja abierta correctamente");

        verificarCaja();

        mostrarCajaActual();

    })

    .catch(error => {

        console.error(error);

        alert(error.message);

    });

}

/* ======================
CERRAR CAJA
====================== */

function cerrarCaja(){

    const montoReal =
    prompt(
        "Ingrese dinero contado en caja"
    );

    if(!montoReal) return;

    fetch(

        "http://127.0.0.1:8000/api/ventas/caja/cerrar/",

        {

            method:"POST",

            headers: headers,

            body: JSON.stringify({
                monto_real: montoReal
            })
        }
    )

    .then(async res => {

        const data = await res.json();

        if(!res.ok){

            throw new Error(
                data.error || "Error cerrando caja"
            );
        }

        return data;
    })

    .then(data => {

        alert(`

✅ Caja cerrada

Sistema:
Gs. ${Number(data.monto_sistema).toLocaleString()}

Real:
Gs. ${Number(data.monto_real).toLocaleString()}

Diferencia:
Gs. ${Number(data.diferencia).toLocaleString()}

`);

        verificarCaja();

        mostrarCajaActual();

    })

    .catch(error => {

        console.error(error);

        alert(error.message);

    });

}

/* ======================
ATAJOS
====================== */

document.addEventListener(
    "keydown",
    function(e){

    if(e.key === "F9"){

        e.preventDefault()

        finalizarVenta()
    }

    if(e.key === "Escape"){

        carrito = []

        renderTabla()

        calcularTotal()
    }

})


/* ======================
LIBRETA
====================== */

document.getElementById(
    "metodoPago"
).addEventListener(
    "change",
    function(){

        const libretaBox =
        document.getElementById(
            "bloqueLibreta"
        )

        if(this.value === "LIBRETA"){

            libretaBox.style.display =
            "block"

        }else{

            libretaBox.style.display =
            "none"
        }
    }
)


/* ======================
INICIO
====================== */

window.onload = function(){

    verificarCaja()

    mostrarCajaActual()

    setInterval(
        mostrarCajaActual,
        5000
    )

}

let clienteSeleccionado = "";

document
.getElementById("clienteLibreta")
.addEventListener("input", buscarLibreta);

async function buscarLibreta(){

    const texto =
    document
    .getElementById("clienteLibreta")
    .value
    .trim();

    if(texto.length < 2){

        document
        .getElementById("sugerenciasLibreta")
        .innerHTML = "";

        clienteSeleccionado = "";

        return;
    }

    const res = await fetch(

        `http://127.0.0.1:8000/api/ventas/libreta/buscar/?q=${texto}`,

        {
            headers:{
                "Authorization":"Bearer " + token
            }
        }

    );

    const data = await res.json();

    let html = "";

    data.forEach(c=>{

        html += `

        <div class="item-libreta"
            onclick="seleccionarCliente('${c.nombre}')">

            <strong>${c.nombre}</strong><br>

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

    document.getElementById(
        "sugerenciasLibreta"
    ).innerHTML = html;

}

function seleccionarCliente(nombre){

    clienteSeleccionado = nombre;

    document.getElementById(
        "clienteLibreta"
    ).value = nombre;

    document.getElementById(
        "sugerenciasLibreta"
    ).innerHTML = "";

}

function crearClienteNuevo(){

    clienteSeleccionado =
    document
    .getElementById("clienteLibreta")
    .value;

    document.getElementById(
        "sugerenciasLibreta"
    ).innerHTML = "";

}

