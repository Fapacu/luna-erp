let compra = []
let total = 0

const API = window.API_BASE_URL
const token = localStorage.getItem("token")
const cuentasPorPagarPorCompra = new Map()
const comprasPorId = new Map()

function avisar(mensaje, tipo = "error"){
    if(window.LunaUI) window.LunaUI.toast(String(mensaje).trim(), tipo)
    else window.alert(mensaje)
}
const escapeHtml = window.escapeHtml
const detallesDeCompra = new Map()

/* ======================
INICIO
====================== */
window.onload = () => {
    if (document.getElementById("proveedorSelect")) cargarProveedores()
    if (document.getElementById("tablaCompras")) cargarCompras()
}


document.addEventListener("DOMContentLoaded", () => {

    const select = document.getElementById("proveedorSelect");

    if(!select) return;

    select.addEventListener("change", function(){

        if(this.value === "nuevo"){

            document.getElementById("modalProveedor").style.display = "flex";

        }

    });

});


/* ======================
MODAL
====================== */

function abrirFormulario(){
    document.getElementById("modalCompra").style.display = "flex"
}

function cerrarFormulario(){
    if (window.MODO_REGISTRO_COMPRA) {
        window.location.href = "compras.html"
        return
    }

    document.getElementById("modalCompra").style.display = "none"
    compra = []
    total = 0
    render()
}


/* ======================
PROVEEDORES
====================== */

async function cargarProveedores(){

    const res = await fetch(`${API}/compras/proveedores/`,{
        headers:{
            "Authorization":"Bearer " + token
        }
    });

    const data = await res.json();

    const select = document.getElementById("proveedorSelect");

    select.replaceChildren(new Option("Seleccione proveedor", ""));

    data.forEach(p => {

        select.add(new Option(p.nombre, p.id));

    });

    select.add(new Option("Nuevo proveedor…", "nuevo"));

}


/* ======================
BUSCAR PRODUCTO
====================== */

const inputProducto = document.getElementById("buscarProducto")

if(inputProducto){

inputProducto.addEventListener("input", function(){

    const query = inputProducto.value.trim()

    if(query.length < 2){
        document.getElementById("sugerencias").innerHTML = ""
        return
    }

    fetch(`${API}/inventario/buscar/?q=${encodeURIComponent(query)}`,{
        headers:{
            "Authorization": "Bearer " + token
        }
    })
    .then(res => res.json())
    .then(data => {

        const cont = document.getElementById("sugerencias")
        const aviso = document.getElementById("productoNoExiste")

        cont.replaceChildren()

        if(data.length === 0){

            aviso.style.display = "block"

            return

        }

        aviso.style.display = "none"

        data.forEach(p => {

            const opcion = document.createElement("button")
            opcion.type = "button"
            opcion.className = "sugerencia"
            opcion.textContent = p.nombre
            opcion.addEventListener("click", () => seleccionarProducto(p))
            cont.append(opcion)

        })

    })

})
}


/* ======================
SELECCIONAR
====================== */

function seleccionarProducto(p){

    document.getElementById("buscarProducto").value = p.nombre
    document.getElementById("productoSeleccionado").value = p.id
    document.getElementById("sugerencias").innerHTML = ""

    document.getElementById("productoNoExiste").style.display = "none"

}



function abrirNuevoProducto(){

    const nombre =
    document.getElementById("buscarProducto").value;

    document.getElementById(
        "nuevoNombreProducto"
    ).value = nombre;

    document.getElementById(
        "modalProducto"
    ).style.display = "flex";

}

function cerrarModalProducto(){

    document.getElementById(
        "modalProducto"
    ).style.display = "none";

}

