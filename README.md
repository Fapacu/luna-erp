# ERP de Minimercado

Sistema web para ventas de mostrador, cajas simultáneas, productos e inventario, compras, proveedores, clientes y libreta, finanzas, reportes, usuarios y auditoría.

La interfaz está en español, usa guaraníes y configura `America/Asuncion`. El proyecto tiene frontend HTML/CSS/JavaScript y API Django REST Framework con MySQL.

## Estado

Los módulos principales están implementados y existe una suite de pruebas de flujos del backend en `tests/` (`test_erp_flows.py` y `test_regresiones.py`). Eso no equivale a una certificación integral ni a una validación en producción: antes de operar con datos reales hay que ejecutar la lista de puesta en marcha y validar el entorno, los permisos, los respaldos y los flujos en navegador.

## Desarrollo local en Windows

1. Instala MySQL y crea una base `minimercado` junto con un usuario de aplicación con permisos sobre esa base.
2. Copia `.env.example` como `.env`. Cambia la clave secreta y la contraseña de MySQL; no compartas ni subas `.env`.
3. Desde la raíz, crea y activa el entorno virtual e instala dependencias:

   ```powershell
   python -m venv backend\venv
   .\backend\venv\Scripts\Activate.ps1
   pip install -r backend\requirements.txt
   ```

4. Ejecuta comprobaciones y migraciones desde `backend`:

   ```powershell
   cd backend
   python manage.py check
   python manage.py makemigrations --check --dry-run
   python manage.py showmigrations
   python manage.py migrate
   python manage.py runserver
   ```

5. En otra terminal, desde la raíz, sirve el frontend por HTTP:

   ```powershell
   python -m http.server 5500 --directory frontend
   ```

   Abre `http://127.0.0.1:5500/login.html`. No uses `file://`. Para entrar desde un teléfono, sirve el frontend en una IP LAN, agrega esa IP a `ALLOWED_HOSTS` y agrega el origen exacto a `CORS_ALLOWED_ORIGINS`; inicia Django escuchando en la interfaz LAN y habilita el puerto en el firewall.

## Pruebas

La configuración `config.settings_test` usa SQLite en memoria y no modifica la base de desarrollo ni la de producción:

```powershell
cd backend
python manage.py test --settings=config.settings_test --verbosity 2
```

El runner `config.test_runner.RepoTestRunner` descubre automáticamente la carpeta `tests/` de la raíz.

También comprueba sintaxis JavaScript con `node --check frontend/js/<archivo>.js`.

## Configuración de API

`frontend/js/api-config.js` establece el origen del API según cómo se sirve la página. Por defecto, usa `127.0.0.1:8000` en desarrollo local y el mismo host de la página cuando se publica tras HTTPS. Para una topología distinta, define antes de cargar `api-config.js` `window.ERP_API_BASE_URL` o usa `<meta name="api-base-url" content="https://host/api">`. Si el API responde 401 (sesión vencida), la interfaz limpia la sesión y vuelve al inicio de sesión.

## Datos del negocio y zona horaria

- El ticket de venta imprime `NEGOCIO_NOMBRE`, `NEGOCIO_RUC`, `NEGOCIO_DIRECCION` y `NEGOCIO_TELEFONO` (ver `.env.example`). Es un comprobante interno, no una factura legal.
- Las consultas por fecha usan rangos calculados en Python (`config/fechas.py`), por lo que no requieren cargar las tablas de zonas horarias de MySQL/MariaDB.
- El inicio de sesión limita los intentos por IP (`LOGIN_THROTTLE_RATE`, por defecto `10/min`). El contador vive en memoria del proceso; con varios procesos WSGI conviene configurar una caché compartida.

## Preparación para producción

- Usa un `SECRET_KEY` nuevo y aleatorio, `DEBUG=false`, `ALLOWED_HOSTS` con dominios exactos y credenciales MySQL de mínimo privilegio.
- Define `CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS` con los orígenes reales; deja `CORS_ALLOW_ALL_ORIGINS=false`.
- Publica el sitio solo por HTTPS. Si hay un proxy TLS delante de Django, configura su cabecera de protocolo y `TRUST_PROXY_SSL_HEADER` de acuerdo con ese proxy.
- En Windows, Waitress está incluido como servidor WSGI. Ejecuta desde `backend` `waitress-serve --listen=127.0.0.1:8000 config.wsgi:application` detrás de un proxy TLS que sirva el frontend y reenvíe `/api/` a Waitress. Waitress escucha HTTP y no termina TLS por sí mismo.
- Ejecuta `python manage.py check --deploy` con la configuración de producción y prepara el servicio de archivos estáticos y multimedia (`STATIC_ROOT` y `MEDIA_ROOT`). `runserver` es solo para desarrollo.
- Configura copias de seguridad automáticas de MySQL, retención, monitoreo y una prueba de restauración antes de cargar datos del negocio.
- Valida los módulos en navegador con roles de administrador, gerente y cajero, incluyendo dos cajas abiertas, ventas concurrentes, compras a crédito, cobros de libreta, anulaciones y cierres.

La configuración del repositorio no puede certificar la disponibilidad del servidor, MySQL, HTTPS, firewall, copias de seguridad o recuperación del negocio. Esos elementos deben verificarse en el entorno donde se desplegará.
