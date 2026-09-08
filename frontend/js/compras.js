let compra = []
let total = 0

const API = "http://127.0.0.1:8000/api"
const token = localStorage.getItem("token")

/* ======================
INICIO
====================== */
window.onload = () => {
    cargarProveedores()
    cargarCompras()
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

    select.innerHTML = "<option value=''>Seleccione proveedor</option>";

    data.forEach(p => {

        select.innerHTML += `
            <option value="${p.id}">
                ${p.nombre}
            </option>
        `;

    });

    select.innerHTML += `
        <option value="nuevo">
            ➕ Nuevo proveedor...
        </option>
    `;

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

    fetch(`${API}/inventario/buscar/?q=${query}`,{
        headers:{
            "Authorization": "Bearer " + token
        }
    })
    .then(res => res.json())
    .then(data => {

        const cont = document.getElementById("sugerencias")
        const aviso = document.getElementById("productoNoExiste")

        cont.innerHTML = ""

        if(data.length === 0){

            aviso.style.display = "block"

            return

        }

        aviso.style.display = "none"

        data.forEach(p => {

            cont.innerHTML += `
                <div class="sugerencia"
                    onclick='seleccionarProducto(${JSON.stringify(p)})'>
                    ${p.nombre}
                </div>
            `

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
<td>${p.nombre}</td>
<td>${p.cantidad}</td>
<td>$${p.costo.toLocaleString()}</td>
<td>$${(p.cantidad * p.costo).toLocaleString()}</td>
<td><button onclick="eliminarProducto(${i})">❌</button></td>
</tr>
`
})

document.getElementById("totalCompra").innerText = total.toLocaleString()

}


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

            credito:
            metodo_pago === "CREDITO",

            fecha_vencimiento,

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

    fetch(`${API}/compras/historial/`,{
        headers:{
            "Authorization": "Bearer " + token
        }
    })
    .then(res => res.json())
    .then(data => {

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

            tabla.innerHTML += `
            <tr>
                <td>${c.id}</td>
                <td>${c.numero_factura || "-"}</td>
                <td>${c.proveedor}</td>
                <td>${c.fecha}</td>
                <td>${c.estado}</td>
                <td>Gs. ${Number(c.total).toLocaleString("es-PY")}</td>
                <td>
                    <button onclick='verDetalle(${JSON.stringify(c.detalle)})'>
                        👁
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