async function guardarNuevoProducto(){

    const nombre =
    document.getElementById("nuevoNombreProducto").value.trim();

    const codigo =
    document.getElementById("nuevoCodigoBarra").value.trim();

    const cantidad =
    document.getElementById("nuevocantidad").value.trim();

    const unidad =
    document.getElementById("nuevaUnidad").value;

    const precioCompra =
    parseFloat(
        document.getElementById("nuevoPrecioCompra").value
    ) || 0;

    const stockMinimo =
    parseInt(
        document.getElementById("nuevoStockMinimo").value
    ) || 5;

    if(nombre === ""){

        avisar("Ingrese el nombre del producto");
        return;

    }

    try{

        const res = await fetch(`${API}/inventario/productos/`,{

            method:"POST",

            headers:{
                "Content-Type":"application/json",
                "Authorization":"Bearer " + token
            },

            body: JSON.stringify({

                codigo_barra:codigo,
                nombre:nombre,
                precio_compra:precioCompra,
                precio_venta:0,
                stock:0,
                stock_minimo:stockMinimo,
                unidad:unidad,
                cantidad:cantidad,

                proveedor:
                document.getElementById("proveedorSelect").value

            })

        });

        const data = await res.json();

        if(data.error){
            avisar(data.error);
            return;
        }

        cerrarModalProducto();

        document.getElementById("buscarProducto").value = nombre;
        document.getElementById("productoSeleccionado").value = data.id;

        document.getElementById("cantidad").value = cantidad;
        document.getElementById("costo").value = precioCompra;

        document.getElementById("productoNoExiste").style.display = "none";

        agregarProducto();

        document.getElementById("buscarProducto").focus();

    }catch(error){

        console.error(error);

        avisar("Error al crear producto.");

    }

}


/* ======================
AGREGAR PRODUCTO
====================== */

function agregarProducto(){

const producto = document.getElementById("productoSeleccionado").value
const nombre = document.getElementById("buscarProducto").value
const cantidad = parseFloat(document.getElementById("cantidad").value)
const costo = parseFloat(document.getElementById("costo").value)


if(!producto){
avisar("Selecciona un producto válido")
return
}

if(!cantidad || cantidad <= 0){
avisar("Cantidad inválida")
return
}

if(!costo || costo <= 0){
avisar("Costo inválido")
return
}

compra.push({
producto,
nombre,
cantidad,
costo
})

total += cantidad * costo

// limpiar
document.getElementById("buscarProducto").value = ""
document.getElementById("productoSeleccionado").value = ""
document.getElementById("cantidad").value = ""
document.getElementById("costo").value = ""

render()

}


/* ======================
RENDER
====================== */

function render(){

const tabla = document.getElementById("tablaDetalle")
tabla.innerHTML = ""

compra.forEach((p, i) => {

tabla.innerHTML += `
<tr>
<td>${escapeHtml(p.nombre)}</td>
<td>${p.cantidad}</td>
<td>Gs. ${Number(p.costo).toLocaleString("es-PY")}</td>
<td>Gs. ${(Number(p.cantidad) * Number(p.costo)).toLocaleString("es-PY")}</td>
<td><button type="button" aria-label="Quitar producto" onclick="eliminarProducto(${i})"><i class="bi bi-trash"></i></button></td>
</tr>
`
})

actualizarTotalCompra()

}

function valorImporte(id){
    const valor = Number(document.getElementById(id)?.value || 0)
    return Number.isFinite(valor) && valor > 0 ? valor : 0
}

function actualizarTotalCompra(){
    const elemento = document.getElementById("totalCompra")
    if(!elemento) return
    const final = total + valorImporte("impuesto") - valorImporte("descuento")
    elemento.innerText = Math.max(final, 0).toLocaleString("es-PY")
}

document.getElementById("descuento")?.addEventListener("input", actualizarTotalCompra)
document.getElementById("impuesto")?.addEventListener("input", actualizarTotalCompra)


/* ======================
ELIMINAR
====================== */

function eliminarProducto(i){
    total -= compra[i].cantidad * compra[i].costo
    compra.splice(i,1)
    render()
}


/* ======================
GUARDAR COMPRA
====================== */

