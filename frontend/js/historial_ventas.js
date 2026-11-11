(() => {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "../login.html";
        return;
    }

    const rol = localStorage.getItem("rol");
    const puedeAnular = rol === "ADMIN" || rol === "GERENTE";
    const escapeHtml = window.escapeHtml;
    const formatoGs = (valor) => "Gs. " + Math.round(Number(valor) || 0).toLocaleString("es-PY");
    const metodos = { EFECTIVO: "Efectivo", TARJETA: "Tarjeta", TRANSFERENCIA: "Transferencia", LIBRETA: "Libreta" };

    const tabla = document.getElementById("tablaVentas");
    const form = document.getElementById("filtrosVentas");
    const desde = document.getElementById("filtroDesde");
    const hasta = document.getElementById("filtroHasta");
    const texto = document.getElementById("filtroTexto");
    const estado = document.getElementById("filtroEstado");

    const hoy = new Date();
    const iso = (fecha) => `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
    hasta.value = iso(hoy);
    desde.value = iso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 7));

    async function cargarVentas() {
        const params = new URLSearchParams();
        if (desde.value) params.set("desde", desde.value);
        if (hasta.value) params.set("hasta", hasta.value);
        if (texto.value.trim()) params.set("q", texto.value.trim());
        if (estado.value) params.set("estado", estado.value);

        tabla.innerHTML = '<tr><td colspan="9" class="vacio">Cargando…</td></tr>';
        try {
            const res = await fetch(window.apiUrl(`ventas/historial/?${params}`), {
                headers: { "Authorization": "Bearer " + token },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || data.detail || "No se pudo cargar el historial");
            render(data);
        } catch (error) {
            console.error(error);
            tabla.innerHTML = `<tr><td colspan="9" class="vacio">${escapeHtml(error.message === "Failed to fetch" ? "No se pudo conectar con el servidor." : error.message)}</td></tr>`;
        }
    }

    function render(ventas) {
        const completadas = ventas.filter((v) => v.estado === "COMPLETADA");
        document.getElementById("kpiCantidad").innerText = completadas.length;
        document.getElementById("kpiTotal").innerText = formatoGs(completadas.reduce((acc, v) => acc + Number(v.total || 0), 0));
        document.getElementById("kpiAnuladas").innerText = ventas.length - completadas.length;

        if (!ventas.length) {
            tabla.innerHTML = '<tr><td colspan="9" class="vacio">No hay ventas para los filtros seleccionados.</td></tr>';
            return;
        }

        tabla.innerHTML = ventas.map((v) => `
            <tr>
                <td>${escapeHtml(v.ticket || "#" + v.id)}</td>
                <td>${escapeHtml(v.fecha)}</td>
                <td>${escapeHtml(v.usuario)}</td>
                <td>${v.caja ? "#" + Number(v.caja) : "-"}</td>
                <td>${escapeHtml(metodos[v.metodo_pago] || v.metodo_pago)}</td>
                <td>${formatoGs(v.total)}</td>
                <td>${v.factura ? escapeHtml(v.factura) : "-"}</td>
                <td><span class="estado-venta estado-${escapeHtml(v.estado)}">${escapeHtml(v.estado)}</span></td>
                <td>
                    <div class="acciones-venta">
                        <button type="button" class="btn-ticket" data-accion="ticket" data-id="${Number(v.id)}"
                            title="Reimprimir ticket" aria-label="Reimprimir ticket de la venta ${Number(v.id)}">
                            <i class="bi bi-printer" aria-hidden="true"></i>
                        </button>
                        ${v.factura ? `
                        <button type="button" class="btn-factura" data-accion="factura" data-id="${Number(v.id)}"
                            title="Imprimir factura ${escapeHtml(v.factura)}" aria-label="Imprimir factura de la venta ${Number(v.id)}">
                            <i class="bi bi-file-earmark-text" aria-hidden="true"></i>
                        </button>` : v.estado === "COMPLETADA" ? `
                        <button type="button" class="btn-facturar" data-accion="facturar" data-id="${Number(v.id)}"
                            data-ticket="${escapeHtml(v.ticket || "")}" data-total="${Number(v.total)}"
                            title="Emitir factura" aria-label="Emitir factura para la venta ${Number(v.id)}">
                            <i class="bi bi-file-earmark-plus" aria-hidden="true"></i>
                        </button>` : ""}
                        ${puedeAnular && v.estado === "COMPLETADA" ? `
                        <button type="button" class="btn-anular" data-accion="anular" data-id="${Number(v.id)}"
                            data-ticket="${escapeHtml(v.ticket || "")}" data-total="${Number(v.total)}" data-metodo="${escapeHtml(v.metodo_pago)}"
                            title="Anular venta" aria-label="Anular la venta ${Number(v.id)}">
                            <i class="bi bi-x-circle" aria-hidden="true"></i>
                        </button>` : ""}
                    </div>
                </td>
            </tr>`).join("");
    }

    async function imprimirTicket(id, tipo = "ticket") {
        const ventana = window.open("", "_blank", "width=820,height=900");
        try {
            const res = await fetch(window.apiUrl(`ventas/${tipo}/${encodeURIComponent(id)}/`), {
                headers: { "Authorization": "Bearer " + token },
            });
            if (!res.ok) {
                let mensaje = "No se pudo generar el ticket";
                try { mensaje = (await res.json()).error || mensaje; } catch (e) { /* respuesta no JSON */ }
                throw new Error(mensaje);
            }
            const html = await res.text();
            if (!ventana) {
                alert("El navegador bloqueó la ventana del ticket. Permite ventanas emergentes para este sitio.");
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

    async function anularVenta(boton) {
        const id = boton.dataset.id;
        const aviso = boton.dataset.metodo === "EFECTIVO"
            ? "\nSe registrará la devolución del efectivo en la caja de la venta (o en tu caja abierta)."
            : boton.dataset.metodo === "LIBRETA"
                ? "\nSe descontará el importe de la libreta del cliente."
                : "";
        if (!confirm(`¿Anular la venta ${boton.dataset.ticket || "#" + id} por ${formatoGs(boton.dataset.total)}?\nEl stock se devolverá al inventario.${aviso}\n\nEsta acción no se puede deshacer.`)) {
            return;
        }
        boton.disabled = true;
        try {
            const cajaId = localStorage.getItem("cajaSeleccionada");
            const res = await fetch(window.apiUrl(`ventas/anular/${encodeURIComponent(id)}/`), {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: JSON.stringify(cajaId ? { caja_id: cajaId } : {}),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || data.detail || "No se pudo anular la venta");
            alert("Venta anulada correctamente");
            cargarVentas();
        } catch (error) {
            console.error(error);
            alert(error.message);
            boton.disabled = false;
        }
    }

    tabla.addEventListener("click", (evento) => {
        const boton = evento.target.closest("button[data-accion]");
        if (!boton) return;
        if (boton.dataset.accion === "ticket") imprimirTicket(boton.dataset.id);
        if (boton.dataset.accion === "anular") anularVenta(boton);
        if (boton.dataset.accion === "factura") imprimirTicket(boton.dataset.id, "factura");
        if (boton.dataset.accion === "facturar") abrirModalFactura(boton);
    });

    /* ---------- Emitir factura de una venta ya cobrada ---------- */

    const modal = document.getElementById("modalFactura");
    const formFactura = document.getElementById("formFacturaVenta");
    const hf = (id) => document.getElementById(id);
    let ventaAFacturar = null;

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

    function ajustarModal() {
        const sinNombre = hf("hfTipoDoc").value === "SIN_NOMBRE";
        hf("hfGrupoDoc").style.display = sinNombre ? "none" : "flex";
        hf("hfGrupoNombre").style.display = sinNombre ? "none" : "flex";
        const valor = hf("hfDocumento").value.replace(/[\s.]/g, "");
        let ayuda = "";
        if (hf("hfTipoDoc").value === "RUC" && valor) {
            const partes = valor.match(/^(\d{3,8})-?(\d)$/);
            ayuda = !partes ? "Formato: 1234567-8"
                : digitoVerificador(partes[1]) === Number(partes[2]) ? "RUC válido"
                : `Dígito verificador incorrecto (debería ser ${partes[1]}-${digitoVerificador(partes[1])})`;
        }
        hf("hfAyuda").textContent = ayuda;
    }

    function abrirModalFactura(boton) {
        ventaAFacturar = boton.dataset.id;
        formFactura.reset();
        hf("resumenVentaFactura").textContent = `Venta ${boton.dataset.ticket || "#" + ventaAFacturar} · ${formatoGs(boton.dataset.total)}`;
        ajustarModal();
        modal.classList.add("abierto");
        hf("hfDocumento").focus();
    }

    function cerrarModalFactura() {
        modal.classList.remove("abierto");
        ventaAFacturar = null;
    }

    hf("hfTipoDoc").addEventListener("change", ajustarModal);
    hf("hfDocumento").addEventListener("input", ajustarModal);
    hf("hfCancelar").addEventListener("click", cerrarModalFactura);
    modal.addEventListener("click", (evento) => { if (evento.target === modal) cerrarModalFactura(); });
    document.addEventListener("keydown", (evento) => { if (evento.key === "Escape" && modal.classList.contains("abierto")) cerrarModalFactura(); });

    formFactura.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        if (!ventaAFacturar) return;
        const boton = evento.submitter;
        if (boton) boton.disabled = true;
        const id = ventaAFacturar;
        try {
            const res = await fetch(window.apiUrl(`ventas/${encodeURIComponent(id)}/facturar/`), {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: JSON.stringify({
                    tipo_documento: hf("hfTipoDoc").value,
                    documento: hf("hfDocumento").value.trim(),
                    razon_social: hf("hfRazonSocial").value.trim(),
                    direccion: hf("hfDireccion").value.trim(),
                    telefono: hf("hfTelefono").value.trim(),
                    email: hf("hfEmail").value.trim(),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || data.detail || "No se pudo emitir la factura");
            cerrarModalFactura();
            if (confirm(`Factura ${data.factura} emitida. ¿Imprimirla ahora?`)) {
                imprimirTicket(id, "factura");
            }
            cargarVentas();
        } catch (error) {
            alert(error.message);
        } finally {
            if (boton) boton.disabled = false;
        }
    });

    form.addEventListener("submit", (evento) => {
        evento.preventDefault();
        cargarVentas();
    });

    cargarVentas();
})();
