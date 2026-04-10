from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def health(request):
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health),
    path('api/auth/', include('users.urls')),
    path('api/graphs/', include('graphs.urls')),
    path('api/nodes/', include('nodes.urls')),
]