function guardarCompra(){

    const proveedor =
    document.getElementById(
        "proveedorSelect"
    ).value

    const numero_factura =
    document.getElementById(
        "numeroFactura"
    ).value.trim()

    const metodo_pago =
    document.getElementById(
        "metodoPago"
    ).value

    const fecha_vencimiento =
    document.getElementById(
        "fechaVencimiento"
    ).value

    const observacion =
    document.getElementById(
        "observacion"
    ).value

    if(!proveedor){

        avisar("Selecciona proveedor")

        return
    }

    if(compra.length === 0){

        avisar("Agrega productos")

        return
    }

    const credito = metodo_pago === "CREDITO"

    if(credito && !fecha_vencimiento){

        avisar("Indica la fecha de vencimiento de la compra a crédito")

        return
    }

    const descuento = valorImporte("descuento")
    const impuesto = valorImporte("impuesto")

    if(descuento > total + impuesto){

        avisar("El descuento no puede superar el total de la compra")

        return
    }

    fetch(`${API}/compras/`,{

        method:"POST",

        headers:{
            "Content-Type":"application/json",
            "Authorization":"Bearer " + token
        },

        body: JSON.stringify({

            proveedor,

            numero_factura,

            metodo_pago,

            credito,

            fecha_vencimiento: credito ? fecha_vencimiento : null,

            descuento,

            impuesto,

            observacion,

            items: compra

        })

    })

    .then(res => res.json())

    .then(data => {

        if(data.error){

            avisar(data.error)

            return
        }

        if (window.MODO_REGISTRO_COMPRA) {
            window.LunaUI?.flash("Compra registrada correctamente", "exito")
        } else {
            avisar("Compra registrada correctamente", "exito")
        }

        if (window.MODO_REGISTRO_COMPRA) {
            window.location.href = "compras.html"
            return
        }

        cerrarFormulario()

        cargarCompras()

    })

    .catch(error => {

        console.error(error)

        avisar(
            "Error al guardar compra"
        )

    })

}

/* ======================
HISTORIAL
====================== */

function cargarCompras(){

    if (!document.getElementById("tablaCompras")) return

    const authHeaders = { "Authorization": "Bearer " + token }

    Promise.all([
        fetch(`${API}/compras/historial/`, { headers: authHeaders }).then(async res => {
            const data = await res.json()
            if(!res.ok) throw new Error(data.error || data.detail || "No se pudo cargar el historial")
            return data
        }),
        fetch(`${API}/finanzas/cuentas-por-pagar/?pendientes=1`, { headers: authHeaders })
            .then(res => res.ok ? res.json() : [])
            .catch(() => [])
    ])
    .then(([data, cuentas]) => {

        cuentasPorPagarPorCompra.clear()
        cuentas.forEach(cuenta => cuentasPorPagarPorCompra.set(Number(cuenta.compra_id), cuenta))

        const tabla = document.getElementById("tablaCompras")
        tabla.innerHTML = ""

        /* ======================
        KPIs
        ====================== */

        let totalCompras = 0
        let totalCredito = 0

        data.forEach(c => {

            totalCompras += Number(c.total || 0)

            if(c.credito === true){
                totalCredito += Number(c.total || 0)
            }

        })

        const totalFacturas = data.length

        const promedio =
        totalFacturas > 0
        ? totalCompras / totalFacturas
        : 0

        document.getElementById(
            "kpiCompras"
        ).innerText =
        "Gs. " +
        totalCompras.toLocaleString("es-PY")

        document.getElementById(
            "kpiFacturas"
        ).innerText =
        totalFacturas

        document.getElementById(
            "kpiCredito"
        ).innerText =
        "Gs. " +
        totalCredito.toLocaleString("es-PY")

        document.getElementById(
            "kpiPromedio"
        ).innerText =
        "Gs. " +
        Math.round(promedio)
        .toLocaleString("es-PY")

        /* ======================
        TABLA
        ====================== */

        if(!data.length){
            tabla.innerHTML = `<tr><td colspan="7" class="sin-datos">Todavía no hay compras registradas.</td></tr>`
        }

        data.forEach(c => {

            const id = Number(c.id)
            comprasPorId.set(id, c)
            detallesDeCompra.set(id, Array.isArray(c.detalle) ? c.detalle : [])
            const cuenta = cuentasPorPagarPorCompra.get(id)

            tabla.innerHTML += `
            <tr>
                <td>${id}</td>
                <td>${escapeHtml(c.numero_factura || "-")}</td>
                <td>${escapeHtml(c.proveedor)}</td>
                <td>${escapeHtml(c.fecha)}</td>
                <td>${etiquetaEstadoCompra(c, cuenta)}</td>
                <td>Gs. ${Number(c.total).toLocaleString("es-PY")}</td>
                <td class="acciones-compra">
                    ${cuenta ? `
                    <button type="button" class="btn-icon btn-pagar-compra"
                        title="Registrar pago al proveedor"
                        aria-label="Registrar pago de la compra ${id}"
                        onclick="pagarCompra(${id})">
                        <i class="bi bi-cash-coin" aria-hidden="true"></i>
                    </button>` : ""}
                    <button type="button" class="btn-icon btn-ver-compra"
                        title="Ver detalle" aria-label="Ver detalle de compra ${id}"
                        onclick="verDetalleCompra(${id})">
                        <i class="bi bi-eye-fill" aria-hidden="true"></i>
                    </button>
                </td>
            </tr>
            `
        })

    })
    .catch(error => {
        console.error("Error cargando compras:", error)
        avisar(error.message === "Failed to fetch" ? "No se pudo conectar con el servidor." : error.message)
    })

}


