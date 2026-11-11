let compra = []
let total = 0

const API = window.API_BASE_URL
const token = localStorage.getItem("token")
const cuentasPorPagarPorCompra = new Map()
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

        alert("Ingrese el nombre del producto");
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
            alert(data.error);
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

        alert("Error al crear producto.");

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
alert("Selecciona un producto válido")
return
}

if(!cantidad || cantidad <= 0){
alert("Cantidad inválida")
return
}

if(!costo || costo <= 0){
alert("Costo inválido")
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

        alert("Selecciona proveedor")

        return
    }

    if(compra.length === 0){

        alert("Agrega productos")

        return
    }

    const credito = metodo_pago === "CREDITO"

    if(credito && !fecha_vencimiento){

        alert("Indica la fecha de vencimiento de la compra a crédito")

        return
    }

    const descuento = valorImporte("descuento")
    const impuesto = valorImporte("impuesto")

    if(descuento > total + impuesto){

        alert("El descuento no puede superar el total de la compra")

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

            alert(data.error)

            return
        }

        alert(
            "Compra registrada correctamente"
        )

        if (window.MODO_REGISTRO_COMPRA) {
            window.location.href = "compras.html"
            return
        }

        cerrarFormulario()

        cargarCompras()

    })

    .catch(error => {

        console.error(error)

        alert(
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

        data.forEach(c => {

            detallesDeCompra.set(Number(c.id), Array.isArray(c.detalle) ? c.detalle : [])

            tabla.innerHTML += `
            <tr>
                <td>${c.id}</td>
                <td>${escapeHtml(c.numero_factura || "-")}</td>
                <td>${escapeHtml(c.proveedor)}</td>
                <td>${c.fecha}</td>
                <td>${c.estado}</td>
                <td>Gs. ${Number(c.total).toLocaleString("es-PY")}</td>
                <td class="acciones-compra">
                    ${cuentasPorPagarPorCompra.has(Number(c.id)) ? `
                    <button type="button" class="btn-icon btn-pagar-compra"
                        title="Registrar pago al proveedor (saldo Gs. ${Number(cuentasPorPagarPorCompra.get(Number(c.id)).saldo).toLocaleString("es-PY")})"
                        aria-label="Registrar pago de la compra ${c.id}"
                        onclick="pagarCompra(${Number(c.id)})">
                        <i class="bi bi-cash-coin" aria-hidden="true"></i>
                    </button>` : ""}
                    <button type="button" class="btn-icon btn-ver-compra"
                        title="Ver detalle" aria-label="Ver detalle de compra ${c.id}"
                        onclick="verDetalleCompra(${Number(c.id)})">
                        <i class="bi bi-eye-fill" aria-hidden="true"></i>
                    </button>
                </td>
            </tr>
            `
        })

    })
    .catch(error => {
        console.error("Error cargando compras:", error)
    })

}


/* ======================
VER DETALLE
====================== */

function verDetalle(detalle){

let texto = "Detalle:\n\n"

detalle.forEach(d => {
    texto += `${d.producto} - ${d.cantidad} x ${d.costo}\n`
})

alert(texto)

}

function verDetalleCompra(compraId){
    verDetalle(detallesDeCompra.get(Number(compraId)) || [])
}


/* ======================
GUARDAR PROVEEDOR
====================== */

async function guardarProveedor(){

    console.log("Guardar proveedor desde COMPRAS");

    const nombre =
    document.getElementById(
        "nombreProveedor"
    ).value.trim()

    const telefono =
    document.getElementById(
        "telefonoProveedor"
    ).value.trim()


    if(!nombre){

        alert(
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

        console.log(data)


        if(data.error){

            alert(data.error)

            return
        }


        alert(
            "Proveedor creado correctamente"
        )


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

        alert(
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
        alert("Ingrese el nombre del producto.");
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
            alert(data.error);
            return;
        }

        alert("Producto creado correctamente.");

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
        alert("Ocurrió un error al crear el producto.");

    }

}







/* ======================
PAGO A PROVEEDOR (COMPRAS A CRÉDITO)
====================== */


async function pagarCompra(compraId){

    const cuenta = cuentasPorPagarPorCompra.get(Number(compraId))
    if(!cuenta) return

    const respuesta = prompt(
        `Pago a ${cuenta.proveedor} - Compra #${compraId}
` +
        `Saldo pendiente: Gs. ${Number(cuenta.saldo).toLocaleString("es-PY")}

` +
        "Monto a pagar (Gs.):",
        String(Math.round(cuenta.saldo))
    )
    if(respuesta === null) return

    const monto = Number(String(respuesta).replace(/\./g, "").replace(",", ".").trim())
    if(!Number.isFinite(monto) || monto <= 0){
        alert("Monto inválido")
        return
    }
    if(monto > cuenta.saldo){
        alert("El pago supera el saldo pendiente")
        return
    }

    try{
        const res = await fetch(`${API}/finanzas/cuentas-por-pagar/${encodeURIComponent(cuenta.id)}/pagar/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ monto })
        })
        const data = await res.json()
        if(!res.ok) throw new Error(data.error || data.detail || "No se pudo registrar el pago")
        alert(data.cuenta.pagado ? "Compra pagada por completo" : `Pago registrado. Saldo: Gs. ${Number(data.cuenta.saldo).toLocaleString("es-PY")}`)
        cargarCompras()
    }catch(error){
        console.error(error)
        alert(error.message)
    }
}
