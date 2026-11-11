from django.contrib.auth.models import User
from django.db import models


class Role(models.Model):
    nombre = models.CharField(max_length=50)

    def __str__(self):
        return self.nombre


class UsuarioPerfil(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.ForeignKey(Role, on_delete=models.CASCADE)

    def __str__(self):
        return self.user.username
