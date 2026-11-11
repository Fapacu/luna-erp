(() => {
    const { location } = window;
    const host = (location.hostname || "").toLowerCase();
    const configuredBase = document.querySelector('meta[name="api-base-url"]')?.content?.trim();
    const explicitBase = window.ERP_API_BASE_URL || configuredBase || "";
    const isFile = location.protocol === "file:";
    const isLoopback = !host || host === "localhost" || host === "127.0.0.1";
    const isPrivateNetwork = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);

    let apiBase;
    if (explicitBase) {
        const normalizedBase = explicitBase.replace(/\/+$/, "");
        apiBase = /\/api$/i.test(normalizedBase) ? normalizedBase : `${normalizedBase}/api`;
    } else if (isFile) {
        apiBase = "http://127.0.0.1:8000/api";
    } else if (host.endsWith(".trycloudflare.com") || (location.protocol === "https:" && !isPrivateNetwork)) {
        // En producción, el proxy HTTPS debe publicar frontend y API bajo el mismo origen.
        apiBase = `${location.origin}/api`;
    } else if (isLoopback || isPrivateNetwork) {
        const port = location.port === "8000" ? location.port : "8000";
        apiBase = `${location.protocol}//${host || "127.0.0.1"}:${port}/api`;
    } else {
        apiBase = `${location.origin}/api`;
    }

    window.API_BASE_URL = apiBase;
    window.apiUrl = (path = "") => `${apiBase}/${String(path).replace(/^\/+/, "")}`;
    // Interpreta montos en guaraníes escritos como "150.000", "150000" o "150 000".
    // El guaraní no usa decimales, así que el punto se toma como separador de miles.
    // Devuelve un número entero o NaN si el texto no es un monto válido.
    window.parseMontoGs = (texto) => {
        const limpio = String(texto ?? "").trim().replace(/^gs\.?\s*/i, "").replace(/[\s.]/g, "");
        if (!/^\d+(,\d{1,2})?$/.test(limpio)) return NaN;
        return Math.round(Number(limpio.replace(",", ".")));
    };
    window.escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[character]);

    // Sesión expirada: si el API responde 401 a una llamada autenticada,
    // se limpia la sesión local y se vuelve al inicio de sesión.
    const originalFetch = window.fetch.bind(window);
    let redirigiendo = false;
    const loginUrl = () => {
        const enSubcarpeta = /\/(inventario|ventas|compras)\//.test(location.pathname);
        return (enSubcarpeta ? "../" : "") + "login.html";
    };
    window.fetch = async (resource, options) => {
        const response = await originalFetch(resource, options);
        try {
            const url = typeof resource === "string" ? resource
                : resource instanceof URL ? resource.href
                : resource?.url || "";
            const esApi = url.startsWith(apiBase);
            const esLogin = /\/login\/?$/.test(new URL(url, location.href).pathname);
            if (response.status === 401 && esApi && !esLogin && !redirigiendo
                    && !location.pathname.endsWith("login.html")) {
                redirigiendo = true;
                ["token", "usuario", "rol", "username"].forEach((clave) => localStorage.removeItem(clave));
                alert("Tu sesión expiró. Vuelve a iniciar sesión.");
                location.href = loginUrl();
            }
        } catch (error) {
            console.error("No se pudo verificar la respuesta del API:", error);
        }
        return response;
    };
})();
