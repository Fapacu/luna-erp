function cargarHeader(titulo = "Dashboard") {

    const contenedor = document.getElementById("header-container");

    if (!contenedor) return;

    const usuario = JSON.parse(localStorage.getItem("usuario"));

    const nombre = usuario?.username || "Usuario";
    const rol = usuario?.rol || "";

    const inicial = nombre.charAt(0).toUpperCase();

    contenedor.innerHTML = `

        <header class="header">

            <div class="header-left">

                <h1>${window.escapeHtml(titulo)}</h1>

            </div>

            <div class="header-right">



                <div class="user-info">

                    <div class="user-avatar">

                        ${window.escapeHtml(inicial)}

                    </div>

                    <div class="user-name">

                        <strong>${window.escapeHtml(nombre)}</strong>

                        <small>${window.escapeHtml(rol)}</small>

                    </div>

                </div>

            </div>

        </header>

    `;

}




