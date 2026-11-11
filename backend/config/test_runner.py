"""Runner que descubre la suite ubicada en ``tests/`` en la raíz del repositorio."""

from django.conf import settings
from django.test.runner import DiscoverRunner


class RepoTestRunner(DiscoverRunner):
    def build_suite(self, test_labels=None, **kwargs):
        if not test_labels:
            raiz = settings.BASE_DIR.parent
            test_labels = [str(raiz / "tests")]
            self.top_level = str(raiz)
        return super().build_suite(test_labels, **kwargs)
