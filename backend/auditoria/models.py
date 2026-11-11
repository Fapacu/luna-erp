from django.contrib.auth.models import User
from django.db import models


class Auditoria(models.Model):
    fecha = models.DateTimeField(auto_now_add=True)

    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    modulo = models.CharField(max_length=100)

    accion = models.CharField(max_length=100)

    referencia = models.CharField(max_length=200, blank=True, null=True)

    detalle = models.TextField(blank=True, null=True)

    ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ["-fecha"]

    def __str__(self):
        return f"{self.fecha} | " f"{self.usuario} | " f"{self.accion}"
