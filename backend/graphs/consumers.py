import json
from channels.generic.websocket import AsyncWebsocketConsumer


class GraphConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.graph_id = self.scope['url_route']['kwargs']['graph_id']
        self.group_name = f'graph_{self.graph_id}'

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        await self.channel_layer.group_send(
            self.group_name,
            {'type': 'graph_event', 'data': data}
        )

    async def graph_event(self, event):
        await self.send(text_data=json.dumps(event['data']))
