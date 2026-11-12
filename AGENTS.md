# AGENTS.md — ERP de Minimercado

Guía para agentes de código y personas que trabajen en este repositorio. Léela antes de cambiar código. Si contradice al comportamiento real del sistema, confirma el comportamiento en el código, explica la diferencia y actualiza esta guía.

## 1. Qué es este proyecto

Sistema web de gestión para un minimercado en Paraguay. Incluye ventas de mostrador, cajas, productos e inventario, compras a proveedores, clientes con libreta de crédito, usuarios, finanzas, reportes y auditoría.

- Interfaz y mensajes en español.
- Moneda: guaraníes (Gs.). La interfaz suele mostrar importes sin decimales; la base almacena importes con precisión decimal.
- Zona horaria configurada: `America/Asuncion`.
- No asumir que todos los módulos están completos o validados en producción. Lee el estado actual de las pantallas, endpoints y modelos antes de ampliar una función.

## 2. Stack

| Capa | Tecnología |
|---|---|
| Frontend | HTML, CSS y JavaScript sin framework ni empaquetador |
| API | Django 5.2, Django REST Framework, JWT con Simple JWT |
| Base de datos | MySQL (`minimercado`, conexión local configurada en `backend/config/settings.py`) |
| Dependencias Python | `backend/requirements.txt` |

No hay `package.json`, empaquetador frontend ni configuración de TypeScript. Hay una suite de pruebas Django en `tests/` (`test_erp_flows.py`, `test_regresiones.py`); se ejecuta con `config.settings_test`, aislada de MySQL mediante SQLite en memoria, y el runner `config.test_runner.RepoTestRunner` la descubre sin indicar rutas.

## 3. Puesta en marcha y comprobaciones

Configura primero MySQL y las variables de entorno que utiliza la configuración. El archivo `.env` está excluido de Git; no lo leas para copiar valores a documentación, logs o commits.

En Windows, desde la raíz:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python manage.py check
python manage.py showmigrations
python manage.py migrate
python manage.py runserver
```

Sirve `frontend/` con un servidor HTTP estático y abre `frontend/login.html`. Evita abrir las páginas con `file://`, ya que el navegador puede bloquear llamadas al API. La configuración de desarrollo y despliegue está documentada en `README.md` y `.env.example`.

Comprobaciones útiles:

| Comando | Para qué |
|---|---|
| `python manage.py check` | Revisión de configuración Django |
| `python manage.py makemigrations --check --dry-run` | Detecta cambios de modelos sin migración |
| `ruff check . ..	ests` y `ruff format . ..	ests` (desde `backend`) | Lint y formato del código Python |
| `python manage.py showmigrations` | Muestra el estado de las migraciones |
| `python manage.py migrate` | Aplica migraciones a la base configurada |
| `python manage.py test --settings=config.settings_test` | Prueba flujos backend en una base SQLite temporal |
| `python manage.py check --deploy` | Revisa configuraciones de despliegue; requiere variables de producción |
| `waitress-serve --listen=127.0.0.1:8000 config.wsgi:application` | Servidor WSGI de producción en Windows; requiere proxy HTTPS y frontend estático |
| `node --check frontend/js/<archivo>.js` | Comprueba sintaxis de un archivo JavaScript |

Ejecuta comandos de base de datos solo cuando la conexión apunta al entorno correcto. No borres ni reinicies una base con datos del negocio.

## 4. Estructura

```text
backend/
  config/       Configuración Django, URL raíz y roles
  usuarios/     Inicio de sesión, usuarios, perfiles y roles
  inventario/   Productos, categorías, marcas, lotes y movimientos de stock
  ventas/       Ventas, cajas, movimientos de caja, clientes y libretas
  compras/      Proveedores, compras y detalles de compra
  finanzas/     Movimientos y servicios financieros
  reportes/     Consultas, reportes y generación PDF
  dashboard/    Indicadores y alertas
  auditoria/    Registro y consulta de actividad
frontend/
  *.html        Login, dashboard, reportes, usuarios, finanzas y auditoría
  ventas/       Punto de venta, historial de cajas y libreta
  inventario/   Pantalla de productos
  compras/      Compras y proveedores
  js/           Lógica de pantallas y llamadas al API
  css/          Estilos generales y específicos
```

