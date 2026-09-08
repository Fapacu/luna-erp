const token = localStorage.getItem("token")

if (window.location.pathname.includes("login.html")) {
    if (token) {
        window.location.href = "dashboard.html";
    }
} else {
    if (!token) {
        if (window.location.pathname.includes("/inventario/") ||
            window.location.pathname.includes("/ventas/") ||
            window.location.pathname.includes("/compras/")) {
            window.location.href = "../login.html";
        } else {
            window.location.href = "login.html";
        }
    }
}