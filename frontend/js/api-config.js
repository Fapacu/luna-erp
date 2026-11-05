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
    window.escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[character]);

    // Compatibilidad temporal para pantallas que todavía conservan el host anterior.
    const originalFetch = window.fetch.bind(window);
    const oldHosts = new Set([
        "berry-previews-compensation-big.trycloudflare.com",
        "192.168.100.30",
    ]);
    window.fetch = (resource, options) => {
        if (typeof resource === "string" || resource instanceof URL) {
            try {
                const requested = new URL(resource, location.href);
                if (oldHosts.has(requested.hostname)) {
                    resource = `${apiBase}${requested.pathname.replace(/^\/api/, "")}${requested.search}${requested.hash}`;
                }
            } catch (error) {
                console.error("URL de API inválida:", error);
            }
        }
        return originalFetch(resource, options);
    };
})();
