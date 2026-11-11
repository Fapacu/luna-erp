let carrito = []
let total = 0
let productoTemp = null
let cajaSeleccionada = localStorage.getItem("cajaSeleccionada") || ""
const ventasStorageKey = "minimercado_ventas_abiertas:" + (localStorage.getItem("username") || "usuario")
let ventasAbiertas = []
let ventaActivaId = null
let cobroEnProceso = false
const escapeHtml = window.escapeHtml

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

    localStorage.removeItem("token")
    localStorage.removeItem("usuario")
    localStorage.removeItem("rol")
    localStorage.removeItem("username")

    window.location.href = "../login.html"
}

function persistirVentaActiva(){
    if (!ventaActivaId) return
    const venta = ventasAbiertas.find(item => item.id === ventaActivaId)
    if (!venta) return
    venta.carrito = carrito.map(item => ({...item}))
    venta.metodo_pago = document.getElementById("metodoPago")?.value || "EFECTIVO"
    venta.monto_recibido = document.getElementById("montoRecibido")?.value || ""
    venta.cliente = document.getElementById("clienteLibreta")?.value || ""
    venta.cliente_seleccionado = clienteSeleccionado || ""
    venta.comprobante = window.leerFormularioComprobante ? window.leerFormularioComprobante() : null
    venta.caja_id = cajaSeleccionada || ""
    try {
        localStorage.setItem(ventasStorageKey, JSON.stringify(ventasAbiertas))
        localStorage.setItem(ventasStorageKey + ":activa", ventaActivaId)
    } catch (error) {
        console.error("No se pudieron guardar las ventas abiertas", error)
    }
    renderVentasAbiertas()
}

function renderVentasAbiertas(){
    const lista = document.getElementById("listaVentasAbiertas")
    if (!lista) return
    lista.replaceChildren()
    ventasAbiertas.forEach((venta, indice) => {
        const tab = document.createElement("div")
        tab.className = "venta-abierta" + (venta.id === ventaActivaId ? " activa" : "")
        const seleccionar = document.createElement("button")
        seleccionar.type = "button"
        seleccionar.className = "venta-abierta-seleccionar"
        const suma = (venta.carrito || []).reduce((acc, item) => acc + Number(item.total || 0), 0)
        seleccionar.textContent = `${venta.nombre || `Venta ${indice + 1}`} · Gs. ${suma.toLocaleString("es-PY")}`
        seleccionar.setAttribute("aria-current", venta.id === ventaActivaId ? "true" : "false")
        seleccionar.addEventListener("click", () => cambiarVentaActiva(venta.id))
        const cerrar = document.createElement("button")
        cerrar.type = "button"
        cerrar.className = "venta-abierta-cerrar"
        cerrar.textContent = "×"
        cerrar.setAttribute("aria-label", `Eliminar ${venta.nombre || `Venta ${indice + 1}`}`)
        cerrar.addEventListener("click", () => eliminarVentaAbierta(venta.id))
        tab.append(seleccionar, cerrar)
        lista.append(tab)
    })
}

