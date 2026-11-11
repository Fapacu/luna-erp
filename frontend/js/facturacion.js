(() => {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "login.html";
        return;
    }
    if (localStorage.getItem("rol") !== "ADMIN") {
        alert("Solo un administrador puede configurar la facturación.");
        window.location.href = "dashboard.html";
        return;
    }

    const campos = [
        "razon_social", "nombre_fantasia", "ruc", "actividad_economica", "direccion", "ciudad",
        "telefono", "email", "timbrado", "timbrado_inicio", "timbrado_fin", "establecimiento",
        "punto_expedicion", "numero_siguiente", "numero_final", "formato_factura",
    ];
    const el = (id) => document.getElementById(id);
    const headers = { "Content-Type": "application/json", "Authorization": "Bearer " + token };

    function digitoVerificador(numero) {
        let total = 0;
        let k = 2;
        for (const c of String(numero).split("").reverse()) {
            if (k > 11) k = 2;
            total += Number(c) * k;
            k += 1;
        }
        const resto = total % 11;
        return resto > 1 ? 11 - resto : 0;
    }

    function validarRuc() {
        const ayuda = el("rucAyuda");
        const valor = el("ruc").value.replace(/[\s.]/g, "");
        if (!valor) { ayuda.textContent = ""; return true; }
        const partes = valor.match(/^(\d{3,8})-?(\d)$/);
        if (!partes) { ayuda.textContent = "Formato: 1234567-8"; return false; }
        const ok = digitoVerificador(partes[1]) === Number(partes[2]);
        ayuda.textContent = ok ? "RUC válido" : `Dígito verificador incorrecto (debería ser ${partes[1]}-${digitoVerificador(partes[1])})`;
        return ok;
    }

    function actualizarProximo() {
        const pad = (v, n) => String(Math.max(Number(v) || 0, 0)).padStart(n, "0");
        el("proximoNumero").textContent = `Próxima factura: ${pad(el("establecimiento").value, 3)}-${pad(el("punto_expedicion").value, 3)}-${pad(el("numero_siguiente").value, 7)}`;
    }

    function mostrarEstado(config) {
        const estado = el("estadoFactura");
        estado.className = "estado-factura " + (config.habilitada ? "ok" : "pendiente");
        estado.textContent = config.habilitada
            ? `Facturación habilitada. Próxima factura: ${config.proximo_numero}.`
            : `Facturación pendiente: ${config.problema}`;
    }

    function rellenar(config) {
        campos.forEach((campo) => {
            if (el(campo)) el(campo).value = config[campo] ?? "";
        });
        validarRuc();
        actualizarProximo();
        mostrarEstado(config);
    }

    async function cargar() {
        try {
            const res = await fetch(window.apiUrl("ventas/facturacion/configuracion/"), { headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || data.detail || "No se pudo cargar la configuración");
            rellenar(data);
        } catch (error) {
            el("estadoFactura").textContent = error.message;
        }
    }

    el("ruc").addEventListener("input", validarRuc);
    ["establecimiento", "punto_expedicion", "numero_siguiente"].forEach((id) => el(id).addEventListener("input", actualizarProximo));

    el("formFacturacion").addEventListener("submit", async (evento) => {
        evento.preventDefault();
        if (!validarRuc()) {
            alert("Revisa el RUC del emisor.");
            el("ruc").focus();
            return;
        }
        const cuerpo = {};
        campos.forEach((campo) => { cuerpo[campo] = el(campo).value.trim(); });
        const boton = evento.submitter;
        if (boton) boton.disabled = true;
        try {
            const res = await fetch(window.apiUrl("ventas/facturacion/configuracion/"), {
                method: "PUT", headers, body: JSON.stringify(cuerpo),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || data.detail || "No se pudo guardar");
            rellenar(data);
            alert("Configuración guardada.");
        } catch (error) {
            alert(error.message);
        } finally {
            if (boton) boton.disabled = false;
        }
    });

    cargar();
})();
