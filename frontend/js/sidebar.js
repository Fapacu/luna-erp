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
        <strong>${window.escapeHtml(usuario.username)}</strong>
        <br>
        <small>${window.escapeHtml(usuario.rol)}</small>
    `;
}

function iconoSidebar(nombre) {
    const trazos = {
        "logo": '<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.7 8.7 0 1 0 20.5 14.2Z"/><path d="m16.5 4 .5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5Z"/>',
        "bi-speedometer2": '<path d="M3 13a9 9 0 1 1 18 0"/><path d="m12 13 4-5"/><circle cx="12" cy="13" r="1"/>',
        "bi-box-seam": '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.3 7.7 7.7 4.4 7.7-4.4M12 12v9"/>',
        "bi-cart-check": '<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M2 3h2l2.5 12h12L21 7H5"/><path d="m10 10 2 2 4-4"/>',
        "bi-truck": '<path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="17.5" cy="19" r="1.5"/>',
        "bi-cash-stack": '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M7 6V4h14v13h-3M12 10a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM3 10h2m-2 5h2"/>',
        "bi-journal-text": '<path d="M5 3h14v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M7 7h8M7 11h10M7 15h8M7 3v18"/>',
        "bi-bar-chart": '<path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7M2 20h20"/>',
        "bi-wallet2": '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M16 14h2"/>',
        "bi-person-gear": '<circle cx="10" cy="8" r="3"/><path d="M4 20v-2a6 6 0 0 1 9-5.2M17 14l.6 1.2 1.3.2-.9 1 .2 1.3-1.2-.6-1.2.6.2-1.3-.9-1 1.3-.2L17 14Z"/>',
        "bi-clipboard-check": '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 12l2 2 5-5"/>',
        "menu": '<path d="M3 6h18M3 12h18M3 18h18"/>',
        "salir": '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/>',
        "cerrar": '<path d="m15 18-6-6 6-6"/>',
        "abrir": '<path d="m9 18 6-6-6-6"/>'
    };
    return `<svg class="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${trazos[nombre] || ""}</svg>`;
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
            roles: ["ADMIN", "GERENTE", "CAJERO"]
        },

        {
            texto: "Inventario",
            icono: "bi-box-seam",
            url: "inventario/productos.html",
            roles: ["ADMIN", "GERENTE", "CAJERO"]
        },

        {
            texto: "Registrar compra",
            icono: "bi-cart-check",
            url: "compras/registrar_compra.html",
            roles: ["ADMIN", "GERENTE"]
        },

        {
            texto: "Compras realizadas",
            icono: "bi-journal-text",
            url: "compras/compras.html",
            roles: ["ADMIN", "GERENTE"]
        },

        {
            texto: "Proveedores",
            icono: "bi-truck",
            url: "compras/proveedores.html",
            roles: ["ADMIN", "GERENTE"]
        },

        {
            texto: "Caja",
            icono: "bi-cash-stack",
            url: "ventas/caja.html",
            roles: ["ADMIN", "GERENTE", "CAJERO"]
        },

        {
            texto: "Cuentas por Cobrar",
            icono: "bi-journal-text",
            url: "ventas/libreta.html",
            roles: ["ADMIN", "GERENTE", "CAJERO"]
        },

        {
            texto: "Reportes",
            icono: "bi-bar-chart",
            url: "reportes.html",
            roles: ["ADMIN", "GERENTE"]
        },

        {
            texto: "Finanzas",
            icono: "bi-wallet2",
            url: "finanzas.html",
            roles: ["ADMIN", "GERENTE"]
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
            roles: ["ADMIN", "GERENTE"]
        }

    ];


    let html = `

        <button class="mobile-menu-btn"
                id="mobileMenuBtn"
                type="button"
                aria-label="Abrir menú">

            ${iconoSidebar("menu")}

        </button>


        <div class="mobile-overlay"
             id="mobileOverlay">
        </div>


        <div class="sidebar" id="mainSidebar">

            <button class="sidebar-collapse-btn" id="sidebarCollapseBtn"
                    type="button" aria-label="Contraer menú" title="Contraer menú">
                ${iconoSidebar("cerrar")}
            </button>

            <div class="logo">

                <div class="logo-icon">
                    ${iconoSidebar("logo")}
                </div>

                <div>

                    <h2>Luna ERP</h2>

                    <small>
                        Sistema de Gestión
                    </small>

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

            <a class="${activo}"
               href="${BASE_PATH}${item.url}"
               title="${item.texto}">

                ${iconoSidebar(item.icono)}

                <span>
                    ${item.texto}
                </span>

            </a>

        `;

    });


    html += `

            </nav>


            <button class="btn-salir"
                    onclick="logout()">

                ${iconoSidebar("salir")}
                <span>Salir</span>

            </button>


        </div>

    `;


    contenedor.innerHTML = html;


    const boton = document.getElementById("mobileMenuBtn");
    const sidebar = document.getElementById("mainSidebar");
    const overlay = document.getElementById("mobileOverlay");
    const botonContraer = document.getElementById("sidebarCollapseBtn");

    const aplicarEstadoSidebar = (contraido) => {
        document.body.classList.toggle("sidebar-collapsed", contraido);
        if (botonContraer) {
            const icono = botonContraer.querySelector("svg");
            const texto = contraido ? "Expandir menú" : "Contraer menú";
            botonContraer.setAttribute("aria-label", texto);
            botonContraer.title = texto;
            if (icono) icono.innerHTML = contraido
                ? '<path d="m9 18 6-6-6-6"/>'
                : '<path d="m15 18-6-6 6-6"/>';
        }
    };

    aplicarEstadoSidebar(localStorage.getItem("sidebarContraido") === "true");

    botonContraer?.addEventListener("click", () => {
        const contraido = !document.body.classList.contains("sidebar-collapsed");
        localStorage.setItem("sidebarContraido", String(contraido));
        aplicarEstadoSidebar(contraido);
    });


    if (!boton || !sidebar || !overlay) return;


    boton.addEventListener("click", () => {

        sidebar.classList.toggle("open");
        overlay.classList.toggle("open");

    });


    overlay.addEventListener("click", () => {

        sidebar.classList.remove("open");
        overlay.classList.remove("open");

    });


    const enlaces = sidebar.querySelectorAll(".menu a");


    enlaces.forEach(enlace => {

        enlace.addEventListener("click", () => {

            sidebar.classList.remove("open");
            overlay.classList.remove("open");

        });

    });

}