function crearVentaNueva(){
    if (cobroEnProceso) return
    if (carrito.length && !confirm("La venta actual quedará guardada para continuarla después. ¿Abrir otra venta?")) return
    persistirVentaActiva()
    const id = `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    ventasAbiertas.push({id, nombre: `Venta ${ventasAbiertas.length + 1}`, carrito: [], metodo_pago: "EFECTIVO", monto_recibido: "", cliente: "", cliente_seleccionado: "", caja_id: cajaSeleccionada})
    ventaActivaId = id
    carrito = []
    clienteSeleccionado = ""
    document.getElementById("metodoPago").value = "EFECTIVO"
    document.getElementById("montoRecibido").value = ""
    document.getElementById("clienteLibreta").value = ""
    document.getElementById("bloqueLibreta").style.display = "none"
    document.getElementById("sugerenciasLibreta").innerHTML = ""
    window.cargarFormularioComprobante?.(null)
    renderTabla()
    calcularTotal()
    persistirVentaActiva()
    document.getElementById("busquedaProducto")?.focus()
}

function cambiarVentaActiva(id){
    if (cobroEnProceso) return
    if (id === ventaActivaId) return
    persistirVentaActiva()
    const venta = ventasAbiertas.find(item => item.id === id)
    if (!venta) return
    ventaActivaId = id
    carrito = (venta.carrito || []).map(item => ({...item}))
    clienteSeleccionado = venta.cliente_seleccionado || ""
    if (venta.caja_id) {
        cajaSeleccionada = String(venta.caja_id)
        localStorage.setItem("cajaSeleccionada", cajaSeleccionada)
        document.getElementById("selectorCaja").value = cajaSeleccionada
    }
    document.getElementById("metodoPago").value = venta.metodo_pago || "EFECTIVO"
    document.getElementById("montoRecibido").value = venta.monto_recibido || ""
    document.getElementById("clienteLibreta").value = venta.cliente || ""
    document.getElementById("bloqueLibreta").style.display = venta.metodo_pago === "LIBRETA" ? "block" : "none"
    window.cargarFormularioComprobante?.(venta.comprobante)
    renderTabla()
    calcularTotal()
    renderVentasAbiertas()
    verificarCaja()
    mostrarCajaActual()
}

function eliminarVentaAbierta(id){
    if (cobroEnProceso) return
    const venta = ventasAbiertas.find(item => item.id === id)
    if (venta?.carrito?.length && !confirm("¿Eliminar esta venta pendiente y sus productos?")) return
    ventasAbiertas = ventasAbiertas.filter(item => item.id !== id)
    try { localStorage.setItem(ventasStorageKey, JSON.stringify(ventasAbiertas)) } catch (error) { console.error(error) }
    if (ventaActivaId === id) {
        ventaActivaId = null
        carrito = []
        clienteSeleccionado = ""
        if (!ventasAbiertas.length) {
            const nueva = {id: `v-${Date.now()}`, nombre: "Venta 1", carrito: [], metodo_pago: "EFECTIVO", monto_recibido: "", cliente: "", cliente_seleccionado: ""}
            ventasAbiertas.push(nueva)
        }
        cambiarVentaActiva(ventasAbiertas[0].id)
    } else {
        renderVentasAbiertas()
    }
}

function completarVentaActiva(){
    ventasAbiertas = ventasAbiertas.filter(item => item.id !== ventaActivaId)
    ventaActivaId = null
    carrito = []
    clienteSeleccionado = ""
    if (!ventasAbiertas.length) {
        ventasAbiertas.push({id: `v-${Date.now()}`, nombre: "Venta 1", carrito: [], metodo_pago: "EFECTIVO", monto_recibido: "", cliente: "", cliente_seleccionado: ""})
    }
    try { localStorage.setItem(ventasStorageKey, JSON.stringify(ventasAbiertas)) } catch (error) { console.error(error) }
    cambiarVentaActiva(ventasAbiertas[0].id)
}

function restaurarVentasAbiertas(){
    try {
        const guardadas = JSON.parse(localStorage.getItem(ventasStorageKey) || "[]")
        ventasAbiertas = Array.isArray(guardadas) ? guardadas : []
    } catch { ventasAbiertas = [] }
    if (!ventasAbiertas.length) {
        ventasAbiertas = [{id: `v-${Date.now()}`, nombre: "Venta 1", carrito: [], metodo_pago: "EFECTIVO", monto_recibido: "", cliente: "", cliente_seleccionado: ""}]
    }
    const idGuardado = localStorage.getItem(ventasStorageKey + ":activa")
    ventaActivaId = ventasAbiertas.some(item => item.id === idGuardado) ? idGuardado : ventasAbiertas[0].id
    const venta = ventasAbiertas.find(item => item.id === ventaActivaId)
    carrito = (venta.carrito || []).map(item => ({...item}))
    clienteSeleccionado = venta.cliente_seleccionado || ""
    if (venta.caja_id) {
        cajaSeleccionada = String(venta.caja_id)
        localStorage.setItem("cajaSeleccionada", cajaSeleccionada)
    }
    document.getElementById("metodoPago").value = venta.metodo_pago || "EFECTIVO"
    document.getElementById("montoRecibido").value = venta.monto_recibido || ""
    document.getElementById("clienteLibreta").value = venta.cliente || ""
    document.getElementById("bloqueLibreta").style.display = venta.metodo_pago === "LIBRETA" ? "block" : "none"
    window.cargarFormularioComprobante?.(venta.comprobante)
    renderTabla()
    calcularTotal()
    renderVentasAbiertas()
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
        window.apiUrl(`inventario/buscar/?q=${encodeURIComponent(query)}`),

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

        cont.replaceChildren()

        data.forEach(p => {
            const opcion = document.createElement("button")
            opcion.type = "button"
            opcion.className = "sugerencia-item"
            opcion.textContent = p.nombre
            opcion.addEventListener("click", () => seleccionarProducto(p))
            cont.append(opcion)
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

    if(!cantidad || cantidad <= 0 || redondearCantidad(cantidad) <= 0){

        alert("Cantidad inválida (hasta 3 decimales, por ejemplo 0,250 kg)")

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

function redondearCantidad(valor){
    return Math.round(Number(valor) * 1000) / 1000
}

function agregarProducto(p, cantidad){

    cantidad = redondearCantidad(cantidad)

    let existente = carrito.find(
        item => item.id === p.id
    )

    if(existente){

        existente.cantidad = redondearCantidad(existente.cantidad + cantidad)

        existente.total = Math.round(
            existente.cantidad *
            existente.precio
        )

    }else{

        carrito.push({

            id: p.id,

            nombre: p.nombre,

            precio: parseFloat(
                p.precio_venta
            ),

            cantidad: cantidad,

            total: Math.round(
                parseFloat(
                    p.precio_venta
                ) * cantidad
            ),

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

                ${escapeHtml(item.nombre)}

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
                ${item.precio.toLocaleString('es-PY')}

            </td>

            <td>

                Gs.
                ${item.total.toLocaleString('es-PY')}

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

    carrito[index].cantidad = redondearCantidad(carrito[index].cantidad + cambio)

    if(carrito[index].cantidad <= 0){

        carrito.splice(index, 1)

    }else{

        carrito[index].total = Math.round(
            carrito[index].cantidad *
            carrito[index].precio
        )
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
    "Gs. " + total.toLocaleString('es-PY')

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
    vuelto.toLocaleString('es-PY')

    persistirVentaActiva()
}


document.getElementById(
    "montoRecibido"
)?.addEventListener(
    "input",
    () => {
        calcularVuelto()
        persistirVentaActiva()
    }
)


/* ======================
FINALIZAR VENTA
====================== */

function finalizarVenta(){

    if(cobroEnProceso) return

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

    let datosComprobante

    try{
        datosComprobante = window.obtenerDatosComprobante
            ? window.obtenerDatosComprobante()
            : { comprobante: "TICKET" }
    }catch(error){
        alert(error.message)
        document.getElementById("facturaDocumento")?.focus()
        return
    }

    const btnCobrar =
    document.querySelector(
        ".btn-cobrar"
    )

    btnCobrar.disabled = true
    cobroEnProceso = true

    btnCobrar.innerText =
    "Procesando..."

    fetch(
        window.apiUrl("ventas/"),
        {

            method:"POST",

            headers: headers,

            body: JSON.stringify({

                productos: carrito,

                metodo_pago,

                cliente_nombre,
                caja_id: cajaSeleccionada,
                ...datosComprobante
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

        cobroEnProceso = false

        const documento = data.factura ? `factura N.º ${data.factura}` : "ticket"

        const imprimir = confirm(
            `Venta realizada (${data.ticket}).\n` +
            (data.factura ? `Factura emitida: ${data.factura}\n` : "") +
            `Total: Gs. ${Number(data.total).toLocaleString('es-PY')}\n\n` +
            `¿Imprimir ${documento}?`
        )

        if(imprimir){
            if(data.factura){
                window.imprimirFactura(data.venta_id)
            }else{
                window.imprimirTicket(data.venta_id)
            }
        }

        completarVentaActiva()

        mostrarCajaActual()

        btnCobrar.disabled = false

        btnCobrar.innerText =
        "💰 COBRAR"

    })

    .catch(error => {

        cobroEnProceso = false

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

        window.apiUrl(`ventas/caja/actual/?caja_id=${encodeURIComponent(cajaSeleccionada)}`),

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

        window.apiUrl("ventas/retiro/"),

        {

            method:"POST",

            headers: headers,

            body: JSON.stringify({
                descripcion,
                monto,
                caja_id: cajaSeleccionada
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

        window.apiUrl("ventas/gasto/"),

        {

            method:"POST",

            headers: headers,

            body: JSON.stringify({
                descripcion,
                monto,
                caja_id: cajaSeleccionada
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

function seleccionarCaja(id){
    cajaSeleccionada = id || "";
    if (cajaSeleccionada) localStorage.setItem("cajaSeleccionada", cajaSeleccionada);
    else localStorage.removeItem("cajaSeleccionada");
    persistirVentaActiva()
    verificarCaja();
    mostrarCajaActual();
}

function verificarCaja(){

    fetch(

        window.apiUrl("ventas/caja/estado/"),

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

        const selector = document.getElementById("selectorCaja");
        selector.innerHTML = data.cajas.length
            ? data.cajas.map(c => `<option value="${c.id}">Caja #${c.id} · ${escapeHtml(c.usuario)}</option>`).join("")
            : '<option value="">Sin cajas abiertas</option>';
        if (!data.cajas.some(c => String(c.id) === String(cajaSeleccionada))) {
            cajaSeleccionada = data.cajas.length ? String(data.cajas[0].id) : "";
            if (cajaSeleccionada) localStorage.setItem("cajaSeleccionada", cajaSeleccionada);
            else localStorage.removeItem("cajaSeleccionada");
        }
        selector.value = cajaSeleccionada;
        const abierta = Boolean(cajaSeleccionada);
        btnAbrir.style.display = "inline-block";
        btnCerrar.style.display = abierta ? "inline-block" : "none";
        estado.innerText = abierta ? `🟢 ABIERTA · Caja #${cajaSeleccionada}` : "🔴 SIN CAJAS ABIERTAS";
        estado.style.color = abierta ? "green" : "red";
        persistirVentaActiva()

    })

}


