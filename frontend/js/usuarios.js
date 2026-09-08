const API = "http://127.0.0.1:8000/api/usuarios/";
let usuarios = [];

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
                    <td>${u.username}</td>
                    <td>${u.email}</td>
                    <td>${u.rol}</td>
                    <td>${u.is_active ? "Activo" : "Inactivo"}</td>
                    <td>

                        <button onclick="editarUsuario(${u.id})">
                            Editar
                        </button>

                        <button onclick="abrirModalPassword(${u.id})">
                            🔑 Contraseña
                        </button>

                        <button onclick="eliminar(${u.id})">
                            Eliminar
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

    if(u.rol === "ADMIN"){
        document.getElementById("role").value = 1;
    }
    else if(u.rol === "CAJERO"){
        document.getElementById("role").value = 2;
    }

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

        document.getElementById("role").value = 2;

        document.getElementById("is_active").checked = true;

        document.getElementById("btnGuardar").innerText = "Guardar";
    }

}


cargarUsuarios();