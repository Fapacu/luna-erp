"""Respaldo de la base MySQL/MariaDB con mysqldump, comprimido y con rotación.

Uso:
    python manage.py respaldar_base --destino ~/respaldos --dias 14
Pensado para una tarea programada diaria (por ejemplo, en PythonAnywhere).
La contraseña se pasa a mysqldump por variable de entorno, no por línea de comandos.
"""

import gzip
import os
import shutil
import subprocess
import time
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone


class Command(BaseCommand):
    help = "Genera un respaldo comprimido de la base de datos y borra los más antiguos."

    def add_arguments(self, parser):
        parser.add_argument("--destino", default=str(Path.home() / "respaldos"), help="Carpeta de destino.")
        parser.add_argument("--dias", type=int, default=14, help="Días de respaldos que se conservan.")

    def handle(self, *args, **opciones):
        base = settings.DATABASES["default"]
        if "mysql" not in base["ENGINE"]:
            raise CommandError("El respaldo con mysqldump solo funciona con MySQL/MariaDB.")
        if not shutil.which("mysqldump"):
            raise CommandError("No se encontró mysqldump en el sistema.")

        destino = Path(opciones["destino"]).expanduser()
        destino.mkdir(parents=True, exist_ok=True)
        archivo = destino / f"{base['NAME'].replace('$', '_')}_{timezone.localtime():%Y-%m-%d_%H%M}.sql.gz"

        comando = [
            "mysqldump",
            "--single-transaction",
            "--routines",
            "--no-tablespaces",
            "--default-character-set=utf8mb4",
            "-h",
            str(base.get("HOST") or "127.0.0.1"),
            "-P",
            str(base.get("PORT") or "3306"),
            "-u",
            str(base["USER"]),
            base["NAME"],
        ]
        entorno = {**os.environ, "MYSQL_PWD": str(base.get("PASSWORD") or "")}

        proceso = subprocess.Popen(comando, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=entorno)
        with gzip.open(archivo, "wb") as salida:
            shutil.copyfileobj(proceso.stdout, salida)
        _, errores = proceso.communicate()
        if proceso.returncode != 0:
            archivo.unlink(missing_ok=True)
            raise CommandError(f"mysqldump falló: {errores.decode(errors='replace').strip()}")

        limite = time.time() - opciones["dias"] * 86400
        borrados = 0
        for viejo in destino.glob("*.sql.gz"):
            if viejo != archivo and viejo.stat().st_mtime < limite:
                viejo.unlink()
                borrados += 1

        tamano_kb = archivo.stat().st_size // 1024
        self.stdout.write(
            self.style.SUCCESS(
                f"Respaldo creado: {archivo} ({tamano_kb} KB). Respaldos antiguos borrados: {borrados}."
            )
        )
