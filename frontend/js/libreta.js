const token =
localStorage.getItem("token")

const API = window.API_BASE_URL;

let cuentas = []

function cargarCuentas(){

    return fetch(
        `${API}/ventas/libreta/`,
        {
            headers: {
                "Authorization":
                    "Bearer " + token
            }
        }
    )

    .then(async res => {
        const data = await res.json()
        if(!res.ok) throw new Error(data.error || data.detail || "No se pudieron cargar las cuentas")
        return data
    })

    .then(data => {

        cuentas = data;

        actualizarKPIs(cuentas);

        const texto = document.getElementById("buscarCliente")?.value.toLowerCase() || ""

        renderTabla(texto ? cuentas.filter(c => c.cliente_nombre.toLowerCase().includes(texto)) : cuentas);

    })

    .catch(error => {

        console.error(error)

        LunaUI.toast(error.message === "Failed to fetch" ? "No se pudo conectar con el servidor." : error.message, "error")

    })

}

cargarCuentas()


function actualizarKPIs(lista){

    const totalLibretas = lista.length;

    const totalAdeudado = lista.reduce(

        (acc,item)=>acc + Number(item.saldo),

        0

    );

    const pendientes = lista.filter(

        item => !item.cancelada

    ).length;

    const canceladas = lista.filter(

        item => item.cancelada

    ).length;

    document.getElementById("kpiLibretas").textContent =
    totalLibretas;

    document.getElementById("kpiTotalAdeudado").textContent =
    "Gs. " + totalAdeudado.toLocaleString();

    document.getElementById("kpiPendientes").textContent =
    pendientes;

    document.getElementById("kpiCanceladas").textContent =
    canceladas;

}


function renderTabla(lista){

    const tabla =
    document.getElementById("tablaLibreta");

    tabla.innerHTML = "";

    lista.forEach(item => {

        tabla.innerHTML += `

        <tr>

            <td>

                <div class="cliente-info">

                    <div class="avatar-cliente">

                            ${window.escapeHtml(item.cliente_nombre.charAt(0).toUpperCase())}

                    </div>

                    <div>

                        <strong>

                            ${window.escapeHtml(item.cliente_nombre)}

                        </strong>

                        <small>

                            Cuenta corriente

                        </small>

                    </div>

                </div>

            </td>

            <td>

                Gs. ${Number(item.total).toLocaleString()}

            </td>

            <td>

                Gs. ${Number(item.pagado).toLocaleString()}

            </td>

            <td>

                <strong>

                    Gs. ${Number(item.saldo).toLocaleString()}

                </strong>

            </td>

            <td>

                ${
                    item.cancelada

                    ?

                    `<span class="badge badge-danger">

                        CANCELADA

                    </span>`

                    :

                    `<span class="badge badge-success">

                        ACTIVA

                    </span>`
                }

            </td>

            <td>

                <div class="acciones">

                    <button

                        class="btn-icon btn-detalle"

                        onclick="verDetalle(${item.id})"

                        title="Ver detalle">

                        <i class="bi bi-eye-fill"></i>

                    </button>

                    ${!item.cancelada && Number(item.saldo) > 0 ? `<button

                        type="button"

                        class="btn-icon btn-cobrar"

                        onclick="cobrar(${Number(item.id)})"

                        title="Registrar cobro"

                        aria-label="Registrar cobro de ${window.escapeHtml(item.cliente_nombre)}">

                        <i class="bi bi-cash-coin" aria-hidden="true"></i>

                    </button>` : ""}

                </div>

            </td>

        </tr>

        `;

    });

}

document
.getElementById("buscarCliente")
.addEventListener(
    "input",
    function () {

        const texto =
        this.value.toLowerCase()

        const filtrados =
        cuentas.filter(c =>

            c.cliente_nombre
            .toLowerCase()
            .includes(texto)

        )

        renderTabla(filtrados)

    }
)

