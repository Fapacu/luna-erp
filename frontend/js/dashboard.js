// ======================
// VALIDACIÓN SIMPLE
// ======================

if (localStorage.getItem("rol") !== "ADMIN" && localStorage.getItem("rol") !== "CAJERO") {

    window.location.href = "dashboard.html";

}

const token =
localStorage.getItem("token")

let graficoVentas = null

// ======================
// DASHBOARD DATA
// ======================

function cargarDashboard(){

fetch(

    "http://127.0.0.1:8000/api/dashboard/",

    {

        headers:{

            "Authorization":
            "Bearer " + token

        }

    }

)

.then(res => res.json())

.then(data => {

    console.log(
        "DATA DASHBOARD:",
        data
    )

    if(
        document.getElementById(
            "ventas_hoy"
        )
    ){

        document.getElementById(
            "ventas_hoy"
        ).innerText =

        "$ " +

        Number(
            data.total_hoy
        ).toLocaleString(
            'es-CL'
        )

    }

    if(
        document.getElementById(
            "productos_hoy"
        )
    ){

        document.getElementById(
            "productos_hoy"
        ).innerText =

        data.productos_hoy

    }

    if(
        document.getElementById(
            "caja_total"
        )
    ){

        document.getElementById(
            "caja_total"
        ).innerText =

        "$ " +

        Number(
            data.caja_total
        ).toLocaleString(
            'es-CL'
        )

    }

    // ======================
    // GRÁFICO
    // ======================

    const canvas =
    document.getElementById(
        "graficoVentas"
    )

    if(canvas){

        const ctx =
        canvas.getContext("2d")

        if(graficoVentas){

            graficoVentas.destroy()

        }

        graficoVentas =
        new Chart(ctx, {

            type: "bar",

            data: {

                labels: [

                    "Efectivo",

                    "Tarjeta",

                    "Transferencia"

                ],

                datasets: [

                    {

                        label:
                        "Ventas por método de pago",

                        data: [

                            data.efectivo,

                            data.tarjeta,

                            data.transferencia

                        ]

                    }

                ]

            }

        })

    }

})

.catch(error => {

    console.error(error)

})

}

// ======================
// STOCK BAJO
// ======================

function cargarAlertas(){

fetch(

    "http://127.0.0.1:8000/api/dashboard/alertas-stock/",

    {

        headers:{

            "Authorization":
            "Bearer " + token

        }

    }

)

.then(res => res.json())

.then(data => {

    const lista =
    document.getElementById(
        "alertas"
    )

    if(!lista) return

    lista.innerHTML = ""

    if(data.length === 0){

        lista.innerHTML =

        "<li>No hay productos con stock bajo</li>"

        return

    }

    data.forEach(p => {

        lista.innerHTML += `

        <li
            style="
            color:red;
            font-weight:bold;
            "
        >

            ${p.nombre}

            - Stock:

            ${p.stock}

        </li>

        `

    })

})

.catch(error => {

    console.error(error)

})

}

// ======================
// CAJA ACTUAL
// ======================

function cargarCajaActual(){

fetch(

    "http://127.0.0.1:8000/api/ventas/caja/actual/",

    {

        headers:{

            "Authorization":
            "Bearer " + token

        }

    }

)

.then(res => res.json())

.then(data => {

    if(data.error) return

    const caja =
    document.getElementById(
        "caja_actual"
    )

    if(caja){

        caja.innerText =

        "$ " +

        Number(
            data.total
        ).toLocaleString(
            "es-CL"
        )

    }

})

.catch(error => {

    console.error(error)

})

}

// ======================
// USUARIO
// ======================

function cargarUsuario(){

const rol =
localStorage.getItem("rol")

const usuario =
localStorage.getItem("username")

const rolBox =
document.getElementById(
    "rolUsuario"
)

if(rolBox){

    rolBox.innerText =

    usuario +

    " - " +

    rol

    if(rol === "ADMIN"){

        rolBox.style.color =
        "#22c55e"

    }

    else{

        rolBox.style.color =
        "#f59e0b"

    }

}

}

// ======================
// LOGOUT
// ======================

function logout(){

localStorage.clear()

window.location.href =
"login.html"

}

// ======================
// INICIO
// ======================

window.onload = function(){

    cargarDashboard()

    cargarAlertas()

    cargarCajaActual()

    cargarUsuario()

    setInterval(

        cargarCajaActual,

        5000

    )

}