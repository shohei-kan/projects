from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EmployeeViewSet, SanitationCheckViewSet

router = DefaultRouter()
router.register(r'employees', EmployeeViewSet)
router.register(r'sanitation-checks', SanitationCheckViewSet)

urlpatterns = [
    path('api/', include(router.urls)),
]
