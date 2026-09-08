function logout() {

    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    localStorage.removeItem("rol");
    localStorage.removeItem("username");

    window.location.href = BASE_PATH + "login.html";

}

function mostrarRol() {

    const usuario = JSON.parse(localStorage.getItem("usuario"));

    if (!usuario) return "";

    return `
        <strong>${usuario.username}</strong>
        <br>
        <small>${usuario.rol}</small>
    `;

}

function cargarSidebar() {

    const contenedor = document.getElementById("sidebar-container");

    if (!contenedor) return;

    const rol = localStorage.getItem("rol");

    const paginaActual = window.location.pathname.split("/").pop();

    const menu = [

        {
            texto: "Dashboard",
            icono: "bi-speedometer2",
            url: "dashboard.html",
            roles: ["ADMIN","CAJERO"]
        },

        {
            texto: "Inventario",
            icono: "bi-box-seam",
            url: "inventario/productos.html",
            roles: ["ADMIN","CAJERO"]
        },

        {
            texto: "Compras",
            icono: "bi-cart-check",
            url: "compras/compras.html",
            roles: ["ADMIN"]
        },

        {
            texto: "Proveedores",
            icono: "bi-truck",
            url: "compras/proveedores.html",
            roles: ["ADMIN","CAJERO"]
        },

        {
            texto: "Caja",
            icono: "bi-cash-stack",
            url: "ventas/caja.html",
            roles: ["ADMIN","CAJERO"]
        },

        {
            texto: "Cuentas por Cobrar",
            icono: "bi-journal-text",
            url: "ventas/libreta.html",
            roles: ["ADMIN","CAJERO"]
        },

        {
            texto: "Reportes",
            icono: "bi-bar-chart",
            url: "reportes.html",
            roles: ["ADMIN"]
        },

        {
            texto: "Finanzas",
            icono: "bi-wallet2",
            url: "finanzas.html",
            roles: ["ADMIN"]
        },

        {
            texto: "Usuarios",
            icono: "bi-person-gear",
            url: "usuarios.html",
            roles: ["ADMIN"]
        },

        {
            texto: "Auditoría",
            icono: "bi-clipboard-check",
            url: "auditoria.html",
            roles: ["ADMIN"]
        }

    ];

    let html = `

        <div class="sidebar">

            <div class="logo">
                <div class="logo-icon">🌙</div>
                <div>
                    <h2>Luna ERP</h2>
                    <small>Sistema de Gestión</small>
                </div>
            </div>

            <div class="usuario-panel">

                ${mostrarRol()}

            </div>

            <nav class="menu">

    `;

    menu.forEach(item => {

        if (!item.roles.includes(rol)) return;

        const activo =
            paginaActual === item.url.split("/").pop()
            ? "active"
            : "";

        html += `

            <a class="${activo}" href="${BASE_PATH}${item.url}">
                <i class="bi ${item.icono}"></i>
                <span>${item.texto}</span>
            </a>

        `;

    });

    html += `

            </nav>

            <button class="btn-salir"
                    onclick="logout()">

                🚪 Salir

            </button>

        </div>

    `;

    contenedor.innerHTML = html;

}