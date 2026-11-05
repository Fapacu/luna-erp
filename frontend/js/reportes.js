// =====================================
// TOKEN
// =====================================

const token =
localStorage.getItem("token")

if(!token){

    window.location.href =
    "login.html"
}


// =====================================
// VARIABLES
// =====================================

let grafico = null


let datosGlobal = []


// =====================================
// FORMATO GS
// =====================================

function formatoGs(n){

    return "Gs. " +
    Number(n).toLocaleString()
}


// =====================================
// KPIS
// =====================================

function cargarKPIs(data){

    document.getElementById(
        "totalVentas"
    ).innerText =
    data.total_ventas || 0

    document.getElementById(
        "totalProductos"
    ).innerText =
    data.total_productos || 0

    document.getElementById(
        "ingresoTotal"
    ).innerText =
    formatoGs(
        data.ingreso_total || 0
    )

    document.getElementById(
        "egresoTotal"
    ).innerText =
    formatoGs(
        data.egreso_total || 0
    )

    document.getElementById(
        "utilidadNeta"
    ).innerText =
    formatoGs(
        data.utilidad_neta || 0
    )

    document.getElementById(
        "crecimiento"
    ).innerText =
    (data.crecimiento || 0) + "%"

    document.getElementById(
        "prediccion"
    ).innerText =
    formatoGs(
        data.prediccion || 0
    )

    document.getElementById(
        "ticketPromedio"
    ).innerText =
    formatoGs(
        data.ticket_promedio || 0
    )

    document.getElementById(
        "roi"
    ).innerText =
    (data.roi || 0) + "%"

    document.getElementById(
        "margen"
    ).innerText =
    (data.margen || 0) + "%"
}


// =====================================
// GRAFICO PRODUCTOS
// =====================================

function renderProductos(productos){

    const nombres =
    productos.map(
        p => p.nombre
    )

    const cantidades =
    productos.map(
        p => p.cantidad
    )

    if(grafico){

        grafico.destroy()
    }

    grafico = new Chart(

        document.getElementById(
            "graficoProductos"
        ),

        {

            type:"bar",

            data:{

                labels:nombres,

                datasets:[{

                    label:
                    "Productos vendidos",

                    data:cantidades,

                    borderWidth:1
                }]
            },

            options:{

                responsive:true,

                plugins:{

                    legend:{
                        display:true
                    }
                }
            }
        }
    )

}



// =====================================
// TABLA PRODUCTOS
// =====================================

function renderTabla(productos){

    const tabla =
    document.getElementById(
        "tablaProductos"
    )

    tabla.innerHTML = ""

    if(productos.length === 0){

        tabla.innerHTML = `
        <tr>

            <td colspan="2">

                Sin datos

            </td>

        </tr>
        `

        return
    }

    productos.forEach(p => {

        const cantidad =
            Number(p.cantidad).toLocaleString("es-PY", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            })

        const unidad =
            p.unidad || ""

        tabla.innerHTML += `
        <tr>

            <td>
                ${window.escapeHtml(p.nombre)}
            </td>

            <td>
                ${cantidad} ${unidad}
            </td>

        </tr>
        `
    })

}


// =====================================
// ALERTAS STOCK
// =====================================

function renderAlertas(alertas){

    const cont =
    document.getElementById(
        "alertasStock"
    )

    cont.innerHTML = ""

    if(!alertas.length){

        cont.innerHTML =
        "Sin alertas"

        return
    }

    alertas.forEach(a => {

        cont.innerHTML += `
        <div class="rentable-item">

            <span>
                ${window.escapeHtml(a.nombre)}
            </span>

            <strong>

                Stock:
                ${a.stock}

            </strong>

        </div>
        `
    })

}


// =====================================
// TOP RENTABLES
// =====================================

async function cargarFinanciero(){

    try{

        const res = await fetch(

            window.apiUrl("reportes/dashboard-financiero/"),

            {

                headers:{
                    "Authorization":
                    "Bearer " + token
                }
            }
        )

        const data =
        await res.json()

        const top =
        document.getElementById(
            "topRentables"
        )

        top.innerHTML = ""

        data.top_productos.forEach(p => {

            top.innerHTML += `
            <div class="rentable-item">

                <span>

                    ${window.escapeHtml(p.producto__nombre)}

                </span>

                <strong>

                    ${formatoGs(
                        p.ganancia_total
                    )}

                </strong>

            </div>
            `
        })

    }catch(error){

        console.error(error)
    }

}


// =====================================
// REPORTE
// =====================================

async function cargarReporte(){

    try{

        const desde =
        document.getElementById(
            "fechaInicio"
        ).value

        const hasta =
        document.getElementById(
            "fechaFin"
        ).value

        if(!desde || !hasta){

            alert(
                "Seleccione fechas"
            )

            return
        }

        const res = await fetch(

            window.apiUrl(`reportes/dashboard-reporte/?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`),

            {

                headers:{
                    "Authorization":
                    "Bearer " + token
                }
            }
        )

        const data =
        await res.json()

        if(data.error){

            alert(data.error)

            return
        }

        datosGlobal =
        data.productos || []

        cargarKPIs(data)

        renderProductos(
            data.productos || []
        )

        renderTabla(
            data.productos || []
        )

        renderAlertas(
            data.alertas_stock || []
        )

    }catch(error){

        console.error(error)

        alert(
            "Error cargando reportes"
        )
    }

}


// =====================================
// EXPORTAR CSV
// =====================================

function exportarCSV(){

    if(datosGlobal.length === 0){

        alert(
            "No hay datos"
        )

        return
    }

    let csv =
    "Producto,Cantidad\n"

    datosGlobal.forEach(p => {

        csv +=
        `${p.nombre},${p.cantidad}\n`
    })

    const blob =
    new Blob([csv], {

        type:"text/csv"
    })

    const url =
    window.URL.createObjectURL(blob)

    const a =
    document.createElement("a")

    a.href = url

    a.download =
    "reporte.csv"

    a.click()
}


// =====================================
// FECHAS
// =====================================

function setHoy(){

    const hoy =
    new Date()
    .toISOString()
    .split("T")[0]

    fechaInicio.value = hoy
    fechaFin.value = hoy
}


function setSemana(){

    const hoy =
    new Date()

    const inicio =
    new Date(

        hoy.setDate(
            hoy.getDate() - 7
        )

    )

    .toISOString()
    .split("T")[0]

    fechaInicio.value = inicio

    fechaFin.value =
    new Date()
    .toISOString()
    .split("T")[0]
}


function setMes(){

    const hoy = new Date()

    const primerDia = new Date(
        hoy.getFullYear(),
        hoy.getMonth(),
        1
    )

    const ultimoDia = new Date(
        hoy.getFullYear(),
        hoy.getMonth() + 1,
        0
    )

    const formatearFecha = fecha => {

        return fecha
            .toISOString()
            .split("T")[0]

    }

    fechaInicio.value =
        formatearFecha(primerDia)

    fechaFin.value =
        formatearFecha(ultimoDia)
}

// =====================================
// AUTO REFRESH
// =====================================

setInterval(() => {

    cargarReporte()

    cargarFinanciero()

}, 30000)


// =====================================
// INIT
// =====================================

window.onload = () => {

    setMes()

    cargarReporte()

    cargarFinanciero()
}