async function verDetalle(id){

    try{

        const res = await fetch(

            `${API}/ventas/libreta/${encodeURIComponent(id)}/`,

            {

                headers:{

                    "Authorization":"Bearer " + token

                }

            }

        );

        const data = await res.json();

        let html = `

            <div class="estado-cuenta">

                <h2>${window.escapeHtml(data.cliente)}</h2>

                <hr>

                <p><strong>Total:</strong> Gs. ${Number(data.total).toLocaleString()}</p>

                <p><strong>Pagado:</strong> Gs. ${Number(data.pagado).toLocaleString()}</p>

                <p><strong>Saldo:</strong> Gs. ${Number(data.saldo).toLocaleString()}</p>

                <hr>

        `;

        data.movimientos.forEach(m=>{

            html += `

                <div class="movimiento">

                    <div class="movimiento-header">

                        <strong>

                            ${m.tipo === "COMPRA"

                                ? "Compra"

                                : m.tipo === "SALDO_INICIAL"

                                ? "Saldo anterior (cargado del libro)"

                                : m.tipo === "ANULACION"

                                ? "Anulación de venta"

                                : "Pago"}

                        </strong>

                        <span>

                            ${m.fecha}

                        </span>

                    </div>

                    <div>

                        Monto:

                        <strong>

                            Gs. ${Number(m.monto).toLocaleString()}

                        </strong>

                    </div>

            `;

            if(m.productos.length){

                html += `

                    <table class="tabla-detalle">

                        <thead>

                            <tr>

                                <th>Producto</th>

                                <th>Cant.</th>

                                <th>Precio</th>

                                <th>Subtotal</th>

                            </tr>

                        </thead>

                        <tbody>

                `;

                m.productos.forEach(p=>{

                    html += `

                        <tr>

                            <td>${window.escapeHtml(p.producto)}</td>

                            <td>${p.cantidad}</td>

                            <td>Gs. ${Number(p.precio).toLocaleString()}</td>

                            <td>Gs. ${Number(p.subtotal).toLocaleString()}</td>

                        </tr>

                    `;

                });

                html += `

                        </tbody>

                    </table>

                `;

            }

            html += `

                <hr>

            `;

        });

        html += `

            </div>

        `;

        document.getElementById("detalleProductos").innerHTML = html;

        document.getElementById("modalDetalle").style.display = "flex";

    }

    

    catch(error){

        console.error(error);

        LunaUI.toast("No se pudo cargar el detalle.", "error");

    }

}

function cerrarModal(){

    document.getElementById(
        "modalDetalle"
    ).style.display =
    "none"

}

const formatoGs = (valor) => "Gs. " + Math.round(Number(valor) || 0).toLocaleString("es-PY")

// Carga de clientes que ya tenían cuenta en el libro (solo ADMIN/GERENTE; el API lo impone).
const btnNuevaCuenta = document.getElementById("btnNuevaCuenta")
if(["ADMIN", "GERENTE"].includes(localStorage.getItem("rol"))){
    btnNuevaCuenta.hidden = false
    btnNuevaCuenta.addEventListener("click", nuevaCuenta)
}

