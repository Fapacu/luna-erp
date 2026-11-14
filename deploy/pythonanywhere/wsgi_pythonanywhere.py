# Contenido para el archivo WSGI de PythonAnywhere
# (pestaña "Web" -> sección "Code" -> enlace "WSGI configuration file").
# Borra todo lo que trae ese archivo y pega este contenido.
# Reemplaza TU_USUARIO por tu usuario de PythonAnywhere.

import os
import sys

PROYECTO = "/home/TU_USUARIO/luna-erp"

# Django vive en la carpeta backend/ del repositorio.
sys.path.insert(0, os.path.join(PROYECTO, "backend"))
os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings"

# config/settings.py carga las variables desde PROYECTO/.env
from django.core.wsgi import get_wsgi_application  # noqa: E402

application = get_wsgi_application()