/* ======================
ESTADO Y DETALLE DE COMPRA
====================== */

const formatoGs = (valor) => "Gs. " + Math.round(Number(valor) || 0).toLocaleString("es-PY")

function compraVencida(cuenta){
    if(!cuenta || !cuenta.fecha_vencimiento) return false
    const hoy = new Date()
    const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`
    return cuenta.fecha_vencimiento < iso
}

function fechaLocal(iso){
    if(!iso) return "-"
    const [a, m, d] = iso.split("-")
    return `${d}/${m}/${a}`
}

function etiquetaEstadoCompra(compra, cuenta){
    if(cuenta && compraVencida(cuenta)) return `<span class="luna-etiqueta vencida">VENCIDA</span>`
    const clases = { PAGADA: "pagada", PENDIENTE: "pendiente", PARCIAL: "parcial", ANULADA: "anulada" }
    const textos = { PAGADA: "PAGADA", PENDIENTE: "PENDIENTE", PARCIAL: "PAGO PARCIAL", ANULADA: "ANULADA" }
    return `<span class="luna-etiqueta ${clases[compra.estado] || "pendiente"}">${escapeHtml(textos[compra.estado] || compra.estado)}</span>`
}

function verDetalleCompra(compraId){

    const compra = comprasPorId.get(Number(compraId))
    if(!compra) return
    const detalle = detallesDeCompra.get(Number(compraId)) || []
    const cuenta = cuentasPorPagarPorCompra.get(Number(compraId))

    const filas = detalle.map(d => `
        <tr>
            <td>${escapeHtml(d.producto)}</td>
            <td class="r">${Number(d.cantidad).toLocaleString("es-PY")}</td>
            <td class="r">${formatoGs(d.costo)}</td>
            <td class="r">${formatoGs(d.subtotal)}</td>
        </tr>`).join("")

    const extras = [
        Number(compra.impuesto) ? `<tr><td colspan="3">Impuesto</td><td class="r">${formatoGs(compra.impuesto)}</td></tr>` : "",
        Number(compra.descuento) ? `<tr><td colspan="3">Descuento</td><td class="r">− ${formatoGs(compra.descuento)}</td></tr>` : "",
    ].join("")

    const ventana = LunaUI.modal({
        titulo: `Compra #${Number(compra.id)}`,
        subtitulo: `${compra.proveedor} · ${compra.fecha}`,
        icono: "bi-receipt",
        ancho: true,
        contenido: `
            <div class="luna-resumen">
                <div class="luna-dato"><span>Factura</span><strong>${escapeHtml(compra.numero_factura || "Sin número")}</strong></div>
                <div class="luna-dato"><span>Condición</span><strong>${compra.credito ? "Crédito" : "Contado"}</strong></div>
                <div class="luna-dato"><span>Estado</span><strong>${etiquetaEstadoCompra(compra, cuenta)}</strong></div>
                ${cuenta ? `<div class="luna-dato destacado"><span>Saldo pendiente</span><strong>${formatoGs(cuenta.saldo)}</strong></div>` : ""}
                ${cuenta ? `<div class="luna-dato"><span>Vence</span><strong>${fechaLocal(cuenta.fecha_vencimiento)}</strong></div>` : ""}
            </div>
            <table class="luna-tabla">
                <thead><tr><th>Producto</th><th class="r">Cantidad</th><th class="r">Costo</th><th class="r">Subtotal</th></tr></thead>
                <tbody>${filas || `<tr><td colspan="4">Sin productos</td></tr>`}</tbody>
                <tfoot>
                    <tr><td colspan="3">Subtotal</td><td class="r">${formatoGs(compra.subtotal)}</td></tr>
                    ${extras}
                    <tr class="total"><td colspan="3">Total</td><td class="r">${formatoGs(compra.total)}</td></tr>
                </tfoot>
            </table>`,
        acciones: [
            { texto: "Cerrar", alPulsar: (v) => v.cerrar() },
            ...(cuenta ? [{ texto: "Registrar pago", tipo: "primario", icono: "bi-cash-coin",
                alPulsar: (v) => { v.cerrar(); pagarCompra(compra.id) } }] : []),
        ],
    })
    return ventana
}


