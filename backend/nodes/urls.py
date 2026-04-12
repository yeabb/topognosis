from django.urls import path
from .views import NodeListCreateView, NodeDetailView, checkout_node, branch_node, append_event

urlpatterns = [
    path('', NodeListCreateView.as_view(), name='node-list-create'),
    path('<uuid:pk>/', NodeDetailView.as_view(), name='node-detail'),
    path('<uuid:pk>/checkout/', checkout_node, name='node-checkout'),
    path('<uuid:pk>/branch/', branch_node, name='node-branch'),
    path('<uuid:pk>/events/', append_event, name='node-append-event'),
]
