document.addEventListener("DOMContentLoaded", () => {

const tabla = document.getElementById("tablaProductos")
const inputBuscar = document.getElementById("buscarProducto")

const token = localStorage.getItem("token")

/* ======================
CARGAR PRODUCTOS
====================== */

function cargarProductos(){

const buscar = inputBuscar ? inputBuscar.value : ""

fetch(`http://127.0.0.1:8000/api/inventario/buscar/?q=${buscar}`, {
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
<td>${p.nombre}</td>
<td>$${Number(p.precio_venta || 0).toLocaleString('es-CL')}</td>

<td class="${stockClase}">
${p.stock} ${unidadTexto}
</td>

<td>
${p.stock <= stockMin ? "⚠ Bajo" : "✔ OK"}
</td>

<td>${stockMin}</td>

<td>
<button onclick="editarProducto(${p.id})">✏</button>
<button onclick="eliminarProducto(${p.id})">🗑</button>
<button onclick="abrirModal(${p.id})">⚙</button>
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

fetch("http://127.0.0.1:8000/api/inventario/productos/",{
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

fetch(`http://127.0.0.1:8000/api/inventario/productos/${id}/`,{
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

fetch(`http://127.0.0.1:8000/api/inventario/productos/${id}/`,{
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

window.eliminarProducto = function(id){

if(!confirm("¿Eliminar producto?")) return

fetch(`http://127.0.0.1:8000/api/inventario/productos/${id}/`,{
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

const cantidad = document.getElementById("cantidad").value
const motivo = document.getElementById("motivo").value

fetch("http://127.0.0.1:8000/api/inventario/ajustar-stock/", {
    method:"POST",
    headers:{
        "Content-Type":"application/json",
        "Authorization": "Bearer " + token
    },
    body: JSON.stringify({
        producto_id: productoActual,
        cantidad: parseInt(cantidad),
        motivo: motivo
    })
})
.then(res => res.json())
.then(() => {
    cerrarModal()
    cargarProductos()
})

}


/* ======================
INICIO
====================== */

cargarProductos()

})