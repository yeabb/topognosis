from django.urls import path
from .views import GraphListCreateView, GraphDetailView

urlpatterns = [
    path('', GraphListCreateView.as_view(), name='graph-list-create'),
    path('<uuid:pk>/', GraphDetailView.as_view(), name='graph-detail'),
]
