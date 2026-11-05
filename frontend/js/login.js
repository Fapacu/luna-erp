
const form = document.getElementById("loginForm");
const spinner = document.getElementById("spinner");
const btnText = document.getElementById("btnText");
const error = document.getElementById("errorMsg");

const username = document.getElementById("username");
const password = document.getElementById("password");

// Mostrar u ocultar contraseña
document.getElementById("togglePass").addEventListener("click", () => {
    password.type = password.type === "password" ? "text" : "password";
});

// Recordar usuario
window.onload = () => {
    const saved = localStorage.getItem("rememberUser");

    if (saved) {
        username.value = saved;
        document.getElementById("remember").checked = true;
    }
};

form.addEventListener("submit", (e) => {
    e.preventDefault();

    error.style.display = "none";
    spinner.style.display = "inline-block";
    btnText.innerText = "";

    fetch(window.apiUrl("login/"), {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username: username.value,
            password: password.value
        })
    })
    .then(async (res) => {
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.detail || data.error || "Usuario o contraseña incorrectos.");
        }

        return data;
    })
    .then(data => {
        if (!data.access || !data.usuario) {
            throw new Error("La respuesta del servidor no contiene los datos esperados.");
        }

        if (document.getElementById("remember").checked) {
            localStorage.setItem("rememberUser", username.value);
        } else {
            localStorage.removeItem("rememberUser");
        }

        localStorage.setItem("token", data.access);
        localStorage.setItem("usuario", JSON.stringify(data.usuario));
        localStorage.setItem("rol", data.usuario.rol);
        localStorage.setItem("username", data.usuario.username);

        spinner.style.display = "none";
        btnText.innerText = "Ingresar";

        switch (data.usuario.rol) {
            case "ADMIN":
            case "GERENTE":
            case "CAJERO":
                window.location.href = "dashboard.html";
                break;

            default:
                localStorage.removeItem("token");
                error.innerText = "Rol no reconocido.";
                error.style.display = "block";
        }
    })
    .catch(err => {
        console.error("Error de inicio de sesión:", err);
        spinner.style.display = "none";
        btnText.innerText = "Ingresar";
        error.innerText = err.message === "Failed to fetch"
            ? "No se pudo conectar con el servidor. Verificá que Django esté activo."
            : err.message;
        error.style.display = "block";
    });
});
