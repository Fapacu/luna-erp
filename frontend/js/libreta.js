const token =
localStorage.getItem("token")

const API = "http://127.0.0.1:8000/api";

let cuentas = []

fetch(
    "http://127.0.0.1:8000/api/ventas/libreta/",
    {
        headers: {
            "Authorization":
                "Bearer " + token
        }
    }
)

.then(res => res.json())

.then(data => {

    cuentas = data;

    actualizarKPIs(cuentas);

    renderTabla(cuentas);

})

.catch(error => {

    console.error(error)

})


function actualizarKPIs(lista){

    const totalLibretas = lista.length;

    const totalAdeudado = lista.reduce(

        (acc,item)=>acc + Number(item.saldo),

        0

    );

    const pendientes = lista.filter(

        item => !item.cancelada

    ).length;

    const canceladas = lista.filter(

        item => item.cancelada

    ).length;

    document.getElementById("kpiLibretas").textContent =
    totalLibretas;

    document.getElementById("kpiTotalAdeudado").textContent =
    "Gs. " + totalAdeudado.toLocaleString();

    document.getElementById("kpiPendientes").textContent =
    pendientes;

    document.getElementById("kpiCanceladas").textContent =
    canceladas;

}


function renderTabla(lista){

    const tabla =
    document.getElementById("tablaLibreta");

    tabla.innerHTML = "";

    lista.forEach(item => {

        tabla.innerHTML += `

        <tr>

            <td>

                <div class="cliente-info">

                    <div class="avatar-cliente">

                        ${item.cliente_nombre.charAt(0).toUpperCase()}

                    </div>

                    <div>

                        <strong>

                            ${item.cliente_nombre}

                        </strong>

                        <small>

                            Cuenta corriente

                        </small>

                    </div>

                </div>

            </td>

            <td>

                Gs. ${Number(item.total).toLocaleString()}

            </td>

            <td>

                Gs. ${Number(item.pagado).toLocaleString()}

            </td>

            <td>

                <strong>

                    Gs. ${Number(item.saldo).toLocaleString()}

                </strong>

            </td>

            <td>

                ${
                    item.cancelada

                    ?

                    `<span class="badge badge-danger">

                        CANCELADA

                    </span>`

                    :

                    `<span class="badge badge-success">

                        ACTIVA

                    </span>`
                }

            </td>

            <td>

                <div class="acciones">

                    <button

                        class="btn-icon btn-detalle"

                        onclick="verDetalle(${item.id})"

                        title="Ver detalle">

                        <i class="bi bi-eye-fill"></i>

                    </button>

                    <button

                        class="btn-icon btn-cobrar"

                        onclick="cobrar(${item.id})"

                        title="Registrar pago">

                        <i class="bi bi-cash-coin"></i>

                    </button>

                </div>

            </td>

        </tr>

        `;

    });

}

document
.getElementById("buscarCliente")
.addEventListener(
    "input",
    function () {

        const texto =
        this.value.toLowerCase()

        const filtrados =
        cuentas.filter(c =>

            c.cliente_nombre
            .toLowerCase()
            .includes(texto)

        )

        renderTabla(filtrados)

    }
)

async function verDetalle(id){

    try{

        const res = await fetch(

            `http://127.0.0.1:8000/api/ventas/libreta/${id}/`,

            {

                headers:{

                    "Authorization":"Bearer " + token

                }

            }

        );

        const data = await res.json();

        let html = `

            <div class="estado-cuenta">

                <h2>${data.cliente}</h2>

                <hr>

                <p><strong>Total:</strong> Gs. ${Number(data.total).toLocaleString()}</p>

                <p><strong>Pagado:</strong> Gs. ${Number(data.pagado).toLocaleString()}</p>

                <p><strong>Saldo:</strong> Gs. ${Number(data.saldo).toLocaleString()}</p>

                <hr>

        `;

        data.movimientos.forEach(m=>{

            html += `

                <div class="movimiento">

                    <div class="movimiento-header">

                        <strong>

                            ${m.tipo === "COMPRA"

                                ? "🛒 Compra"

                                : "💵 Pago"}

                        </strong>

                        <span>

                            ${m.fecha}

                        </span>

                    </div>

                    <div>

                        Monto:

                        <strong>

                            Gs. ${Number(m.monto).toLocaleString()}

                        </strong>

                    </div>

            `;

            if(m.productos.length){

                html += `

                    <table class="tabla-detalle">

                        <thead>

                            <tr>

                                <th>Producto</th>

                                <th>Cant.</th>

                                <th>Precio</th>

                                <th>Subtotal</th>

                            </tr>

                        </thead>

                        <tbody>

                `;

                m.productos.forEach(p=>{

                    html += `

                        <tr>

                            <td>${p.producto}</td>

                            <td>${p.cantidad}</td>

                            <td>Gs. ${Number(p.precio).toLocaleString()}</td>

                            <td>Gs. ${Number(p.subtotal).toLocaleString()}</td>

                        </tr>

                    `;

                });

                html += `

                        </tbody>

                    </table>

                `;

            }

            html += `

                <hr>

            `;

        });

        html += `

            </div>

        `;

        document.getElementById("detalleProductos").innerHTML = html;

        document.getElementById("modalDetalle").style.display = "flex";

    }

    

    catch(error){

        console.error(error);

        alert("No se pudo cargar el detalle.");

    }

}

function cerrarModal(){

    document.getElementById(
        "modalDetalle"
    ).style.display =
    "none"

}

function cobrar(id){

    const monto = prompt(

        "Ingrese el monto cobrado:"

    )

    if(!monto){

        return

    }

    fetch(

        `http://127.0.0.1:8000/api/ventas/libreta/${id}/cobrar/`,

        {

            method:"POST",

            headers:{

                "Content-Type":
                "application/json",

                "Authorization":
                "Bearer " + token

            },

            body:JSON.stringify({

                monto:monto

            })

        }

    )

    .then(r=>r.json())

    .then(data=>{

        if(data.error){

            alert(data.error)

            return

        }

        alert(

            "Pago registrado correctamente"

        )

        location.reload()

    })

}