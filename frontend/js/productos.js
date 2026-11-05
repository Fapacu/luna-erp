document.addEventListener("DOMContentLoaded", () => {

const tabla = document.getElementById("tablaProductos")
const inputBuscar = document.getElementById("buscarProducto")

const token = localStorage.getItem("token")
const API = window.API_BASE_URL
const escapeHtml = window.escapeHtml
const puedeGestionar = ["ADMIN", "GERENTE"].includes(localStorage.getItem("rol"))

/* ======================
CARGAR PRODUCTOS
====================== */

function cargarProductos(){

const buscar = inputBuscar ? inputBuscar.value : ""

const filtroArchivados = puedeGestionar ? "&incluir_inactivos=1" : ""

fetch(`${API}/inventario/buscar/?q=${encodeURIComponent(buscar)}${filtroArchivados}`, {
    headers:{
        "Authorization": "Bearer " + token
    }
})

.then(res => res.json())

.then(data => {

tabla.innerHTML = ""

data.forEach(p => {

const stockMin = p.stock_minimo ?? 5
const stockClase = p.stock <= stockMin ? "stock-bajo" : "stock-ok"
const unidadTexto = p.unidad === "kg" ? "kg" : "u"

tabla.innerHTML += `
<tr>
<td>${p.id}</td>
<td>${escapeHtml(p.nombre)}</td>
<td>Gs. ${Number(p.precio_venta || 0).toLocaleString('es-PY')}</td>

<td class="${stockClase}">
${p.stock} ${unidadTexto}
</td>

<td>${!p.activo ? "Archivado" : p.stock <= stockMin ? "Stock bajo" : "Disponible"}</td>

<td>${stockMin}</td>

<td>
${puedeGestionar ? `<button type="button" title="Editar producto" aria-label="Editar producto ${escapeHtml(p.nombre)}" onclick="editarProducto(${p.id})"><i class="bi bi-pencil-square"></i></button>
<button type="button" title="${p.activo ? "Archivar" : "Reactivar"} producto" aria-label="${p.activo ? "Archivar" : "Reactivar"} producto ${escapeHtml(p.nombre)}" onclick="cambiarEstadoProducto(${p.id}, ${!p.activo})"><i class="bi ${p.activo ? "bi-archive" : "bi-arrow-counterclockwise"}"></i></button>
${p.activo ? `<button type="button" title="Ajustar stock" aria-label="Ajustar stock de ${escapeHtml(p.nombre)}" onclick="abrirModal(${p.id})"><i class="bi bi-sliders"></i></button>` : ""}` : ""}
</td>
</tr>
`
})

})

}


/* ======================
BUSCAR
====================== */

if(inputBuscar){
inputBuscar.addEventListener("keyup", cargarProductos)
}


/* ======================
MODAL CREAR
====================== */

window.abrirFormulario = function(){
document.getElementById("modalProducto").style.display="flex"
}

window.cerrarFormulario = function(){
document.getElementById("modalProducto").style.display="none"
}


/* ======================
CREAR PRODUCTO
====================== */

window.guardarProducto = function(){

const codigo_barra = document.getElementById("codigoProducto").value
const nombre = document.getElementById("nombreProducto").value
const precio_compra = document.getElementById("precioCompraProducto").value
const precio_venta = document.getElementById("precioVentaProducto").value
const stock = document.getElementById("stockProducto").value
const stock_minimo = document.getElementById("stockMinimoProducto").value
const unidad = document.getElementById("unidadProducto").value

fetch(`${API}/inventario/productos/`,{
    method:"POST",
    headers:{
        "Content-Type":"application/json",
        "Authorization": "Bearer " + token
    },
    body: JSON.stringify({
        codigo_barra,
        nombre,
        precio_compra,
        precio_venta,
        stock,
        stock_minimo,
        unidad
    })
})
.then(res => res.json())
.then(() => {
    cerrarFormulario()
    cargarProductos()
})
}


/* ======================
EDITAR PRODUCTO (GET)
====================== */

window.editarProducto = function(id){

fetch(`${API}/inventario/productos/${id}/`,{
    method:"GET",
    headers:{
        "Authorization": "Bearer " + token
    }
})
.then(res => res.json())
.then(data => {

document.getElementById("editarId").value = data.id

document.getElementById("actualNombre").innerText = data.nombre
document.getElementById("actualPrecioVenta").innerText = data.precio_venta
document.getElementById("actualStock").innerText = data.stock
document.getElementById("actualStockminimo").innerText = data.stock_minimo
document.getElementById("actualUnidad").innerText = data.unidad

document.getElementById("editarNombre").value = data.nombre
document.getElementById("editarPrecioVenta").value = data.precio_venta
document.getElementById("editarStockminimo").value = data.stock_minimo

document.getElementById("editarUnidad").value = data.unidad || "unidad"

document.getElementById("modalEditarProducto").style.display="flex"

})

}


/* ======================
ACTUALIZAR PRODUCTO (PUT)
====================== */

window.actualizarProducto = function(){

const id = document.getElementById("editarId").value

const nombre = document.getElementById("editarNombre").value
const precio_venta = document.getElementById("editarPrecioVenta").value
const stock_minimo = document.getElementById("editarStockminimo").value
const unidad = document.getElementById("editarUnidad").value

fetch(`${API}/inventario/productos/${id}/`,{
    method:"PUT",
    headers:{
        "Content-Type":"application/json",
        "Authorization": "Bearer " + token
    },
    body: JSON.stringify({
        nombre,
        precio_venta,
        stock_minimo,
        unidad
    })
})
.then(res => res.json())
.then(() => {
    cerrarEditar()
    cargarProductos()
})

}


/* ======================
CERRAR EDITAR
====================== */

window.cerrarEditar = function(){
document.getElementById("modalEditarProducto").style.display="none"
}


/* ======================
ELIMINAR
====================== */

window.cambiarEstadoProducto = function(id, activar){

const accion = activar ? "reactivar" : "archivar"
if(!confirm(`¿Deseas ${accion} este producto? El historial se conservará.`)) return

fetch(`${API}/inventario/productos/${id}/`,{
    method:"PUT",
    headers:{
        "Content-Type":"application/json",
        "Authorization": "Bearer " + token
    },
    body: JSON.stringify({activo: activar})
})
.then(res => {
    if(!res.ok) throw new Error("No se pudo cambiar el estado del producto")
    return res.json()
})
.then(() => cargarProductos())
.catch(error => alert(error.message))
}

window.eliminarProducto = function(id){

if(!confirm("¿Archivar producto? El historial se conservará.")) return

fetch(`${API}/inventario/productos/${id}/`,{
    method:"DELETE",
    headers:{
        "Authorization": "Bearer " + token
    }
})
.then(res => {
    if(res.ok){
        cargarProductos()
    }
})

}


/* ======================
AJUSTE DE STOCK (PRO)
====================== */

let productoActual = null

window.abrirModal = function(id){
productoActual = id
document.getElementById("modalStock").style.display = "flex"
}

window.cerrarModal = function(){
document.getElementById("modalStock").style.display = "none"
}

window.guardarAjuste = function(){

const cantidad = document.getElementById("cantidad").value.trim()
const motivo = document.getElementById("motivo").value.trim()

if (!cantidad || !Number.isFinite(Number(cantidad)) || Number(cantidad) === 0) {
    alert("Ingresa una cantidad válida distinta de cero.")
    document.getElementById("cantidad").focus()
    return
}

if (!motivo) {
    alert("El motivo es obligatorio para ajustar el stock.")
    document.getElementById("motivo").focus()
    return
}

fetch(`${API}/inventario/ajustar-stock/`, {
    method:"POST",
    headers:{
        "Content-Type":"application/json",
        "Authorization": "Bearer " + token
    },
    body: JSON.stringify({
        producto_id: productoActual,
        cantidad: cantidad,
        motivo: motivo
    })
})
.then(async res => {
    const data = await res.json()
    if (!res.ok) {
        throw new Error(data.error || "No se pudo actualizar el stock.")
    }
    alert(data.msg || "Stock actualizado correctamente.")
    cerrarModal()
    cargarProductos()
})
.catch(error => {
    alert(error.message || "Error al conectar con el servidor.")
})

}


/* ======================
INICIO
====================== */

cargarProductos()

})
