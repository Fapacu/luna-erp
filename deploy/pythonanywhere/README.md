# Publicar Luna ERP en PythonAnywhere

Guía paso a paso para dejar el sistema funcionando en `https://TU_USUARIO.pythonanywhere.com`
(o en un dominio propio). Django publica la API y también el frontend, así que hay **una sola aplicación web**.

> En todos los comandos reemplaza `TU_USUARIO` por tu usuario de PythonAnywhere.

## 0. Cuenta

1. Crea una cuenta en [pythonanywhere.com](https://www.pythonanywhere.com).
2. Para un cliente real usa un **plan pago** (el básico alcanza): permite dominio propio, tareas programadas
   para los respaldos y no vence. La cuenta gratuita sirve para probar, pero vence cada 3 meses si no se renueva.

## 1. Base de datos MySQL

1. Pestaña **Databases** → define una contraseña de MySQL y guárdala.
2. En "Create a database" escribe `minimercado` y crea la base. Su nombre completo será `TU_USUARIO$minimercado`.
3. Anota el **Database host**: `TU_USUARIO.mysql.pythonanywhere-services.com`.

## 2. Código y entorno de Python

Abre una consola **Bash** (pestaña **Consoles**) y ejecuta:

```bash
git clone https://github.com/Fapacu/luna-erp.git
cd luna-erp
mkvirtualenv --python=/usr/bin/python3.11 luna
pip install -r backend/requirements.txt
```

Si el repositorio es privado, GitHub pedirá usuario y un **token personal** (Settings → Developer settings →
Personal access tokens) en lugar de la contraseña.

## 3. Variables de entorno (.env)

```bash
cp deploy/pythonanywhere/env.ejemplo .env
python -c "import secrets; print(secrets.token_urlsafe(50))"
nano .env
```

Completa `SECRET_KEY` con la clave que imprimió el segundo comando, reemplaza `TU_USUARIO` y pon la contraseña
de MySQL. Guarda con `Ctrl+O`, `Enter` y sal con `Ctrl+X`.

## 4. Preparar la base y el primer usuario

```bash
cd ~/luna-erp/backend
python manage.py check --deploy
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py crear_admin --username admin
```

`migrate` crea las tablas y los roles ADMIN, GERENTE y CAJERO. `crear_admin` pide la contraseña del administrador.

## 5. Aplicación web

1. Pestaña **Web** → **Add a new web app** → **Manual configuration** → **Python 3.11**.
2. En **Virtualenv** escribe: `/home/TU_USUARIO/.virtualenvs/luna`
3. En **Code**, abre el *WSGI configuration file*, borra su contenido y pega el de
   [`wsgi_pythonanywhere.py`](wsgi_pythonanywhere.py) (con tu usuario).
4. En **Security**, activa **Force HTTPS**.
5. Pulsa **Reload** (botón verde).

Abre `https://TU_USUARIO.pythonanywhere.com` e inicia sesión con el administrador.
No hace falta configurar *Static files*: el frontend y los estilos del panel de administración los sirve la aplicación.

## 6. Respaldo diario (obligatorio para un cliente)

Pestaña **Tasks** → crea una tarea diaria (por ejemplo, 03:00 UTC) con este comando:

```bash
cd ~/luna-erp/backend && /home/TU_USUARIO/.virtualenvs/luna/bin/python manage.py respaldar_base --dias 14
```

Guarda un `.sql.gz` diario en `~/respaldos` y borra los de más de 14 días. Descarga una copia periódicamente
desde la pestaña **Files** para tener un respaldo fuera del servidor.

Para restaurar un respaldo:

```bash
gunzip -c ~/respaldos/ARCHIVO.sql.gz | mysql -h TU_USUARIO.mysql.pythonanywhere-services.com -u TU_USUARIO -p 'TU_USUARIO$minimercado'
```

## 7. Dominio propio (opcional)

1. Pestaña **Web** → **Add a new web app** con tu dominio (por ejemplo `www.lunaminimarket.com.py`) y repite el paso 5,
   o cambia el dominio de la app existente.
2. En tu proveedor de dominio crea un registro **CNAME** de `www` hacia el valor que indica PythonAnywhere
   (`webapp-XXXX.pythonanywhere.com`).
3. En **Security**, solicita el certificado HTTPS gratuito (*Let's Encrypt*) y activa **Force HTTPS**.
4. Agrega el dominio a `ALLOWED_HOSTS` y a `CSRF_TRUSTED_ORIGINS` en `.env` y pulsa **Reload**.

## 8. Actualizar a una versión nueva

```bash
cd ~/luna-erp
git pull
workon luna
pip install -r backend/requirements.txt
cd backend
python manage.py migrate
python manage.py collectstatic --noinput
```

Después pulsa **Reload** en la pestaña **Web**. Es necesario: la aplicación lee los archivos del frontend al iniciar,
y hasta el Reload seguiría sirviendo la versión anterior.

## Problemas frecuentes

| Síntoma | Qué revisar |
|---|---|
| "Something went wrong" o error 500 | Pestaña **Web** → *Error log*. Suele ser un dato mal escrito en `.env`. |
| `DisallowedHost` / error 400 | Falta el dominio en `ALLOWED_HOSTS`. |
| El admin de Django rechaza el login (CSRF) | Falta el dominio con `https://` en `CSRF_TRUSTED_ORIGINS`. |
| "Access denied" de MySQL | Usuario, contraseña o `DB_NAME` (`TU_USUARIO$minimercado`) en `.env`. |
| Los cambios no aparecen | Faltó **Reload** o recargar el navegador con `Ctrl+F5`. |
