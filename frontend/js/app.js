const rol = localStorage.getItem("rol")

const rolBox = document.getElementById("rolUsuario")

/* detectar si ya estamos en el dashboard */

if (window.location.pathname.includes("dashboard.html")) {

    console.log("Ya estás en el dashboard")

    const btnDashboard = document.getElementById("menuDashboard")

    if (btnDashboard) {

        btnDashboard.addEventListener("click", function (e) {

            /* evitar recargar la misma página */

            e.preventDefault()

            console.log("Ya estás en el dashboard")

        })

    }

}

if (rolBox) {

    rolBox.innerText = localStorage.getItem("username") + " - " + rol

}

/* ocultar menus */

if (rol === "CAJERO") {

    const inv = document.getElementById("menuInventario")
    const rep = document.getElementById("menuReportes")
    const usr = document.getElementById("menuUsuarios")

    if (inv) inv.style.display = "none"
    if (rep) rep.style.display = "none"
    if (usr) usr.style.display = "none"

}

/* colores de rol */

if (rolBox) {

    if (rol === "ADMIN") {
        rolBox.style.color = "#ffdd00"
    }

    if (rol === "GERENTE") {
        rolBox.style.color = "#3b82f6"
    }

    if (rol === "CAJERO") {
        rolBox.style.color = "#f59e0b"
    }

}

/* ======================
SALIR LOGOUT
====================== */
const btnSalir = document.querySelector(".btn-salir");
if (btnSalir) {
    btnSalir.addEventListener("click", function () {
        localStorage.removeItem("token");
        localStorage.removeItem("rol");
        localStorage.removeItem("username");
    });
}





