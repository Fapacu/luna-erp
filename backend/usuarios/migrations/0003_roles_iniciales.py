"""Crea los roles del sistema en instalaciones nuevas (idempotente)."""

from django.db import migrations

ROLES = ("ADMIN", "GERENTE", "CAJERO")


def crear_roles(apps, schema_editor):
    Role = apps.get_model("usuarios", "Role")
    for nombre in ROLES:
        if not Role.objects.filter(nombre__iexact=nombre).exists():
            Role.objects.create(nombre=nombre)


class Migration(migrations.Migration):
    dependencies = [
        ("usuarios", "0002_role_usuarioperfil_delete_usuario"),
    ]

    operations = [
        migrations.RunPython(crear_roles, migrations.RunPython.noop),
    ]