/* ======================
GUARDAR PROVEEDOR
====================== */

async function guardarProveedor(){


    const nombre =
    document.getElementById(
        "nombreProveedor"
    ).value.trim()

    const telefono =
    document.getElementById(
        "telefonoProveedor"
    ).value.trim()


    if(!nombre){

        avisar(
            "Ingrese nombre"
        )

        return
    }


    try{

        const res = await fetch(

            `${API}/compras/proveedores/`,

            {

                method: "POST",

                headers: {

                    "Content-Type":
                    "application/json",

                    "Authorization":
                    "Bearer " + token
                },

                body: JSON.stringify({

                    nombre,
                    telefono
                })
            }
        )

        const data =
        await res.json()



        if(data.error){

            avisar(data.error)

            return
        }


        avisar("Proveedor creado correctamente", "exito")


        // limpiar inputs

        document.getElementById(
            "nombreProveedor"
        ).value = ""

        document.getElementById(
            "telefonoProveedor"
        ).value = ""


        // Recargar proveedores y esperar a que termine
        await cargarProveedores();

        // Seleccionar automáticamente el nuevo proveedor
        document.getElementById("proveedorSelect").value = data.id;

        // Limpiar formulario
        document.getElementById("nombreProveedor").value = "";
        document.getElementById("telefonoProveedor").value = "";

        // Cerrar modal
        const modal = document.getElementById("modalProveedor");

        if(modal){
            modal.style.display = "none";
        }

    }catch(error){

        console.error(error)

        avisar(
            "Error al guardar proveedor"
        )
    }
}

