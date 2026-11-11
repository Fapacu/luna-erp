/* =====================================================
   LUNA UI: ventanas modales, confirmaciones y avisos
   con la identidad de Luna Minimarket.
   Uso:
     LunaUI.toast("Pago registrado", "exito")
     const ok = await LunaUI.confirmar({ titulo, mensaje })
     const ventana = LunaUI.modal({ titulo, contenido, acciones })
===================================================== */

(() => {
    const ICONO_TIENDA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8 6 4h12l2 4Z"/><path d="M4 8a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0"/><path d="M5 10v9h14v-9M3 19h18"/><path d="M8 13h4v3H8zM15 13h2v6h-2z"/></svg>';

    let contenedorToasts = null;

    function toast(mensaje, tipo = "info", duracion = 4500) {
        if (!contenedorToasts) {
            contenedorToasts = document.createElement("div");
            contenedorToasts.className = "luna-toasts";
            contenedorToasts.setAttribute("aria-live", "polite");
            document.body.append(contenedorToasts);
        }
        const iconos = { exito: "bi-check-circle-fill", error: "bi-exclamation-octagon-fill", info: "bi-info-circle-fill" };
        const elemento = document.createElement("div");
        elemento.className = `luna-toast ${tipo}`;
        elemento.setAttribute("role", tipo === "error" ? "alert" : "status");
        const icono = document.createElement("i");
        icono.className = `bi ${iconos[tipo] || iconos.info}`;
        icono.setAttribute("aria-hidden", "true");
        const texto = document.createElement("div");
        texto.textContent = mensaje;
        elemento.append(icono, texto);
        contenedorToasts.append(elemento);
        setTimeout(() => {
            elemento.classList.add("saliendo");
            setTimeout(() => elemento.remove(), 250);
        }, duracion);
    }

    /**
     * Abre una ventana modal.
     * @param {object} opciones
     *   titulo, subtitulo, icono (clase bootstrap-icons), tipoIcono ("exito"|"peligro"),
     *   contenido (string HTML de confianza o Node), ancho (bool),
     *   acciones: [{ texto, tipo: "primario"|"peligro"|"exito", icono, id, alPulsar(ventana) }]
     *   alCerrar()
     */
    function modal(opciones) {
        const anterior = document.activeElement;
        const overlay = document.createElement("div");
        overlay.className = "luna-overlay";
        overlay.innerHTML = `
            <div class="luna-modal${opciones.ancho ? " ancho" : ""}" role="dialog" aria-modal="true" aria-labelledby="lunaModalTitulo">
                <header class="luna-modal-header">
                    <div class="luna-modal-icono ${opciones.tipoIcono || ""}"><i class="bi ${opciones.icono || "bi-shop"}" aria-hidden="true"></i></div>
                    <div class="luna-modal-titulos">
                        <h2 id="lunaModalTitulo"></h2>
                        <p class="luna-modal-subtitulo"></p>
                    </div>
                    <button type="button" class="luna-modal-cerrar" aria-label="Cerrar">&times;</button>
                </header>
                <div class="luna-modal-cuerpo"></div>
                <footer class="luna-modal-pie">
                    <span class="luna-marca">${ICONO_TIENDA} Luna Minimarket</span>
                </footer>
            </div>`;
        const caja = overlay.querySelector(".luna-modal");
        overlay.querySelector("#lunaModalTitulo").textContent = opciones.titulo || "";
        const subtitulo = overlay.querySelector(".luna-modal-subtitulo");
        subtitulo.textContent = opciones.subtitulo || "";
        if (!opciones.subtitulo) subtitulo.remove();

        const cuerpo = overlay.querySelector(".luna-modal-cuerpo");
        const pie = overlay.querySelector(".luna-modal-pie");

        const ventana = {
            elemento: caja,
            cuerpo,
            cerrado: false,
            cerrar() {
                if (ventana.cerrado) return;
                ventana.cerrado = true;
                document.removeEventListener("keydown", alTeclear);
                overlay.remove();
                if (anterior && typeof anterior.focus === "function") anterior.focus();
                opciones.alCerrar?.();
            },
            setContenido(contenido) {
                cuerpo.replaceChildren();
                if (contenido instanceof Node) cuerpo.append(contenido);
                else cuerpo.innerHTML = contenido || "";
            },
            setAcciones(acciones) {
                pie.querySelectorAll(".luna-btn").forEach((b) => b.remove());
                (acciones || []).forEach((accion) => {
                    const boton = document.createElement("button");
                    boton.type = accion.submit ? "submit" : "button";
                    boton.className = `luna-btn ${accion.tipo || ""}`.trim();
                    if (accion.id) boton.id = accion.id;
                    if (accion.form) boton.setAttribute("form", accion.form);
                    boton.innerHTML = accion.icono ? `<i class="bi ${accion.icono}" aria-hidden="true"></i>` : "";
                    boton.append(document.createTextNode(accion.texto));
                    if (accion.alPulsar) boton.addEventListener("click", () => accion.alPulsar(ventana, boton));
                    pie.append(boton);
                });
            },
            setCargando(boton, cargando, textoCargando = "Procesando…") {
                if (!boton) return;
                if (cargando) {
                    boton.dataset.html = boton.innerHTML;
                    boton.disabled = true;
                    boton.innerHTML = `<span class="luna-spinner" aria-hidden="true"></span>`;
                    boton.append(document.createTextNode(textoCargando));
                } else {
                    boton.disabled = false;
                    if (boton.dataset.html) boton.innerHTML = boton.dataset.html;
                }
            },
            setEncabezado({ titulo, subtitulo: sub, icono, tipoIcono }) {
                if (titulo !== undefined) overlay.querySelector("#lunaModalTitulo").textContent = titulo;
                const caja = overlay.querySelector(".luna-modal-icono");
                if (icono) caja.querySelector("i").className = `bi ${icono}`;
                if (tipoIcono !== undefined) caja.className = `luna-modal-icono ${tipoIcono}`;
                const p = overlay.querySelector(".luna-modal-titulos p") || document.createElement("p");
                if (sub) {
                    p.className = "luna-modal-subtitulo";
                    p.textContent = sub;
                    overlay.querySelector(".luna-modal-titulos").append(p);
                }
            },
        };

        ventana.setContenido(opciones.contenido);
        ventana.setAcciones(opciones.acciones);

        function alTeclear(evento) {
            if (evento.key === "Escape") ventana.cerrar();
            if (evento.key === "Tab") {
                const foco = [...caja.querySelectorAll("button, input, select, textarea, a[href]")].filter((e) => !e.disabled && e.offsetParent !== null);
                if (!foco.length) return;
                const primero = foco[0];
                const ultimo = foco[foco.length - 1];
                if (evento.shiftKey && document.activeElement === primero) { evento.preventDefault(); ultimo.focus(); }
                else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primero.focus(); }
            }
        }

        overlay.querySelector(".luna-modal-cerrar").addEventListener("click", () => ventana.cerrar());
        overlay.addEventListener("mousedown", (evento) => { if (evento.target === overlay) ventana.cerrar(); });
        document.addEventListener("keydown", alTeclear);
        document.body.append(overlay);

        const enfocar = caja.querySelector("[autofocus], .luna-modal-cuerpo input, .luna-modal-cuerpo select, .luna-btn.primario");
        (enfocar || caja.querySelector(".luna-modal-cerrar")).focus();
        return ventana;
    }

    function confirmar({ titulo = "¿Confirmar?", mensaje = "", textoConfirmar = "Confirmar", peligro = false, icono } = {}) {
        return new Promise((resolver) => {
            let respuesta = false;
            const parrafo = document.createElement("p");
            parrafo.style.margin = "0";
            parrafo.style.whiteSpace = "pre-line";
            parrafo.textContent = mensaje;
            modal({
                titulo,
                icono: icono || (peligro ? "bi-exclamation-triangle-fill" : "bi-question-circle-fill"),
                tipoIcono: peligro ? "peligro" : "",
                contenido: parrafo,
                acciones: [
                    { texto: "Cancelar", alPulsar: (v) => v.cerrar() },
                    { texto: textoConfirmar, tipo: peligro ? "peligro" : "primario", alPulsar: (v) => { respuesta = true; v.cerrar(); } },
                ],
                alCerrar: () => resolver(respuesta),
            });
        });
    }

    const formatoGs = (valor) => "Gs. " + Math.round(Number(valor) || 0).toLocaleString("es-PY");

    /** Convierte un input de texto en campo de guaraníes con separador de miles. */
    function campoGuaranies(input, alCambiar) {
        const formatear = () => {
            const monto = window.parseMontoGs(input.value);
            if (Number.isFinite(monto)) input.value = monto.toLocaleString("es-PY");
        };
        input.addEventListener("input", () => {
            const digitos = input.value.replace(/\D/g, "");
            input.value = digitos ? Number(digitos).toLocaleString("es-PY") : "";
            alCambiar?.(window.parseMontoGs(input.value));
        });
        input.addEventListener("blur", formatear);
        return {
            valor: () => window.parseMontoGs(input.value),
            fijar: (monto) => { input.value = Math.round(monto).toLocaleString("es-PY"); alCambiar?.(Math.round(monto)); },
        };
    }

    /** Aviso que se muestra en la próxima página (por ejemplo, tras redirigir). */
    function flash(mensaje, tipo = "info") {
        try { sessionStorage.setItem("lunaFlash", JSON.stringify({ mensaje, tipo })); } catch (e) { toast(mensaje, tipo); }
    }

    try {
        const pendiente = JSON.parse(sessionStorage.getItem("lunaFlash") || "null");
        if (pendiente) {
            sessionStorage.removeItem("lunaFlash");
            const mostrar = () => toast(pendiente.mensaje, pendiente.tipo);
            if (document.body) mostrar(); else document.addEventListener("DOMContentLoaded", mostrar);
        }
    } catch (e) { /* almacenamiento no disponible */ }

    window.LunaUI = { toast, modal, confirmar, formatoGs, campoGuaranies, flash, ICONO_TIENDA };
})();
