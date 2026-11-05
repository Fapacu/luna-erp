/* =====================================================
   LUNA ERP
   MÓDULO PROVEEDORES
===================================================== */

const API = window.API_BASE_URL;
const token = localStorage.getItem("token");

/* =====================================================
   VARIABLES
===================================================== */

let proveedorEditando = null;
let productosSeleccionados = [];
let proveedores = [];

/* =====================================================
   INICIO
===================================================== */

window.addEventListener("DOMContentLoaded", () => {

    cargarProveedores();

    iniciarBusquedaProductos();

    iniciarBuscadorTabla();

});

/* =====================================================
   MODAL
===================================================== */

function abrirFormulario(){

    proveedorEditando = null;

    productosSeleccionados = [];

    document.getElementById("tituloProveedor").innerHTML =
        `<i class="bi bi-person-plus-fill"></i> Nuevo proveedor`;

    document.getElementById("nombreProveedor").value = "";
    document.getElementById("telefonoProveedor").value = "";
    document.getElementById("buscarProductoProveedor").value = "";

    document.getElementById("resultadosProductos").innerHTML = "";

    renderProductosProveedor();

    document.getElementById("modalProveedor").style.display = "flex";

}

function cerrarFormulario(){

    document.getElementById("modalProveedor").style.display = "none";

    proveedorEditando = null;

    productosSeleccionados = [];

}

/* =====================================================
   UTILIDADES
===================================================== */

function obtenerHeaders(){

    return{

        "Content-Type":"application/json",

        "Authorization":"Bearer " + token

    };

}

function escaparHTML(texto){

    return String(texto ?? "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#039;");

}

/* =====================================================
   BUSCAR PRODUCTOS
===================================================== */

function iniciarBusquedaProductos(){

    const input = document.getElementById("buscarProductoProveedor");

    if(!input) return;

    input.addEventListener("input", async function(){

        const texto = this.value.trim();

        const resultados =
        document.getElementById("resultadosProductos");

        if(texto.length < 2){

            resultados.innerHTML = "";

            return;

        }

        try{

            const res = await fetch(

                `${API}/inventario/buscar/?q=${encodeURIComponent(texto)}`,

                {
                    headers: obtenerHeaders()
                }

            );

            const data = await res.json();

            resultados.innerHTML = "";

            data.forEach(producto=>{

                const existe =
                productosSeleccionados.some(

                    p => p.id === producto.id

                );

                if(existe) return;

                resultados.innerHTML += `

                <div
                    class="producto-item"
                    onclick="agregarProductoProveedor(${producto.id},'${escaparHTML(producto.nombre)}')">

                    <i class="bi bi-box-seam"></i>

                    ${escaparHTML(producto.nombre)}

                </div>

                `;

            });

        }

        catch(error){

            console.error(error);

        }

    });

}

/* =====================================================
   AGREGAR PRODUCTO
===================================================== */

function agregarProductoProveedor(id,nombre){

    productosSeleccionados.push({

        id,

        nombre

    });

    document.getElementById(
        "buscarProductoProveedor"
    ).value="";

    document.getElementById(
        "resultadosProductos"
    ).innerHTML="";

    renderProductosProveedor();

}

/* =====================================================
   QUITAR PRODUCTO
===================================================== */

function quitarProductoProveedor(id){

    productosSeleccionados =
    productosSeleccionados.filter(

        p=>p.id!==id

    );

    renderProductosProveedor();

}

/* =====================================================
   RENDER PRODUCTOS
===================================================== */

function renderProductosProveedor(){

    const lista =
    document.getElementById("listaProductos");

    lista.innerHTML="";

    if(productosSeleccionados.length===0){

        lista.innerHTML=`

        <tr>

            <td colspan="2"
                class="text-center">

                No hay productos asociados.

            </td>

        </tr>

        `;

        return;

    }

    productosSeleccionados.forEach(producto=>{

        lista.innerHTML += `

        <tr>

            <td>

                <i class="bi bi-box-seam"></i>

                ${escaparHTML(producto.nombre)}

            </td>

            <td class="text-right">

                <button

                    type="button"

                    class="btn-icon btn-eliminar"

                    onclick="quitarProductoProveedor(${producto.id})">

                    <i class="bi bi-trash"></i>

                </button>

            </td>

        </tr>

        `;

    });

}

/* =====================================================
   CARGAR PROVEEDORES
===================================================== */