function nuevaCuenta(){

    const formulario = document.createElement("form")
    formulario.id = "formNuevaCuenta"
    formulario.noValidate = true
    formulario.innerHTML = `
        <div class="luna-campo">
            <label for="nombreNuevaCuenta">Nombre del cliente</label>
            <input id="nombreNuevaCuenta" maxlength="200" autocomplete="off" required placeholder="Como figura en el libro">
        </div>

        <div class="luna-campo">
            <label for="saldoNuevaCuenta">Saldo que debe hoy</label>
            <div class="luna-monto"><span>Gs.</span><input id="saldoNuevaCuenta" inputmode="numeric" autocomplete="off" required></div>
            <small>Lo que el cliente adeuda según el libro. No se registra como ingreso de caja.</small>
            <small id="errorNuevaCuenta" class="error" aria-live="polite"></small>
        </div>`

    const ventana = LunaUI.modal({
        titulo: "Cargar cliente del libro",
        subtitulo: "Cuenta que ya existía, con su saldo pendiente",
        icono: "bi-person-plus-fill",
        contenido: formulario,
        acciones: [
            { texto: "Cancelar", alPulsar: (v) => v.cerrar() },
            { texto: "Guardar", tipo: "primario", icono: "bi-check2-circle", submit: true, form: "formNuevaCuenta", id: "btnGuardarCuenta" },
        ],
    })

    const boton = document.getElementById("btnGuardarCuenta")
    const inputNombre = formulario.querySelector("#nombreNuevaCuenta")
    const inputSaldo = formulario.querySelector("#saldoNuevaCuenta")
    const error = formulario.querySelector("#errorNuevaCuenta")
    const campo = LunaUI.campoGuaranies(inputSaldo, () => { error.textContent = "" })
    inputNombre.focus()

    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault()
        const nombre = inputNombre.value.trim()
        const saldo = campo.valor()
        if(!nombre){
            error.textContent = "Ingresa el nombre del cliente."
            inputNombre.focus()
            return
        }
        if(!Number.isFinite(saldo) || saldo <= 0){
            error.textContent = "Ingresa el saldo adeudado. Ejemplo: 150.000"
            inputSaldo.focus()
            return
        }
        ventana.setCargando(boton, true, "Guardando…")
        try{
            const res = await fetch(`${API}/ventas/libreta/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + token
                },
                body: JSON.stringify({ cliente_nombre: nombre, saldo })
            })
            const data = await res.json()
            if(!res.ok) throw new Error(data.error || data.detail || "No se pudo cargar el cliente")
            ventana.cerrar()
            LunaUI.toast(`${nombre} cargado con saldo ${formatoGs(saldo)}`, "exito")
            cargarCuentas()
        }catch(err){
            console.error(err)
            ventana.setCargando(boton, false)
            error.textContent = err.message === "Failed to fetch" ? "No se pudo conectar con el servidor." : err.message
        }
    })
}

async function obtenerCajasAbiertas(){
    const res = await fetch(window.apiUrl("ventas/caja/estado/"), {
        headers: { "Authorization": "Bearer " + token }
    })
    if(!res.ok) return []
    const data = await res.json()
    return Array.isArray(data.cajas) ? data.cajas : []
}

async function cobrar(id){

    const cuenta = cuentas.find(c => Number(c.id) === Number(id))
    if(!cuenta) return

    const cajas = await obtenerCajasAbiertas().catch(() => [])
    const usuario = localStorage.getItem("username")
    const preferida = localStorage.getItem("cajaSeleccionada")
    const cajaPorDefecto =
        cajas.find(c => String(c.id) === preferida) ||
        cajas.find(c => c.usuario === usuario) ||
        cajas[0]

    const formulario = document.createElement("form")
    formulario.id = "formCobroLibreta"
    formulario.noValidate = true
    formulario.innerHTML = `
        <div class="luna-resumen">
            <div class="luna-dato"><span>Total comprado</span><strong>${formatoGs(cuenta.total)}</strong></div>
            <div class="luna-dato"><span>Ya pagado</span><strong>${formatoGs(cuenta.pagado)}</strong></div>
            <div class="luna-dato destacado"><span>Saldo pendiente</span><strong>${formatoGs(cuenta.saldo)}</strong></div>
        </div>

        <div class="luna-campo">
            <label for="montoCobroLibreta">Monto recibido</label>
            <div class="luna-monto"><span>Gs.</span><input id="montoCobroLibreta" inputmode="numeric" autocomplete="off" required></div>
            <div class="luna-rapidos">
                <button type="button" class="luna-chip" data-porcentaje="100">Saldo total</button>
                <button type="button" class="luna-chip" data-porcentaje="50">50 %</button>
                <button type="button" class="luna-chip" data-monto="50000">Gs. 50.000</button>
                <button type="button" class="luna-chip" data-monto="100000">Gs. 100.000</button>
            </div>
            <small id="errorCobroLibreta" class="error" aria-live="polite"></small>
        </div>

        <div class="luna-campo">
            <label for="cajaCobroLibreta">Caja donde ingresa el efectivo</label>
            ${cajas.length ? `<select id="cajaCobroLibreta">
                ${cajas.map(c => `<option value="${Number(c.id)}" ${cajaPorDefecto && c.id === cajaPorDefecto.id ? "selected" : ""}>Caja #${Number(c.id)} · ${window.escapeHtml(c.usuario)}</option>`).join("")}
            </select>` : `<small class="error">No hay cajas abiertas. Abre una caja en el POS para registrar cobros en efectivo.</small>`}
        </div>

        <div class="luna-campo">
            <label for="observacionCobroLibreta">Observación <small>(opcional)</small></label>
            <input id="observacionCobroLibreta" maxlength="200" placeholder="Ej.: pago de la quincena">
        </div>

        <div class="luna-proyeccion" id="proyeccionCobroLibreta">
            <span>Saldo después del cobro</span><strong>${formatoGs(cuenta.saldo)}</strong>
        </div>`

    const ventana = LunaUI.modal({
        titulo: "Registrar cobro",
        subtitulo: `Libreta de ${cuenta.cliente_nombre}`,
        icono: "bi-wallet2",
        contenido: formulario,
        acciones: [
            { texto: "Cancelar", alPulsar: (v) => v.cerrar() },
            { texto: "Registrar cobro", tipo: "primario", icono: "bi-check2-circle", submit: true, form: "formCobroLibreta", id: "btnConfirmarCobro" },
        ],
    })

    const boton = document.getElementById("btnConfirmarCobro")
    if(!cajas.length) boton.disabled = true

    const input = formulario.querySelector("#montoCobroLibreta")
    const error = formulario.querySelector("#errorCobroLibreta")
    const proyeccion = formulario.querySelector("#proyeccionCobroLibreta")

    const actualizar = (monto) => {
        error.textContent = ""
        const restante = Number(cuenta.saldo) - (Number.isFinite(monto) ? monto : 0)
        proyeccion.classList.toggle("saldado", restante === 0)
        proyeccion.innerHTML = restante === 0
            ? `<span><i class="bi bi-check-circle-fill"></i> La libreta quedará saldada</span><strong>Gs. 0</strong>`
            : `<span>Saldo después del cobro</span><strong>${formatoGs(Math.max(restante, 0))}</strong>`
        if(Number.isFinite(monto) && monto > Number(cuenta.saldo)) error.textContent = "El monto supera el saldo pendiente."
    }
    const campo = LunaUI.campoGuaranies(input, actualizar)
    input.focus()

    formulario.querySelectorAll(".luna-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            const monto = chip.dataset.porcentaje
                ? Math.round(Number(cuenta.saldo) * Number(chip.dataset.porcentaje) / 100)
                : Math.min(Number(chip.dataset.monto), Number(cuenta.saldo))
            campo.fijar(monto)
            input.focus()
        })
    })

    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault()
        if(!cajas.length) return
        const monto = campo.valor()
        if(!Number.isFinite(monto) || monto <= 0){
            error.textContent = "Ingresa un monto válido. Ejemplo: 50.000"
            input.focus()
            return
        }
        if(monto > Number(cuenta.saldo)){
            error.textContent = "El monto supera el saldo pendiente."
            input.focus()
            return
        }
        const cajaId = formulario.querySelector("#cajaCobroLibreta").value
        ventana.setCargando(boton, true, "Registrando…")
        try{
            const res = await fetch(`${API}/ventas/libreta/${encodeURIComponent(id)}/cobrar/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + token
                },
                body: JSON.stringify({
                    monto,
                    caja_id: cajaId,
                    observacion: formulario.querySelector("#observacionCobroLibreta").value.trim()
                })
            })
            const data = await res.json()
            if(!res.ok) throw new Error(data.error || data.detail || "No se pudo registrar el cobro")

            ventana.setEncabezado({ titulo: "Cobro registrado", icono: "bi-check-lg", tipoIcono: "exito" })
            ventana.setContenido(`
                <div class="luna-exito-box">
                    <div class="icono"><i class="bi bi-check-lg" aria-hidden="true"></i></div>
                    <h3>${formatoGs(monto)} cobrados a ${window.escapeHtml(cuenta.cliente_nombre)}</h3>
                    <p>${data.cuenta.cancelada ? "La libreta quedó saldada." : "Saldo pendiente: " + formatoGs(data.cuenta.saldo)}</p>
                </div>`)
            ventana.setAcciones([
                { texto: "Cerrar", alPulsar: (v) => v.cerrar() },
                { texto: "Imprimir comprobante", tipo: "primario", icono: "bi-printer", alPulsar: () => imprimirComprobanteCobro(data) },
            ])
            LunaUI.toast(`Cobro registrado: ${formatoGs(monto)}`, "exito")
            cargarCuentas()
        }catch(err){
            console.error(err)
            ventana.setCargando(boton, false)
            error.textContent = err.message === "Failed to fetch" ? "No se pudo conectar con el servidor." : err.message
        }
    })
}

async function imprimirComprobanteCobro(data){
    const ventana = window.open("", "_blank", "width=380,height=640")
    if(!ventana){
        LunaUI.toast("El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.", "error")
        return
    }
    let logo = ""
    try{
        logo = await (await fetch("../img/logo_luna.svg")).text()
    }catch(error){
        console.error("No se pudo cargar el logo:", error)
    }
    const e = window.escapeHtml
    const { pago, cuenta } = data
    ventana.document.open()
    ventana.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="color-scheme" content="light">
        <title>Comprobante de cobro #${Number(pago.id)}</title>
        <style>
            @page { margin: 4mm; }
            html { background: #fff; }
            body { background: #fff; font-family: "Courier New", monospace; font-size: 12px; width: 72mm; margin: 0 auto; color: #000; }
            .c { text-align: center; } .r { text-align: right; } .b { font-weight: bold; }
            svg { width: 62mm; height: auto; display: block; margin: 0 auto 6px; }
            hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; } td { padding: 1px 0; }
            .grande { font-size: 15px; }
            .firma { margin-top: 34px; border-top: 1px solid #000; text-align: center; padding-top: 3px; }
        </style></head>
        <body onload="window.print()">
            <div class="c">${logo}<p class="b">COMPROBANTE DE COBRO</p><p>Cuenta por cobrar (libreta)</p></div>
            <hr>
            <p>Recibo N.º: ${String(Number(pago.id)).padStart(6, "0")}</p>
            <p>Fecha: ${e(pago.fecha)}</p>
            <p>Cliente: ${e(cuenta.cliente)}</p>
            <p>Cajero: ${e(pago.cajero)} · Caja #${Number(pago.caja_id)}</p>
            ${pago.observacion ? `<p>Obs.: ${e(pago.observacion)}</p>` : ""}
            <hr>
            <table>
                <tr class="b grande"><td>MONTO COBRADO</td><td class="r">${formatoGs(pago.monto)}</td></tr>
                <tr><td>Total de la cuenta</td><td class="r">${formatoGs(cuenta.total)}</td></tr>
                <tr><td>Total pagado</td><td class="r">${formatoGs(cuenta.pagado)}</td></tr>
                <tr class="b"><td>SALDO PENDIENTE</td><td class="r">${formatoGs(cuenta.saldo)}</td></tr>
            </table>
            ${cuenta.cancelada ? '<hr><p class="c b">CUENTA SALDADA</p>' : ""}
            <hr>
            <p class="c">Comprobante interno &mdash; no válido como factura</p>
            <div class="firma">Firma y aclaración</div>
        </body></html>`)
    ventana.document.close()
}
