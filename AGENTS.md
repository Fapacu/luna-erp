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

No hay `package.json`, empaquetador frontend ni configuración de TypeScript. Hay una suite de pruebas Django en `tests/test_erp_flows.py`; se ejecuta con `config.settings_test`, aislada de MySQL mediante SQLite en memoria.

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
  middleware/   Permisos y controles compartidos
frontend/
  *.html        Login, dashboard, reportes, usuarios, finanzas y auditoría
  ventas/       Punto de venta, historial de cajas y libreta
  inventario/   Pantalla de productos
  compras/      Compras y proveedores
  js/           Lógica de pantallas y llamadas al API
  css/          Estilos generales y específicos
```

Cada app Django contiene normalmente `models.py`, `views.py`, `urls.py`, `services.py`/`serializers.py` cuando corresponda y `migrations/`.

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
- La base URL del API se centraliza en `frontend/js/api-config.js`. Usa `window.apiUrl()` o `window.API_BASE_URL`; no agregues hosts fijos a nuevos scripts. En despliegues con otro origen, configura `window.ERP_API_BASE_URL` o la meta `api-base-url` antes de cargar esa configuración.
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
| Ventas y caja | `backend/ventas`, `frontend/ventas/caja.html` | POS responsivo, varias ventas en espera y cajas abiertas; los carritos quedan locales al navegador. Flujos de caja y venta cubiertos parcialmente por pruebas; falta carga concurrente de producción |
| Clientes y libreta | `backend/ventas`, `frontend/ventas/libreta.html` | Cuentas por cobrar y pagos; validar saldos y auditoría de cobros |
| Compras y proveedores | `backend/compras`, `frontend/compras/registrar_compra.html`, `frontend/compras/compras.html` | Registro de compras separado de la consulta de compras realizadas; compras contado/crédito cubiertas parcialmente; validar pagos e impuestos con reglas reales del negocio |
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
