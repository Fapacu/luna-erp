function aplicarPermisosMenu() {

    const rol = localStorage.getItem("rol");

    const ocultar = (id) => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.style.display = "none";
        }
    };

    switch (rol) {

        case "ADMIN":
            // Ve todo
            break;

        case "GERENTE":

            ocultar("menu-usuarios");
            ocultar("menu-configuracion");

            break;

        case "CAJERO":

            ocultar("menu-usuarios");
            ocultar("menu-productos");
            ocultar("menu-compras");
            ocultar("menu-finanzas");
            ocultar("menu-reportes");
            ocultar("menu-configuracion");

            break;

        default:
            window.location.href = "../login.html";
    }

}