async function cargarProveedores(){

    try{

        const res = await fetch(

            `${API}/compras/proveedores/`,

            {
                headers: obtenerHeaders()
            }

        );

        proveedores = await res.json();

        renderTabla();

        actualizarKPIs();

    }

    catch(error){

        console.error(error);

        alert("Error al cargar proveedores.");

    }

}

/* =====================================================
   RENDER TABLA
===================================================== */

function renderTabla(lista = proveedores){

    const tbody = document.getElementById("tablaProveedores");

    tbody.innerHTML = "";

    if(lista.length === 0){

        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
                    No existen proveedores registrados.
                </td>
            </tr>
        `;

        return;

    }

    lista.forEach(proveedor=>{

        const productos = proveedor.productos || [];

        let textoProductos = productos
            .slice(0,4)
            .map(p=>p.nombre)
            .join(", ");

        if(productos.length > 4){

            textoProductos += ` ... +${productos.length-4}`;

        }

        if(productos.length === 0){

            textoProductos = "-";

        }

        tbody.innerHTML += `

        <tr>

            <td>

                <strong>${escaparHTML(proveedor.nombre)}</strong>

            </td>

            <td>

                ${
                    proveedor.telefono
                    ? `
                        <a
                            href="https://wa.me/595${proveedor.telefono.replace(/\D/g,'').replace(/^0/,'')}"
                            target="_blank"
                            class="text-success text-decoration-none fw-semibold"
                            title="Abrir conversación en WhatsApp">

                            <i class="bi bi-whatsapp"></i>
                            ${escaparHTML(proveedor.telefono)}

                        </a>
                    `
                    : "-"
                }

            </td>

            <td>

                ${escaparHTML(textoProductos)}

            </td>

            <td class="text-center">

                <span class="badge-productos">

                    ${productos.length}

                </span>

            </td>

            <td>

                <button
                    class="btn-icon btn-editar"
                    onclick="editarProveedor(${proveedor.id})">

                    <i class="bi bi-pencil-square"></i>

                </button>

                <button
                    class="btn-icon btn-eliminar"
                    onclick="eliminarProveedor(${proveedor.id})">

                    <i class="bi bi-trash"></i>

                </button>

            </td>

        </tr>

        `;

    });

}
/* =====================================================
   KPIs
===================================================== */

function actualizarKPIs(){

    document.getElementById("totalProveedores").textContent =
        proveedores.length;

    let totalProductos = 0;
    let conTelefono = 0;

    proveedores.forEach(p => {

        totalProductos += (p.productos || []).length;

        if (p.telefono && p.telefono.trim() !== "") {
            conTelefono++;
        }

    });

    document.getElementById("totalProductos").textContent =
        totalProductos;

    document.getElementById("kpiTelefonos").textContent =
        conTelefono;

    const ultimo = proveedores.reduce((a, b) => {
        return Number(a.id) > Number(b.id) ? a : b;
    }, proveedores[0]);

    document.getElementById("kpiUltimo").textContent =
        ultimo ? ultimo.nombre : "--";
}

/* =====================================================
   BUSCADOR TABLA
===================================================== */

function iniciarBuscadorTabla(){

    const input =
    document.getElementById(
        "buscarProveedor"
    );

    if(!input) return;

    input.addEventListener("input",()=>{

        const texto =
        input.value
        .toLowerCase()
        .trim();

        if(texto===""){

            renderTabla();

            return;

        }

        const filtrados = proveedores.filter(proveedor=>{

    const coincideProducto =

        (proveedor.productos || []).some(producto=>

            producto.nombre
                .toLowerCase()
                .includes(texto)

        );

    return (

        proveedor.nombre
            .toLowerCase()
            .includes(texto)

        ||

        (proveedor.telefono || "")
            .toLowerCase()
            .includes(texto)

        ||

        coincideProducto

    );

});

        renderTabla(filtrados);

    });

}

/* =====================================================
   GUARDAR PROVEEDOR
===================================================== */

async function guardarProveedor(){

    console.log("Guardar proveedor desde MODULO PROVEEDORES");

    const nombre =
    document.getElementById("nombreProveedor")
    .value.trim();

    const telefono =
    document.getElementById("telefonoProveedor")
    .value.trim();

    if(!nombre){

        alert("Ingrese el nombre del proveedor.");

        return;

    }

    const body = {

        nombre,

        telefono,

        productos:
        productosSeleccionados.map(p => p.id)

    };

    try{

        let url =
        `${API}/compras/proveedores/`;

        let metodo = "POST";

        if(proveedorEditando){

            url =
            `${API}/compras/proveedores/${proveedorEditando}/editar/`;

            metodo = "PUT";

        }

        const res = await fetch(

            url,

            {

                method: metodo,

                headers: obtenerHeaders(),

                body: JSON.stringify(body)

            }

        );

        const data = await res.json();

        if(data.error){

            alert(data.error);

            return;

        }

        alert(

            proveedorEditando

            ? "Proveedor actualizado correctamente."

            : "Proveedor creado correctamente."

        );

        cerrarFormulario();

        cargarProveedores();

    }

    catch(error){

        console.error(error);

        alert("Ocurrió un error.");

    }

}

/* =====================================================
   EDITAR PROVEEDOR
===================================================== */

async function editarProveedor(id){

    try{

        const res = await fetch(

            `${API}/compras/proveedores/${id}/`,

            {

                headers: obtenerHeaders()

            }

        );

        const proveedor =
        await res.json();

        proveedorEditando = id;

        document.getElementById(
            "tituloProveedor"
        ).innerHTML =

        `<i class="bi bi-pencil-square"></i> Editar proveedor`;

        document.getElementById(
            "nombreProveedor"
        ).value =
        proveedor.nombre;

        document.getElementById(
            "telefonoProveedor"
        ).value =
        proveedor.telefono || "";

        productosSeleccionados = proveedor.productos || [];

        renderProductosProveedor();

        document.getElementById(
            "modalProveedor"
        ).style.display="flex";

    }

    catch(error){

        console.error(error);

        alert("No fue posible cargar el proveedor.");

    }

}

/* =====================================================
   ELIMINAR PROVEEDOR
===================================================== */

async function eliminarProveedor(id){

    const confirmar = confirm(

        "¿Desea eliminar este proveedor?"

    );

    if(!confirmar){

        return;

    }

    try{

        const res = await fetch(

            `${API}/compras/proveedores/${id}/eliminar/`,

            {

                method:"DELETE",

                headers:{

                    "Authorization":"Bearer "+token

                }

            }

        );

        const data =
        await res.json();

        if(data.error){

            alert(data.error);

            return;

        }

        alert(
            "Proveedor eliminado correctamente."
        );

        cargarProveedores();

    }

    catch(error){

        console.error(error);

        alert("Error al eliminar proveedor.");

    }

}

/* =====================================================
   EVENTOS
===================================================== */

// Botón Nuevo Proveedor
const btnNuevo = document.getElementById("btnNuevoProveedor");

if (btnNuevo) {
    btnNuevo.addEventListener("click", abrirFormulario);
}

// Botón Guardar
const btnGuardar = document.getElementById("btnGuardarProveedor");

if (btnGuardar) {
    btnGuardar.addEventListener("click", guardarProveedor);
}

// Botón Cancelar
const btnCancelar = document.getElementById("btnCancelarProveedor");

if (btnCancelar) {
    btnCancelar.addEventListener("click", cerrarFormulario);
}

/* =====================================================
   CERRAR MODAL HACIENDO CLICK AFUERA
===================================================== */

const modal = document.getElementById("modalProveedor");

if (modal) {

    modal.addEventListener("click", function (e) {

        if (e.target === modal) {

            cerrarFormulario();

        }

    });

}

/* =====================================================
   CERRAR CON ESC
===================================================== */

document.addEventListener("keydown", function (e) {

    if (e.key === "Escape") {

        cerrarFormulario();

    }

});

/* =====================================================
   RECARGAR TABLA
===================================================== */

function actualizarModuloProveedores() {

    cargarProveedores();

}

/* =====================================================
   EXPONER FUNCIONES AL HTML
===================================================== */

window.abrirFormulario = abrirFormulario;
window.cerrarFormulario = cerrarFormulario;

window.guardarProveedor = guardarProveedor;

window.editarProveedor = editarProveedor;

window.eliminarProveedor = eliminarProveedor;

window.agregarProductoProveedor = agregarProductoProveedor;

window.quitarProductoProveedor = quitarProductoProveedor;

/* =====================================================
   FIN DEL MÓDULO
===================================================== */

console.log("Módulo Proveedores cargado correctamente.");





