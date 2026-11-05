const API =
window.apiUrl("auditoria/")

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

    const tabla = document.getElementById("tablaAuditoria");
    const total = document.getElementById("totalRegistros");

    try{

        const response = await fetch(
            API,
            {
                headers:{
                    "Authorization":
                    "Bearer " + token
                }
            }
        )

        if (!response.ok) {
            throw new Error(response.status === 401 || response.status === 403
                ? "Tu sesión venció o no tienes permiso para consultar la auditoría."
                : `El servidor respondió con error (${response.status}).`);
        }

        const data = await response.json()

        if (!Array.isArray(data)) {
            throw new Error("El servidor devolvió un formato de auditoría inesperado.");
        }

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


            const fechaRegistro = convertirFecha(r.fecha)
            if (Number.isNaN(fechaRegistro.getTime())) return false


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

                <td>${window.escapeHtml(r.usuario)}</td>

                <td>${window.escapeHtml(r.modulo)}</td>

                <td>${window.escapeHtml(r.accion)}</td>

                <td>${window.escapeHtml(r.referencia || "-")}</td>

                <td>${window.escapeHtml(r.detalle || "-")}</td>

            </tr>

            `

        })


        total.innerText = registros.length

        if (registros.length === 0) {
            tabla.innerHTML = '<tr><td colspan="7">No hay registros que coincidan con la búsqueda.</td></tr>'
        }

    }

    catch(error){

        console.error(error)
        tabla.innerHTML = `<tr><td colspan="7">${window.escapeHtml(error.message || "No se pudo cargar la auditoría.")}</td></tr>`
        total.innerText = "—"

    }

}


document.addEventListener(
    "DOMContentLoaded",
    function(){
        cargarAuditoria()
    }
)