Cada app Django contiene normalmente `models.py`, `views.py`, `urls.py` (con imports explícitos), `services.py` cuando corresponda y `migrations/`. Los permisos por rol están en `usuarios/permissions.py` (`requiere_roles`, `obtener_rol`); no hay serializers de DRF: las vistas validan y arman sus respuestas.

Instalación nueva: `migrate` crea los roles (migración `usuarios/0003_roles_iniciales`) y `python manage.py crear_admin --username <nombre>` crea el primer administrador.

Estilo: el backend pasa `ruff check` y `ruff format` con `backend/pyproject.toml`; mantenlo así al modificar código. No dejes `console.log` de depuración en el frontend.

## 5. Base de datos y reglas de negocio

- Usa `Decimal`/`DecimalField` para dinero y cantidades fraccionarias; no conviertas cálculos financieros a `float` para persistirlos.
- Los importes monetarios se almacenan normalmente con dos decimales. El stock admite tres decimales para productos vendidos por peso.
- Usa `transaction.atomic()` cuando una operación modifica varias entidades (por ejemplo, venta, detalle, stock, caja, finanzas y auditoría). Una validación fallida dentro de una transacción debe provocar rollback antes de responder.
- El stock se modifica a través de `inventario.services.registrar_movimiento` para conservar el historial de movimientos y sus valores anterior/nuevo.
- Una venta completada debe vincularse a una caja abierta seleccionada, descontar stock y registrar el movimiento contable correspondiente. Los pagos por libreta no equivalen a efectivo recibido en caja.
- Una caja tiene apertura, movimientos, cierre contado y diferencia. Toda operación de caja debe usar explícitamente la caja seleccionada; no elegir arbitrariamente la primera caja abierta.
- Las cajas pueden estar abiertas en paralelo. No añadas una restricción global que impida esa operación.
- El borrado de productos es archivado lógico (`activo=False`) para conservar ventas, compras y movimientos históricos; solo ADMIN/GERENTE pueden consultar archivados o reactivarlos.
- El POS permite varias ventas en espera. Sus carritos y datos asociados se guardan por usuario en el almacenamiento local del navegador; no son borradores compartidos entre dispositivos.
- Las pantallas web se adaptan a móvil. Para entrar desde un teléfono, sirve `frontend/` en una dirección accesible por la red local o HTTPS y usa un API accesible desde ese dispositivo.
- No uses lookups `__date`, `__month`, `__year` ni `TruncDate` sobre campos de fecha y hora: la base MariaDB de producción no tiene cargadas las tablas de zona horaria y esas consultas devuelven vacío sin error. Usa `config/fechas.py` (`rango_dia`, `filtrar_rango`, `rango_mes`, `totales_por_dia`) y formatea fechas con `timezone.localtime(...)`.
- Retiros y gastos de caja no pueden superar el efectivo disponible (`efectivo_en_caja`). Una venta sin `caja_id` solo usa una caja abierta del propio usuario.
- Los productos con unidad distinta de `kg`, `g`, `lt` o `l` se venden en cantidades enteras.
- Una venta por libreta solo se anula si el saldo pendiente de la cuenta cubre su importe; deja un `MovimientoLibreta` de tipo `ANULACION`.
- Las compras registran los costos tal como figuran en la factura; impuesto y descuento solo se aplican si se informan. Las compras a crédito se saldan con `finanzas/cuentas-por-pagar/<id>/pagar/`.
- Facturación (`ventas/facturacion.py`): los precios incluyen IVA y la tasa de cada línea se congela en `DetalleVenta.tasa_iva`. Las facturas guardan una copia de los datos del emisor y del timbrado; la numeración avanza en `ConfiguracionFacturacion` bajo `select_for_update` y un número emitido no se reutiliza (al anular la venta, la factura pasa a `ANULADA`). Valida el RUC con `normalizar_ruc` (dígito verificador módulo 11).
- Las plantillas imprimibles (`frontend/ticket.html`, `frontend/factura.html`) son plantillas Django y se abren en una ventana nueva con `document.write`; incluye imágenes en línea (`{% include "img/logo_luna.svg" %}`), no por URL relativa.
- Las migraciones se guardan en la app correspondiente. No edites migraciones ya aplicadas en una base compartida; crea una migración nueva y revisa el SQL generado.
- Al cambiar un modelo, crea y revisa la migración antes de aplicar `migrate`.

