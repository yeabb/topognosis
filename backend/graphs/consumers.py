import json
import logging
from urllib.parse import parse_qs

from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class GraphConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.graph_id = self.scope['url_route']['kwargs']['graph_id']
        self.group_name = f'graph_{self.graph_id}'

        # JWT auth via ?token=<access_token> query param
        # (AuthMiddlewareStack uses Django session cookies — not compatible with JWT)
        if not await self._authenticate():
            await self.close(code=4001)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.debug('GraphConsumer connected for graph %s', self.graph_id)

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        # Browser → server messages not used yet
        pass

    async def graph_event(self, event):
        """Called by channel layer when append_event broadcasts to this group."""
        await self.send(text_data=json.dumps(event['data']))

    async def _authenticate(self) -> bool:
        """Verify the JWT access token passed as ?token=<jwt> in the query string."""
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            qs = parse_qs(self.scope.get('query_string', b'').decode())
            token_str = qs.get('token', [None])[0]
            if not token_str:
                return False
            AccessToken(token_str)  # raises if invalid or expired
            return True
        except Exception:
            return False
