const API = `${window.API_BASE_URL}/usuarios/`;
let usuarios = [];

let rolesDisponibles = [];

function cargarRoles(){
    fetch(API + "roles/", {
        headers: {"Authorization": "Bearer " + localStorage.getItem("token")}
    })
    .then(res => res.ok ? res.json() : Promise.reject(new Error("No se pudieron cargar los roles")))
    .then(roles => {
        rolesDisponibles = roles;
        const select = document.getElementById("role");
        select.replaceChildren(...roles.map(role => {
            const option = document.createElement("option");
            option.value = role.id;
            option.textContent = role.nombre === "ADMIN" ? "Administrador" : role.nombre === "GERENTE" ? "Gerente" : "Cajero";
            return option;
        }));
    })
    .catch(error => console.error(error));
}

function cargarUsuarios() {

    fetch(API, {
        headers: {
            "Authorization": "Bearer " + localStorage.getItem("token")
        }
    })
    .then(res => res.json())
    .then(data => {


        usuarios = data;
        const tabla = document.getElementById("tablaUsuarios");
        tabla.innerHTML = "";

        data.forEach(u => {
            tabla.innerHTML += `
                <tr>
                    <td>${window.escapeHtml(u.username)}</td>
                    <td>${window.escapeHtml(u.email)}</td>
                    <td>${window.escapeHtml(u.rol)}</td>
                    <td>${u.is_active ? "Activo" : "Inactivo"}</td>
                    <td class="acciones-usuario">
                        <button type="button" class="btn-icon btn-editar" title="Editar usuario"
                            aria-label="Editar usuario ${window.escapeHtml(u.username)}" onclick="editarUsuario(${u.id})">
                            <i class="bi bi-pencil-square" aria-hidden="true"></i>
                        </button>
                        <button type="button" class="btn-icon btn-pass" title="Cambiar contraseña"
                            aria-label="Cambiar contraseña de ${window.escapeHtml(u.username)}" onclick="abrirModalPassword(${u.id})">
                            <i class="bi bi-key-fill" aria-hidden="true"></i>
                        </button>
                        <button type="button" class="btn-icon btn-eliminar" title="Eliminar usuario"
                            aria-label="Eliminar usuario ${window.escapeHtml(u.username)}" onclick="eliminar(${u.id})">
                            <i class="bi bi-trash-fill" aria-hidden="true"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

    });
}

function guardarUsuario(){

    const id = document.getElementById("user_id").value;

    const datos = {
        username: document.getElementById("username").value,
        email: document.getElementById("email").value,
        role_id: document.getElementById("role").value,
        is_active: document.getElementById("is_active").checked
    };

    // Solo enviar contraseña cuando estamos creando un usuario
    if(id === ""){
        const password = document.getElementById("password").value;

        if(!password){
            alert("La contraseña es obligatoria.");
            return;
        }

        datos.password = password;
    }

    let url = API + "crear/";
    let metodo = "POST";

    if(id !== ""){
        url = API + "editar/" + id + "/";
        metodo = "PUT";
    }

    fetch(url,{
        method: metodo,
        headers:{
            "Content-Type":"application/json",
            "Authorization":"Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify(datos)
    })
    .then(async res => {

        const data = await res.json();

        if(!res.ok){
            alert(data.error || "Ocurrió un error");
            return;
        }

        alert(data.msg);
        cerrarModal();
        cargarUsuarios();
    })
    .catch(err => {
        console.error(err);
        alert("Error al conectar con el servidor");
    });
}


function eliminar(id) {

    if (!confirm("Eliminar usuario?")) return;

    fetch(API + "eliminar/" + id + "/", {
        method: "DELETE",
        headers: {
            "Authorization": "Bearer " + localStorage.getItem("token")
        }
    })
    .then(() => cargarUsuarios());
}



function editarUsuario(id){

    const u = usuarios.find(x => x.id == id);

    if(!u){
        alert("Usuario no encontrado");
        return;
    }

    abrirModal("editar");

    document.getElementById("tituloModal").innerText = "Editar Usuario";

    document.getElementById("user_id").value = u.id;
    document.getElementById("username").value = u.username;
    document.getElementById("email").value = u.email;

    document.getElementById("role").value = u.role_id;

    document.getElementById("is_active").checked = u.is_active;

    document.getElementById("btnGuardar").innerText = "Actualizar";
}

function abrirModalPassword(id){

    document.getElementById("password_user_id").value = id;

    document.getElementById("nueva_password").value = "";

    document.getElementById("confirmar_password").value = "";

    document.getElementById("mostrarPassword").checked = false;

    document.getElementById("nueva_password").type = "password";

    document.getElementById("confirmar_password").type = "password";

    document.getElementById("modalPassword").style.display = "flex";

}

function cerrarModalPassword(){

    document.getElementById("modalPassword").style.display = "none";
    document.getElementById("password_user_id").value = "";
    document.getElementById("nueva_password").value = "";
    document.getElementById("confirmar_password").value = "";
    document.getElementById("mostrarPassword").checked = false;
    document.getElementById("nueva_password").type = "password";
    document.getElementById("confirmar_password").type = "password";

}

function cerrarModal(){

    document.getElementById("modal").style.display = "none";

    document.getElementById("user_id").value = "";
    document.getElementById("username").value = "";
    document.getElementById("email").value = "";

    document.getElementById("username").disabled = false;

    document.getElementById("tituloModal").innerText = "Nuevo Usuario";
    document.getElementById("btnGuardar").innerText = "Guardar";
}

function mostrarPasswords(){

    const tipo = document.getElementById("mostrarPassword").checked
        ? "text"
        : "password";

    document.getElementById("nueva_password").type = tipo;

    document.getElementById("confirmar_password").type = tipo;

}

function guardarPassword(){

    const id = document.getElementById("password_user_id").value;

    const password = document.getElementById("nueva_password").value;

    const confirmar = document.getElementById("confirmar_password").value;

    if(password.length < 8){

        alert("La contraseña debe tener al menos 8 caracteres.");

        return;

    }

    if(password != confirmar){

        alert("Las contraseñas no coinciden.");

        return;

    }

    fetch(API + "password/" + id + "/",{

        method:"PUT",

        headers:{
            "Content-Type":"application/json",
            "Authorization":"Bearer " + localStorage.getItem("token")
        },

        body:JSON.stringify({
            password:password
        })

    })
    .then(async res=>{

        const data = await res.json();

        if(!res.ok){

            alert(data.error || "Ocurrió un error");

            return;

        }

        alert(data.msg);

        cerrarModalPassword();

    })
    .catch(err=>{

        console.error(err);

        alert("Error al conectar con el servidor");

    });

}

function abrirModal(modo = "nuevo") {

    const modal = document.getElementById("modal");

    modal.style.display = "flex";

    if (modo === "nuevo") {

        document.getElementById("tituloModal").innerText = "Nuevo Usuario";

        document.getElementById("user_id").value = "";

        document.getElementById("username").value = "";
        document.getElementById("email").value = "";
        document.getElementById("password").value = "";

        document.getElementById("username").disabled = false;

        document.getElementById("role").value = rolesDisponibles.find(role => role.nombre === "CAJERO")?.id || rolesDisponibles[0]?.id || "";

        document.getElementById("is_active").checked = true;

        document.getElementById("btnGuardar").innerText = "Guardar";
    }

}


cargarRoles();
cargarUsuarios();





