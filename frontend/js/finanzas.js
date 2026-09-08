document.addEventListener("DOMContentLoaded", () => {

const tabla =
document.getElementById(
    "tablaMovimientos"
)

const token =
localStorage.getItem("token")


/* ======================
HEADERS
====================== */

const headers = {

    "Content-Type":"application/json",

    "Authorization":
    "Bearer " + token
}


let grafico = null


/* ======================
CARGAR FINANZAS
====================== */

async function cargarFinanzas(){

    try{

        const res = await fetch(

            "http://127.0.0.1:8000/api/finanzas/movimientos/",

            {
                headers
            }
        )

        const data = await res.json()

        tabla.innerHTML = ""

        let ingresos = 0
        let egresos = 0

        const labels = []
        const valores = []

        data.forEach(m => {

            const monto =
            Number(m.monto)

            if(m.tipo === "INGRESO"){

                ingresos += monto

            }else{

                egresos += monto
            }

            labels.push(
                m.categoria
            )

            valores.push(
                monto
            )

            tabla.innerHTML += `
            <tr>

                <td>
                    ${m.id}
                </td>

                <td>

                    <span style="
                    color:
                    ${
                        m.tipo === "INGRESO"
                        ? "#16a34a"
                        : "#dc2626"
                    };
                    font-weight:bold;
                    ">

                        ${m.tipo}

                    </span>

                </td>

                <td>
                    ${m.categoria}
                </td>

                <td>
                    ${m.descripcion}
                </td>

                <td>

                    Gs.
                    ${monto.toLocaleString()}

                </td>

                <td>

                    ${
                        new Date(
                            m.fecha
                        ).toLocaleDateString()
                    }

                </td>

            </tr>
            `
        })


        /* KPIS */

        const utilidad =
        ingresos - egresos

        document.getElementById(
            "kpiIngresos"
        ).innerText =
        "Gs. " +
        ingresos.toLocaleString()

        document.getElementById(
            "kpiEgresos"
        ).innerText =
        "Gs. " +
        egresos.toLocaleString()

        document.getElementById(
            "kpiUtilidad"
        ).innerText =
        "Gs. " +
        utilidad.toLocaleString()

        document.getElementById(
            "kpiBalance"
        ).innerText =
        utilidad >= 0
        ? "POSITIVO"
        : "NEGATIVO"


        /* GRAFICO */

        renderGrafico(
            labels,
            valores
        )

    }catch(error){

        console.error(error)
    }

}


/* ======================
GRAFICO
====================== */

function renderGrafico(
    labels,
    valores
){

    const ctx =
    document.getElementById(
        "graficoFinanzas"
    )

    if(grafico){

        grafico.destroy()
    }

    grafico = new Chart(ctx, {

        type:"bar",

        data:{

            labels,

            datasets:[{

                label:
                "Movimientos",

                data: valores,

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
    })

}


/* ======================
ABRIR MODAL
====================== */

window.abrirFormulario = function(){

    document.getElementById(
        "modalGasto"
    ).style.display = "flex"
}


/* ======================
CERRAR MODAL
====================== */

window.cerrarFormulario = function(){

    document.getElementById(
        "modalGasto"
    ).style.display = "none"
}


/* ======================
GUARDAR GASTO
====================== */

window.guardarGasto = async function(){

    try{

        const categoria =
        document.getElementById(
            "categoria"
        ).value

        const descripcion =
        document.getElementById(
            "descripcion"
        ).value

        const monto =
        document.getElementById(
            "monto"
        ).value


        const res = await fetch(

            "http://127.0.0.1:8000/api/finanzas/gastos/",

            {

                method:"POST",

                headers,

                body: JSON.stringify({

                    categoria,
                    descripcion,
                    monto
                })
            }
        )

        const data =
        await res.json()

        if(data.error){

            alert(data.error)

            return
        }

        alert(
            "Gasto registrado"
        )

        cerrarFormulario()

        limpiarFormulario()

        cargarFinanzas()

    }catch(error){

        console.error(error)

        alert(
            "Error registrando gasto"
        )
    }

}


/* ======================
LIMPIAR
====================== */

function limpiarFormulario(){

    document.getElementById(
        "categoria"
    ).value = "GASTO"

    document.getElementById(
        "descripcion"
    ).value = ""

    document.getElementById(
        "monto"
    ).value = ""
}


/* ======================
INICIO
====================== */

cargarFinanzas()

})