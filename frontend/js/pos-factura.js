/* =====================================================
   COMPROBANTE DEL POS: TICKET O FACTURA (PARAGUAY)
   Se carga antes de caja.js y expone funciones globales
   que caja.js usa para cobrar, guardar e imprimir.
===================================================== */

(() => {
    const token = localStorage.getItem("token");
    const authHeaders = { "Authorization": "Bearer " + token };
    const escapeHtml = window.escapeHtml;
    let configuracionFactura = null;

    const el = (id) => document.getElementById(id);

    /* ---------- RUC paraguayo: dígito verificador módulo 11 ---------- */

    function digitoVerificador(numero) {
        let total = 0;
        let k = 2;
        for (const caracter of String(numero).split("").reverse()) {
            if (k > 11) k = 2;
            total += Number(caracter) * k;
            k += 1;
        }
        const resto = total % 11;
        return resto > 1 ? 11 - resto : 0;
    }

    function normalizarRuc(texto) {
        const limpio = String(texto || "").replace(/[\s.]/g, "");
        const partes = limpio.match(/^(\d{3,8})-?(\d)$/);
        if (!partes) return { ok: false, mensaje: "Formato de RUC: 1234567-8" };
        if (digitoVerificador(partes[1]) !== Number(partes[2])) {
            return { ok: false, mensaje: `Dígito verificador incorrecto (debería ser ${partes[1]}-${digitoVerificador(partes[1])})` };
        }
        return { ok: true, valor: `${partes[1]}-${partes[2]}` };
    }

    window.calcularDvRuc = digitoVerificador;

    /* ---------- Formulario ---------- */

    function actualizarVisibilidad() {
        const esFactura = el("tipoComprobante")?.value === "FACTURA";
        el("bloqueFactura").style.display = esFactura ? "block" : "none";
        const sinNombre = el("facturaTipoDoc").value === "SIN_NOMBRE";
        el("grupoDocumentoFactura").style.display = sinNombre ? "none" : "block";
        el("grupoRazonSocialFactura").style.display = sinNombre ? "none" : "block";
        el("facturaDocumento").placeholder = el("facturaTipoDoc").value === "CI" ? "Ej.: 4567890" : "Ej.: 80012345-6";
        validarDocumentoEnVivo();
    }

    function validarDocumentoEnVivo() {
        const ayuda = el("facturaDocAyuda");
        const tipo = el("facturaTipoDoc").value;
        const valor = el("facturaDocumento").value.trim();
        ayuda.className = "factura-ayuda";
        if (tipo === "SIN_NOMBRE") {
            ayuda.textContent = "Se emitirá a nombre de SIN NOMBRE (RUC 44444401-7).";
            return;
        }
        if (!valor) {
            ayuda.textContent = "";
            return;
        }
        if (tipo === "RUC") {
            const resultado = normalizarRuc(valor);
            ayuda.textContent = resultado.ok ? "RUC válido" : resultado.mensaje;
            ayuda.classList.add(resultado.ok ? "ok" : "error");
        } else {
            const ok = /^\d{3,10}$/.test(valor.replace(/[\s.]/g, ""));
            ayuda.textContent = ok ? "" : "La cédula debe contener solo números";
            if (!ok) ayuda.classList.add("error");
        }
    }

    let temporizadorBusqueda = null;

    function buscarClientePorDocumento() {
        clearTimeout(temporizadorBusqueda);
        const contenedor = el("sugerenciasFactura");
        const texto = el("facturaDocumento").value.trim().replace(/\./g, "");
        if (texto.length < 3 || el("facturaTipoDoc").value === "SIN_NOMBRE") {
            contenedor.innerHTML = "";
            return;
        }
        temporizadorBusqueda = setTimeout(async () => {
            try {
                const res = await fetch(window.apiUrl(`ventas/facturacion/clientes/?documento=${encodeURIComponent(texto)}`), { headers: authHeaders });
                const clientes = res.ok ? await res.json() : [];
                contenedor.innerHTML = clientes.map((c, i) => `
                    <button type="button" class="sugerencia-factura" data-indice="${i}">
                        <strong>${escapeHtml(c.documento)}</strong> · ${escapeHtml(c.razon_social)}
                    </button>`).join("");
                contenedor.querySelectorAll("button").forEach((boton) => {
                    boton.addEventListener("click", () => {
                        const c = clientes[Number(boton.dataset.indice)];
                        el("facturaTipoDoc").value = c.documento.includes("-") ? "RUC" : "CI";
                        el("facturaDocumento").value = c.documento;
                        el("facturaRazonSocial").value = c.razon_social;
                        el("facturaDireccion").value = c.direccion || "";
                        el("facturaTelefono").value = c.telefono || "";
                        contenedor.innerHTML = "";
                        actualizarVisibilidad();
                        persistirVentaActiva();
                    });
                });
            } catch (error) {
                console.error("No se pudieron buscar clientes:", error);
            }
        }, 250);
    }

    /* ---------- API para caja.js ---------- */

    window.leerFormularioComprobante = () => ({
        tipo: el("tipoComprobante")?.value || "TICKET",
        tipo_documento: el("facturaTipoDoc")?.value || "RUC",
        documento: el("facturaDocumento")?.value || "",
        razon_social: el("facturaRazonSocial")?.value || "",
        direccion: el("facturaDireccion")?.value || "",
        telefono: el("facturaTelefono")?.value || "",
        email: el("facturaEmail")?.value || "",
    });

    window.cargarFormularioComprobante = (datos) => {
        const d = datos || {};
        if (!el("tipoComprobante")) return;
        el("tipoComprobante").value = d.tipo === "FACTURA" ? "FACTURA" : "TICKET";
        el("facturaTipoDoc").value = ["RUC", "CI", "SIN_NOMBRE"].includes(d.tipo_documento) ? d.tipo_documento : "RUC";
        el("facturaDocumento").value = d.documento || "";
        el("facturaRazonSocial").value = d.razon_social || "";
        el("facturaDireccion").value = d.direccion || "";
        el("facturaTelefono").value = d.telefono || "";
        el("facturaEmail").value = d.email || "";
        el("sugerenciasFactura").innerHTML = "";
        actualizarVisibilidad();
    };

    /** Devuelve los campos a enviar con la venta o lanza Error con el motivo. */
    window.obtenerDatosComprobante = () => {
        const datos = window.leerFormularioComprobante();
        if (datos.tipo !== "FACTURA") return { comprobante: "TICKET" };

        if (configuracionFactura && !configuracionFactura.habilitada) {
            throw new Error("No se puede emitir factura: " + configuracionFactura.problema);
        }
        const factura = {
            tipo_documento: datos.tipo_documento,
            documento: datos.documento.trim(),
            razon_social: datos.razon_social.trim(),
            direccion: datos.direccion.trim(),
            telefono: datos.telefono.trim(),
            email: datos.email.trim(),
        };
        if (factura.tipo_documento === "RUC") {
            const resultado = normalizarRuc(factura.documento);
            if (!resultado.ok) throw new Error("RUC inválido. " + resultado.mensaje);
            factura.documento = resultado.valor;
        }
        if (factura.tipo_documento === "CI" && !/^\d{3,10}$/.test(factura.documento.replace(/[\s.]/g, ""))) {
            throw new Error("Ingresa una cédula válida (solo números).");
        }
        if (factura.tipo_documento !== "SIN_NOMBRE" && !factura.razon_social) {
            throw new Error("Ingresa el nombre o la razón social para la factura.");
        }
        return { comprobante: "FACTURA", factura };
    };

    async function abrirDocumento(ruta) {
        // La ventana se abre antes del fetch para que el navegador no la bloquee.
        const ventana = window.open("", "_blank", "width=820,height=900");
        try {
            const res = await fetch(window.apiUrl(ruta), { headers: authHeaders });
            if (!res.ok) {
                let mensaje = "No se pudo generar el comprobante";
                try { mensaje = (await res.json()).error || mensaje; } catch (e) { /* no es JSON */ }
                throw new Error(mensaje);
            }
            const html = await res.text();
            if (!ventana) {
                alert("El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.");
                return;
            }
            ventana.document.open();
            ventana.document.write(html);
            ventana.document.close();
        } catch (error) {
            console.error(error);
            if (ventana) ventana.close();
            alert(error.message);
        }
    }

    window.imprimirTicket = (ventaId) => abrirDocumento(`ventas/ticket/${encodeURIComponent(ventaId)}/`);
    window.imprimirFactura = (ventaId) => abrirDocumento(`ventas/factura/${encodeURIComponent(ventaId)}/`);

    /* ---------- Inicio ---------- */

    async function cargarConfiguracion() {
        try {
            const res = await fetch(window.apiUrl("ventas/facturacion/configuracion/"), { headers: authHeaders });
            if (!res.ok) return;
            configuracionFactura = await res.json();
            const opcion = el("tipoComprobante")?.querySelector('option[value="FACTURA"]');
            if (opcion && !configuracionFactura.habilitada) {
                opcion.textContent = "📄 Factura (no configurada)";
            }
        } catch (error) {
            console.error("No se pudo leer la configuración de facturación:", error);
        }
    }

    function iniciar() {
        if (!el("tipoComprobante")) return;
        el("tipoComprobante").addEventListener("change", () => {
            if (el("tipoComprobante").value === "FACTURA" && configuracionFactura && !configuracionFactura.habilitada) {
                alert("La facturación no está lista: " + configuracionFactura.problema);
            }
            actualizarVisibilidad();
            persistirVentaActiva();
            if (el("tipoComprobante").value === "FACTURA" && el("facturaTipoDoc").value !== "SIN_NOMBRE") {
                el("facturaDocumento").focus();
            }
        });
        el("facturaTipoDoc").addEventListener("change", () => { actualizarVisibilidad(); persistirVentaActiva(); });
        el("facturaDocumento").addEventListener("input", () => { validarDocumentoEnVivo(); buscarClientePorDocumento(); persistirVentaActiva(); });
        el("facturaDocumento").addEventListener("blur", () => {
            if (el("facturaTipoDoc").value !== "RUC") return;
            const resultado = normalizarRuc(el("facturaDocumento").value);
            if (resultado.ok) el("facturaDocumento").value = resultado.valor;
        });
        ["facturaRazonSocial", "facturaDireccion", "facturaTelefono", "facturaEmail"].forEach((id) => {
            el(id).addEventListener("input", () => persistirVentaActiva());
        });
        actualizarVisibilidad();
        cargarConfiguracion();
    }

    iniciar();
})();
