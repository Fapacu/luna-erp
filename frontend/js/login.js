const form = document.getElementById("loginForm")
const spinner = document.getElementById("spinner")
const btnText = document.getElementById("btnText")
const error = document.getElementById("errorMsg")

/* mostrar contraseña */

document.getElementById("togglePass")
    .addEventListener("click", () => {

        const pass = document.getElementById("password")

        if (pass.type === "password") {
            pass.type = "text"
        } else {
            pass.type = "password"
        }

    })

/* recordar usuario */

window.onload = () => {

    const saved = localStorage.getItem("rememberUser")

    if (saved) {

        document.getElementById("username").value = saved
        document.getElementById("remember").checked = true

    }

}

form.addEventListener("submit", (e) => {

    e.preventDefault()

    error.style.display = "none"

    spinner.style.display = "inline-block"
    btnText.innerText = ""

    fetch("http://127.0.0.1:8000/api/login/", {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({

            username: username.value,
            password: password.value

        })

    })

        .then(res => res.json())
        .then(data => {

            if (!data.access) {

                spinner.style.display = "none"
                btnText.innerText = "Ingresar"

                error.innerText = "Usuario o contraseña incorrectos"
                error.style.display = "block"

                return

            }

            /* recordar usuario */

            if (document.getElementById("remember").checked) {

                localStorage.setItem("rememberUser", username.value)

            } else {

                localStorage.removeItem("rememberUser")

            }

            localStorage.setItem("token", data.access);
            localStorage.setItem("usuario", JSON.stringify(data.usuario));

            localStorage.setItem("rol", data.usuario.rol);

            localStorage.setItem("token", data.access);

            localStorage.setItem("usuario", JSON.stringify(data.usuario));

            localStorage.setItem("rol", data.usuario.rol);

            localStorage.setItem("username", data.usuario.username);

            switch (data.usuario.rol) {

                case "ADMIN":
                    window.location.href = "dashboard.html";
                    break;

                case "CAJERO":
                    window.location.href = "dashboard.html";
                    break;

                default:
                    error.innerText = "Rol no reconocido.";
                    error.style.display = "block";
            }

        })

})