/* ======================
ABRIR CAJA
====================== */

function abrirCaja(){

    const texto =
    prompt("Ingrese monto inicial (Gs.)");

    if(texto === null) return;

    const monto = window.parseMontoGs(texto)

    if(!Number.isFinite(monto) || monto < 0){
        alert("Monto inválido. Ejemplo: 150.000")
        return
    }

    fetch(

        window.apiUrl("ventas/caja/abrir/"),

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

    const textoContado =
    prompt(
        "Ingrese dinero contado en caja (Gs.)"
    );

    if(textoContado === null) return;

    const montoReal = window.parseMontoGs(textoContado)

    if(!Number.isFinite(montoReal) || montoReal < 0){
        alert("Monto inválido. Ejemplo: 150.000")
        return
    }

    fetch(

        window.apiUrl("ventas/caja/cerrar/"),

        {

            method:"POST",

            headers: headers,

            body: JSON.stringify({
                monto_real: montoReal,
                caja_id: cajaSeleccionada
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
        persistirVentaActiva()
    }
)


/* ======================
INICIO
====================== */

window.onload = function(){

    restaurarVentasAbiertas()

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
.addEventListener("input", () => {
    persistirVentaActiva()
    buscarLibreta()
});

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
        persistirVentaActiva();

        return;
    }

    const res = await fetch(

        window.apiUrl(`ventas/libreta/buscar/?q=${encodeURIComponent(texto)}`),

        {
            headers:{
                "Authorization":"Bearer " + token
            }
        }

    );

    const data = await res.json();

    const lista = document.getElementById("sugerenciasLibreta")
    lista.replaceChildren()

    data.forEach(c => {
        const opcion = document.createElement("button")
        opcion.type = "button"
        opcion.className = "item-libreta"
        const nombre = document.createElement("strong")
        nombre.textContent = c.nombre
        const saldo = document.createElement("span")
        saldo.textContent = `Saldo: Gs. ${Number(c.saldo).toLocaleString("es-PY")}`
        opcion.append(nombre, document.createElement("br"), saldo)
        opcion.addEventListener("click", () => seleccionarCliente(c.nombre))
        lista.append(opcion)
    })

    if (data.length === 0) {
        const opcion = document.createElement("button")
        opcion.type = "button"
        opcion.className = "item-crear"
        const nombre = document.createElement("strong")
        nombre.textContent = texto
        opcion.append("Crear libreta para ", nombre)
        opcion.addEventListener("click", crearClienteNuevo)
        lista.append(opcion)
    }

}

function seleccionarCliente(nombre){

    clienteSeleccionado = nombre;

    document.getElementById(
        "clienteLibreta"
    ).value = nombre;

    document.getElementById(
        "sugerenciasLibreta"
    ).innerHTML = "";

    persistirVentaActiva();

}

function crearClienteNuevo(){

    clienteSeleccionado =
    document
    .getElementById("clienteLibreta")
    .value;

    document.getElementById(
        "sugerenciasLibreta"
    ).innerHTML = "";

    persistirVentaActiva();

}