## 6. Backend: cómo añadir o cambiar un módulo

- Mantén la lógica de negocio fuera de la vista cuando ya exista un servicio para esa responsabilidad.
- Valida campos requeridos, tipos, rangos, relaciones y estados antes de persistir. Devuelve errores claros en español con códigos HTTP adecuados (400 para entrada inválida, 404 para recurso inexistente, 401/403 para acceso no autorizado).
- Usa `@api_view` para declarar los métodos HTTP aceptados y `@permission_classes([IsAuthenticated])` en endpoints que requieren sesión. El API debe imponer el permiso aunque la interfaz oculte el botón.
- Comprueba los permisos de rol existentes en `usuarios/permissions.py`, `frontend/js/permisos.js` y los archivos de permisos relacionados antes de añadir reglas.
- Mantén las escrituras relacionadas dentro de una transacción. Considera concurrencia al modificar stock, generar números de ticket o cerrar cajas.
- Evita `except Exception` que convierta errores de validación o configuración en respuestas 500 opacas. No devuelvas trazas ni secretos al cliente.
- Agrega la ruta en el `urls.py` de la app y confirma que la app está incluida en `backend/config/urls.py`.
- No cambies el formato de respuesta de un endpoint sin revisar sus consumidores en `frontend/js/`.

## 7. Frontend: cómo cambiar una pantalla

- Conserva el estilo y los patrones existentes en `frontend/css/` y `frontend/js/`; no introduzcas un framework o compilador sin una tarea que lo requiera.
- Los importes y fechas deben ser legibles para el personal del minimercado y coherentes con Paraguay.
- Escapa o inserta texto de usuario de forma segura. Evita interpolar nombres, búsquedas y otros datos sin confianza directamente en `innerHTML` o atributos `onclick`.
- Las llamadas autenticadas deben adjuntar el token según el patrón existente. No guardes contraseñas ni secretos en `localStorage`.
- Los montos que el usuario escribe como texto (por ejemplo en `prompt`) se interpretan con `window.parseMontoGs`, que toma el punto como separador de miles ("150.000" = 150000).
- La base URL del API se centraliza en `frontend/js/api-config.js`. Usa `window.apiUrl()` o `window.API_BASE_URL`; no agregues hosts fijos a nuevos scripts. En despliegues con otro origen, configura `window.ERP_API_BASE_URL` o la meta `api-base-url` antes de cargar esa configuración.
- Para ventanas, confirmaciones y avisos usa `frontend/js/luna-ui.js` y `frontend/css/luna-ui.css` (`LunaUI.modal`, `LunaUI.confirmar`, `LunaUI.toast`, `LunaUI.campoGuaranies`, `LunaUI.flash`) en lugar de `alert`, `prompt` o `confirm`, para mantener la identidad de Luna Minimarket. Las pantallas de compras y cuentas por cobrar ya los usan.
- Si agregas una pantalla o acción, revisa navegación, permisos de menú, estados vacíos, errores de red y accesibilidad básica (labels, botones y foco).

## 8. Seguridad y configuración

