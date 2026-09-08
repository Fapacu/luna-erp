const API =
"http://127.0.0.1:8000/api/auditoria"

const token =
localStorage.getItem("token")


function convertirFecha(fecha) {

    const partes = fecha.split(" ")

    const fechaParte = partes[0]
    const horaParte = partes[1] || "00:00:00"

    const [dia, mes, anio] =
        fechaParte.split("/").map(Number)

    const [hora, minuto, segundo] =
        horaParte.split(":").map(Number)

    return new Date(
        anio,
        mes - 1,
        dia,
        hora,
        minuto,
        segundo
    )
}


async function cargarAuditoria(){

    try{

        const response = await fetch(
            API + "/",
            {
                headers:{
                    "Authorization":
                    "Bearer " + token
                }
            }
        )

        const data = await response.json()

        const tabla =
            document.getElementById(
                "tablaAuditoria"
            )

        tabla.innerHTML = ""

        const usuarioFiltro =
            document
            .getElementById("buscarUsuario")
            .value
            .toLowerCase()

        const moduloFiltro =
            document
            .getElementById("buscarModulo")
            .value
            .toLowerCase()

        const desde =
            document.getElementById(
                "fechaDesde"
            ).value

        const hasta =
            document.getElementById(
                "fechaHasta"
            ).value


        const registros = data.filter(r => {

            const usuario =
                (r.usuario || "")
                .toLowerCase()

            const modulo =
                (r.modulo || "")
                .toLowerCase()


            const fechaRegistro =
                convertirFecha(r.fecha)


            // FILTRO DESDE
            if(desde){

                const fechaDesde =
                    new Date(desde + "T00:00:00")

                if(fechaRegistro < fechaDesde){
                    return false
                }

            }


            // FILTRO HASTA
            if(hasta){

                const fechaHasta =
                    new Date(hasta + "T23:59:59")

                if(fechaRegistro > fechaHasta){
                    return false
                }

            }


            return (

                usuario.includes(
                    usuarioFiltro
                )

                &&

                modulo.includes(
                    moduloFiltro
                )

            )

        })


        registros.forEach(r => {

            tabla.innerHTML += `

            <tr>

                <td>${r.id}</td>

                <td>${r.fecha}</td>

                <td>${r.usuario}</td>

                <td>${r.modulo}</td>

                <td>${r.accion}</td>

                <td>${r.referencia || "-"}</td>

                <td>${r.detalle || "-"}</td>

            </tr>

            `

        })


        document
        .getElementById(
            "totalRegistros"
        )
        .innerText =
        registros.length

    }

    catch(error){

        console.error(error)

    }

}


document.addEventListener(
    "DOMContentLoaded",
    function(){
        cargarAuditoria()
    }
)