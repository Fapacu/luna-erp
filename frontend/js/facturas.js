/* =====================================================
   FACTURAS EMITIDAS: listado, visor e impresión
===================================================== */

(() => {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "../login.html";
        return;
    }
    const rol = localStorage.getItem("rol");
    if (rol !== "ADMIN" && rol !== "GERENTE") {
        LunaUI.flash("Solo administración puede consultar las facturas emitidas.", "error");
        window.location.href = "../dashboard.html";
        return;
    }

    const escapeHtml = window.escapeHtml;
    const formatoGs = (valor) => "Gs. " + Math.round(Number(valor) || 0).toLocaleString("es-PY");
    const authHeaders = { "Authorization": "Bearer " + token };
    const el = (id) => document.getElementById(id);
    const tabla = el("tablaFacturas");
    let facturas = [];

    const hoy = new Date();
    const iso = (fecha) => `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
    el("filtroDesde").value = iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    el("filtroHasta").value = iso(hoy);

    function parametros() {
        const params = new URLSearchParams();
        if (el("filtroDesde").value) params.set("desde", el("filtroDesde").value);
        if (el("filtroHasta").value) params.set("hasta", el("filtroHasta").value);
        if (el("filtroTexto").value.trim()) params.set("q", el("filtroTexto").value.trim());
        if (el("filtroEstado").value) params.set("estado", el("filtroEstado").value);
        if (el("filtroCondicion").value) params.set("condicion", el("filtroCondicion").value);
        return params;
    }

    async function cargar() {
        tabla.innerHTML = '<tr><td colspan="8" class="vacio">Cargando…</td></tr>';
        try {
            const res = await fetch(window.apiUrl(`ventas/facturas/?${parametros()}`), { headers: authHeaders });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || data.detail || "No se pudieron cargar las facturas");
            facturas = data.facturas;
            renderResumen(data.resumen);
            renderTabla();
        } catch (error) {
            const mensaje = error.message === "Failed to fetch" ? "No se pudo conectar con el servidor." : error.message;
            tabla.innerHTML = `<tr><td colspan="8" class="vacio">${escapeHtml(mensaje)}</td></tr>`;
        }
    }

    function renderResumen(r) {
        el("kpiTotal").textContent = formatoGs(r.total);
        el("kpiCantidad").textContent = `${r.cantidad} ${r.cantidad === 1 ? "factura emitida" : "facturas emitidas"}`;
        el("kpiIva10").textContent = formatoGs(r.iva_10);
        el("kpiIva5").textContent = formatoGs(r.iva_5);
        el("kpiExentas").textContent = formatoGs(r.exentas);
        el("kpiAnuladas").textContent = r.anuladas;
    }

    function renderTabla() {
        if (!facturas.length) {
            tabla.innerHTML = '<tr><td colspan="8" class="vacio">No hay facturas para los filtros seleccionados.</td></tr>';
            return;
        }
        tabla.innerHTML = facturas.map((f, i) => `
            <tr class="${f.estado === "ANULADA" ? "anulada" : ""}">
                <td><span class="numero-factura">${escapeHtml(f.numero)}</span></td>
                <td>${escapeHtml(f.fecha)}</td>
                <td class="cliente">
                    <strong>${escapeHtml(f.cliente_razon_social)}</strong>
                    <small>${f.cliente_tipo_documento === "CI" ? "C.I." : "RUC"} ${escapeHtml(f.cliente_documento)}</small>
                </td>
                <td>${f.condicion === "CREDITO" ? "Crédito" : "Contado"}</td>
                <td class="r">${formatoGs(f.iva_5 + f.iva_10)}</td>
                <td class="r"><strong>${formatoGs(f.total)}</strong></td>
                <td><span class="luna-etiqueta ${f.estado === "ANULADA" ? "anulada" : "pagada"}">${f.estado === "ANULADA" ? "ANULADA" : "EMITIDA"}</span></td>
                <td>
                    <div class="acciones-factura">
                        <button type="button" data-accion="ver" data-indice="${i}" title="Ver factura" aria-label="Ver factura ${escapeHtml(f.numero)}">
                            <i class="bi bi-eye-fill" aria-hidden="true"></i>
                        </button>
                        <button type="button" class="secundario" data-accion="imprimir" data-indice="${i}" title="Imprimir" aria-label="Imprimir factura ${escapeHtml(f.numero)}">
                            <i class="bi bi-printer" aria-hidden="true"></i>
                        </button>
                    </div>
                </td>
            </tr>`).join("");
    }

    async function obtenerHtml(factura, formato, imprimir) {
        const url = window.apiUrl(`ventas/factura/${encodeURIComponent(factura.venta_id)}/?formato=${formato}&imprimir=${imprimir ? 1 : 0}`);
        const res = await fetch(url, { headers: authHeaders });
        if (!res.ok) {
            let mensaje = "No se pudo generar la factura";
            try { mensaje = (await res.json()).error || mensaje; } catch (e) { /* no es JSON */ }
            throw new Error(mensaje);
        }
        return res.text();
    }

    async function imprimir(factura, formato = "DIGITAL") {
        const ventana = window.open("", "_blank", "width=900,height=1000");
        try {
            const html = await obtenerHtml(factura, formato, true);
            if (!ventana) {
                LunaUI.toast("El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.", "error");
                return;
            }
            ventana.document.open();
            ventana.document.write(html);
            ventana.document.close();
        } catch (error) {
            if (ventana) ventana.close();
            LunaUI.toast(error.message, "error");
        }
    }

    async function ver(factura) {
        const contenedor = document.createElement("div");
        contenedor.className = "visor-factura";
        const iframe = document.createElement("iframe");
        iframe.title = `Factura ${factura.numero}`;
        contenedor.append(iframe);

        const ventana = LunaUI.modal({
            titulo: `Factura N.º ${factura.numero}`,
            subtitulo: `${factura.cliente_razon_social} · ${factura.fecha} · ${formatoGs(factura.total)}`,
            icono: "bi-file-earmark-text",
            ancho: true,
            contenido: contenedor,
            acciones: [
                { texto: "Cerrar", alPulsar: (v) => v.cerrar() },
                { texto: "Formato ticket", icono: "bi-receipt", alPulsar: () => imprimir(factura, "TICKET") },
                { texto: "Imprimir", tipo: "primario", icono: "bi-printer", alPulsar: () => iframe.contentWindow?.print() },
            ],
        });
        ventana.elemento.style.maxWidth = "980px";

        try {
            const html = await obtenerHtml(factura, "DIGITAL", false);
            iframe.addEventListener("load", () => {
                // Ajusta la hoja A4 al ancho disponible del visor.
                const doc = iframe.contentDocument;
                const hoja = doc?.querySelector(".hoja");
                if (!hoja) return;
                const escala = Math.min(1, (iframe.clientWidth - 24) / hoja.scrollWidth);
                doc.body.style.zoom = String(escala);
            }, { once: true });
            iframe.srcdoc = html;
        } catch (error) {
            ventana.setContenido(`<p>${escapeHtml(error.message)}</p>`);
        }
    }

    async function exportarLibro() {
        const boton = el("btnExportar");
        boton.disabled = true;
        try {
            const params = parametros();
            params.set("formato", "csv");
            const res = await fetch(window.apiUrl(`ventas/facturas/?${params}`), { headers: authHeaders });
            if (!res.ok) throw new Error("No se pudo exportar el libro de ventas");
            const blob = await res.blob();
            const enlace = document.createElement("a");
            enlace.href = URL.createObjectURL(blob);
            enlace.download = `libro_ventas_${el("filtroDesde").value || "inicio"}_${el("filtroHasta").value || "hoy"}.csv`;
            document.body.append(enlace);
            enlace.click();
            enlace.remove();
            setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
            LunaUI.toast("Libro de ventas descargado", "exito");
        } catch (error) {
            LunaUI.toast(error.message, "error");
        } finally {
            boton.disabled = false;
        }
    }

    tabla.addEventListener("click", (evento) => {
        const boton = evento.target.closest("button[data-accion]");
        if (!boton) return;
        const factura = facturas[Number(boton.dataset.indice)];
        if (!factura) return;
        if (boton.dataset.accion === "ver") ver(factura);
        if (boton.dataset.accion === "imprimir") imprimir(factura);
    });

    el("filtrosFacturas").addEventListener("submit", (evento) => {
        evento.preventDefault();
        cargar();
    });
    el("btnExportar").addEventListener("click", exportarLibro);

    cargar();
})();
