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

        tabla.innerHTML = '<tr><td colspan="8" class="vacio">Cargando…</td></tr>';
        try {
            const res = await fetch(window.apiUrl(`ventas/historial/?${params}`), {
                headers: { "Authorization": "Bearer " + token },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || data.detail || "No se pudo cargar el historial");
            render(data);
        } catch (error) {
            console.error(error);
            tabla.innerHTML = `<tr><td colspan="8" class="vacio">${escapeHtml(error.message === "Failed to fetch" ? "No se pudo conectar con el servidor." : error.message)}</td></tr>`;
        }
    }

    function render(ventas) {
        const completadas = ventas.filter((v) => v.estado === "COMPLETADA");
        document.getElementById("kpiCantidad").innerText = completadas.length;
        document.getElementById("kpiTotal").innerText = formatoGs(completadas.reduce((acc, v) => acc + Number(v.total || 0), 0));
        document.getElementById("kpiAnuladas").innerText = ventas.length - completadas.length;

        if (!ventas.length) {
            tabla.innerHTML = '<tr><td colspan="8" class="vacio">No hay ventas para los filtros seleccionados.</td></tr>';
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
                <td><span class="estado-venta estado-${escapeHtml(v.estado)}">${escapeHtml(v.estado)}</span></td>
                <td>
                    <div class="acciones-venta">
                        <button type="button" class="btn-ticket" data-accion="ticket" data-id="${Number(v.id)}"
                            title="Reimprimir ticket" aria-label="Reimprimir ticket de la venta ${Number(v.id)}">
                            <i class="bi bi-printer" aria-hidden="true"></i>
                        </button>
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

    async function imprimirTicket(id) {
        const ventana = window.open("", "_blank", "width=380,height=640");
        try {
            const res = await fetch(window.apiUrl(`ventas/ticket/${encodeURIComponent(id)}/`), {
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
    });

    form.addEventListener("submit", (evento) => {
        evento.preventDefault();
        cargarVentas();
    });

    cargarVentas();
})();
