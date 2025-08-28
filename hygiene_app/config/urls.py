from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def healthz(_): return JsonResponse({"status":"ok"})

urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz", healthz),
    path("api/", include("hygiene.urls")),
]
