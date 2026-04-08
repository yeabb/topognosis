from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/graphs/(?P<graph_id>[^/]+)/$', consumers.GraphConsumer.as_asgi()),
]