- `.env` y credenciales no se comparten ni se incluyen en Git. No imprimas sus contenidos.
- No hardcodees claves JWT, claves Django, contraseñas, tokens de túnel ni credenciales de base de datos. Obtén los secretos de configuración de entorno y usa claves fuertes.
- La autenticación API usa JWT. Trata todo dato del navegador como entrada no confiable y valida autorización en servidor para cada operación de lectura o escritura sensible.
- Los permisos visuales del menú son solo una ayuda de interfaz, no un control de seguridad.
- Revisa `DEBUG`, `ALLOWED_HOSTS`, CORS y la URL de API antes de desplegar. No dejes `DEBUG=True` ni CORS abierto en producción.
- No registres tokens, contraseñas ni datos personales innecesarios.

## 9. Módulos y estado conocido

El estado indica que hay código, no que el módulo haya pasado una validación integral de negocio o producción.

| Módulo | Código principal | Estado observado |
|---|---|---|
| Usuarios y acceso | `backend/usuarios`, `frontend/login.html`, `frontend/usuarios.html` | Implementado; revisión de permisos y autenticación cubierta parcialmente por pruebas backend |
| Productos e inventario | `backend/inventario`, `frontend/inventario`, `frontend/js/productos.js` | Productos, stock, movimientos y alertas; CRUD y ajustes cubiertos parcialmente por pruebas backend |
| Ventas y caja | `backend/ventas`, `frontend/ventas/caja.html`, `frontend/ventas/historial_ventas.html` | POS responsivo, varias ventas en espera, cajas abiertas, ticket o factura, historial con reimpresión, facturación posterior y anulación (ADMIN/GERENTE). Flujos cubiertos por pruebas y E2E; falta carga concurrente de producción |
| Facturación | `backend/ventas/facturacion.py`, `frontend/facturacion.html`, `frontend/factura.html`, `frontend/factura_digital.html`, `frontend/ventas/facturas.html` | Factura con timbrado, IVA 5 %/10 %/exentas, original y duplicado en ticket 80 mm o A4, y formato A4 estilo factura electrónica (QR y código de control HMAC). Pantalla Facturas emitidas (ADMIN/GERENTE) con filtros, totales y libro de ventas CSV. Requiere timbrado autorizado por la SET para autoimpresor; no implementa SIFEN |
| Clientes y libreta | `backend/ventas`, `frontend/ventas/libreta.html` | Cuentas por cobrar y pagos; validar saldos y auditoría de cobros |
| Compras y proveedores | `backend/compras`, `frontend/compras/registrar_compra.html`, `frontend/compras/compras.html` | Registro y consulta separados; compras contado/crédito y pagos a proveedor (cuentas por pagar) cubiertos por pruebas; validar IVA 5 %/10 % con el contador si se requiere desglose fiscal |
| Finanzas | `backend/finanzas`, `frontend/finanzas.html` | Movimientos financieros; validar conciliación con ventas y compras |
| Dashboard | `backend/dashboard`, `frontend/dashboard.html` | Indicadores y alertas; validar filtros, estados y totales |
| Reportes | `backend/reportes`, `frontend/reportes.html` | Consultas y PDF; cotejar cada total con datos fuente |
| Auditoría | `backend/auditoria`, `frontend/auditoria.html` | Consulta de eventos; confirmar cobertura de acciones sensibles |

## 10. Antes de terminar una tarea

- [ ] Revisé las instrucciones de esta guía y el código relacionado.
- [ ] Validé entradas, permisos y errores del API.
- [ ] Si hay varias escrituras relacionadas, añadí o conservé la transacción y el rollback correctos.
- [ ] Si cambió un modelo, generé y revisé una migración.
- [ ] Revisé todos los consumidores frontend del endpoint modificado.
- [ ] Ejecuté las comprobaciones disponibles y reporté lo que no pude ejecutar.
- [ ] No agregué secretos, datos personales, archivos temporales ni cambios ajenos a la tarea.
- [ ] Actualicé esta guía si cambió una convención o el estado del proyecto.