async function guardarProducto() {

    const nombre = document.getElementById("nuevoNombreProducto").value.trim();
    const codigo_barra = document.getElementById("nuevoCodigoBarra").value.trim();
    const precio_compra = parseFloat(document.getElementById("nuevoPrecioCompra").value) || 0;
    const precio_venta = parseFloat(document.getElementById("nuevoPrecioVenta").value) || 0;
    const stock = parseFloat(document.getElementById("nuevoStock").value) || 0;
    const stock_minimo = parseFloat(document.getElementById("nuevoStockMinimo").value) || 5;
    const unidad = document.getElementById("nuevaUnidad").value;

    if (!nombre) {
        avisar("Ingrese el nombre del producto.");
        return;
    }

    try {

        const res = await fetch(`${API}/inventario/productos/`, {
            method: "POST",
            headers: {
    "Content-Type": "application/json"
},
            body: JSON.stringify({
                nombre,
                codigo_barra,
                precio_compra,
                precio_venta,
                stock,
                stock_minimo,
                unidad,

                proveedor:
                document.getElementById("proveedorSelect").value
            })
        });

        const data = await res.json();

        if (data.error) {
            avisar(data.error);
            return;
        }

        avisar("Producto creado correctamente.", "exito");

        // Cerrar modal
        document.getElementById("modalProducto").style.display = "none";

        // Limpiar formulario
        document.getElementById("nuevoNombreProducto").value = "";
        document.getElementById("nuevoCodigoBarra").value = "";
        document.getElementById("nuevoPrecioCompra").value = 0;
        document.getElementById("nuevoPrecioVenta").value = 0;
        document.getElementById("nuevoStock").value = 0;
        document.getElementById("nuevoStockMinimo").value = 5;
        document.getElementById("nuevaUnidad").value = "unidad";

        document.getElementById("productoSeleccionado").value = data.id;
        document.getElementById("buscarProducto").value = data.nombre;
        document.getElementById("costo").value = data.precio_compra;
        document.getElementById("cantidad").value = 1;

        // Ocultar el botón "Crear producto"
        document.getElementById("productoNoExiste").style.display = "none";

        // Agregar automáticamente al detalle
        agregarProducto();

        document.getElementById("buscarProducto").focus();

    } catch (error) {

        console.error(error);
        avisar("Ocurrió un error al crear el producto.");

    }

}







/* ======================
PAGO A PROVEEDOR (COMPRAS A CRÉDITO)
====================== */


