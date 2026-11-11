"""Crea el primer usuario administrador del sistema.

Uso:
    python manage.py crear_admin --username admin
La contraseña se pide por teclado (no queda en el historial de la terminal).
"""

from getpass import getpass

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from usuarios.models import Role, UsuarioPerfil


class Command(BaseCommand):
    help = "Crea un usuario con rol ADMIN para el primer ingreso al sistema."

    def add_arguments(self, parser):
        parser.add_argument("--username", required=True, help="Nombre de usuario del administrador.")
        parser.add_argument("--email", default="", help="Correo electrónico (opcional).")

    def handle(self, *args, **opciones):
        username = opciones["username"].strip()
        if not username:
            raise CommandError("El nombre de usuario es obligatorio.")
        if User.objects.filter(username=username).exists():
            raise CommandError(f"Ya existe un usuario llamado «{username}».")

        password = getpass("Contraseña: ")
        if password != getpass("Repite la contraseña: "):
            raise CommandError("Las contraseñas no coinciden.")
        if len(password) < 8:
            raise CommandError("La contraseña debe tener al menos 8 caracteres.")
        try:
            validate_password(password)
        except ValidationError as error:
            raise CommandError(" ".join(error.messages)) from error

        with transaction.atomic():
            rol = Role.objects.filter(nombre="ADMIN").order_by("id").first() or Role.objects.create(
                nombre="ADMIN"
            )
            usuario = User.objects.create_user(
                username=username, email=opciones["email"], password=password, is_staff=True
            )
            UsuarioPerfil.objects.create(user=usuario, role=rol)

        self.stdout.write(self.style.SUCCESS(f"Administrador «{username}» creado. Ya puede iniciar sesión."))