function pagarCompra(compraId){

    const cuenta = cuentasPorPagarPorCompra.get(Number(compraId))
    const compra = comprasPorId.get(Number(compraId))
    if(!cuenta) return

    const pagado = Number(cuenta.total) - Number(cuenta.saldo)
    const vencida = compraVencida(cuenta)

    const formulario = document.createElement("form")
    formulario.id = "formPagoProveedor"
    formulario.noValidate = true
    formulario.innerHTML = `
        <div class="luna-resumen">
            <div class="luna-dato"><span>Total de la compra</span><strong>${formatoGs(cuenta.total)}</strong></div>
            <div class="luna-dato"><span>Pagado</span><strong>${formatoGs(pagado)}</strong></div>
            <div class="luna-dato destacado"><span>Saldo pendiente</span><strong>${formatoGs(cuenta.saldo)}</strong></div>
            <div class="luna-dato"><span>Vencimiento</span><strong>${fechaLocal(cuenta.fecha_vencimiento)}
                ${vencida ? '<span class="luna-etiqueta vencida">VENCIDA</span>' : ""}</strong></div>
        </div>

        <div class="luna-campo">
            <label for="montoPagoProveedor">Monto a pagar</label>
            <div class="luna-monto"><span>Gs.</span><input id="montoPagoProveedor" inputmode="numeric" autocomplete="off" required></div>
            <div class="luna-rapidos">
                <button type="button" class="luna-chip" data-porcentaje="100">Saldo total</button>
                <button type="button" class="luna-chip" data-porcentaje="50">50 %</button>
                <button type="button" class="luna-chip" data-porcentaje="25">25 %</button>
            </div>
            <small id="errorPagoProveedor" class="error" aria-live="polite"></small>
        </div>

        <div class="luna-fila-2">
            <div class="luna-campo">
                <label for="metodoPagoProveedor">Forma de pago</label>
                <select id="metodoPagoProveedor">
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia bancaria</option>
                    <option value="cheque">Cheque</option>
                    <option value="tarjeta">Tarjeta</option>
                </select>
            </div>
            <div class="luna-campo">
                <label for="referenciaPagoProveedor">Referencia <small>(opcional)</small></label>
                <input id="referenciaPagoProveedor" maxlength="100" placeholder="N.º de transferencia o cheque">
            </div>
        </div>

        <div class="luna-proyeccion" id="proyeccionPagoProveedor">
            <span>Saldo después del pago</span><strong>${formatoGs(cuenta.saldo)}</strong>
        </div>`

    const ventana = LunaUI.modal({
        titulo: "Registrar pago a proveedor",
        subtitulo: `${cuenta.proveedor} · Compra #${Number(compraId)}${compra && compra.numero_factura ? " · Factura " + compra.numero_factura : ""}`,
        icono: "bi-cash-coin",
        contenido: formulario,
        acciones: [
            { texto: "Cancelar", alPulsar: (v) => v.cerrar() },
            { texto: "Registrar pago", tipo: "primario", icono: "bi-check2-circle", submit: true, form: "formPagoProveedor", id: "btnConfirmarPagoProveedor" },
        ],
    })

    const input = formulario.querySelector("#montoPagoProveedor")
    const error = formulario.querySelector("#errorPagoProveedor")
    const proyeccion = formulario.querySelector("#proyeccionPagoProveedor")

    const actualizar = (monto) => {
        error.textContent = ""
        const restante = Number(cuenta.saldo) - (Number.isFinite(monto) ? monto : 0)
        proyeccion.classList.toggle("saldado", restante === 0)
        proyeccion.innerHTML = restante === 0
            ? `<span><i class="bi bi-check-circle-fill"></i> La compra quedará pagada por completo</span><strong>Gs. 0</strong>`
            : `<span>Saldo después del pago</span><strong>${formatoGs(Math.max(restante, 0))}</strong>`
        if(Number.isFinite(monto) && monto > Number(cuenta.saldo)) error.textContent = "El monto supera el saldo pendiente."
    }
    const campo = LunaUI.campoGuaranies(input, actualizar)
    campo.fijar(cuenta.saldo)
    input.select()

    formulario.querySelectorAll("[data-porcentaje]").forEach(chip => {
        chip.addEventListener("click", () => {
            campo.fijar(Math.round(Number(cuenta.saldo) * Number(chip.dataset.porcentaje) / 100))
            input.focus()
        })
    })

    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault()
        const monto = campo.valor()
        if(!Number.isFinite(monto) || monto <= 0){
            error.textContent = "Ingresa un monto válido. Ejemplo: 150.000"
            input.focus()
            return
        }
        if(monto > Number(cuenta.saldo)){
            error.textContent = "El monto supera el saldo pendiente."
            input.focus()
            return
        }
        const boton = document.getElementById("btnConfirmarPagoProveedor")
        ventana.setCargando(boton, true, "Registrando…")
        try{
            const res = await fetch(`${API}/finanzas/cuentas-por-pagar/${encodeURIComponent(cuenta.id)}/pagar/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + token
                },
                body: JSON.stringify({
                    monto,
                    metodo_pago: formulario.querySelector("#metodoPagoProveedor").value,
                    referencia: formulario.querySelector("#referenciaPagoProveedor").value.trim()
                })
            })
            const data = await res.json()
            if(!res.ok) throw new Error(data.error || data.detail || "No se pudo registrar el pago")

            ventana.setEncabezado({ titulo: "Pago registrado", icono: "bi-check-lg", tipoIcono: "exito" })
            ventana.setContenido(`
                <div class="luna-exito-box">
                    <div class="icono"><i class="bi bi-check-lg" aria-hidden="true"></i></div>
                    <h3>${formatoGs(monto)} pagados a ${escapeHtml(cuenta.proveedor)}</h3>
                    <p>${data.cuenta.pagado ? "La compra quedó pagada por completo." : "Saldo pendiente: " + formatoGs(data.cuenta.saldo)}</p>
                </div>`)
            ventana.setAcciones([{ texto: "Listo", tipo: "primario", alPulsar: (v) => v.cerrar() }])
            LunaUI.toast(`Pago registrado: ${formatoGs(monto)} a ${cuenta.proveedor}`, "exito")
            cargarCompras()
        }catch(err){
            console.error(err)
            ventana.setCargando(boton, false)
            error.textContent = err.message === "Failed to fetch" ? "No se pudo conectar con el servidor." : err.message
        }
    })
}
