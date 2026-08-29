import asyncio
from collections import defaultdict
from fastapi import WebSocket
import json

class ConnectionManager:
    """Manages WebSocket connections grouped by user_id and role."""
    
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = defaultdict(list)  # user_id -> connections
        self.role_connections: dict[str, list[WebSocket]] = defaultdict(list)  # role -> connections
    
    async def connect(self, websocket: WebSocket, user_id: str, role: str):
        await websocket.accept()
        self.active_connections[user_id].append(websocket)
        self.role_connections[role].append(websocket)
    
    def disconnect(self, websocket: WebSocket, user_id: str, role: str):
        self.active_connections[user_id] = [c for c in self.active_connections[user_id] if c != websocket]
        self.role_connections[role] = [c for c in self.role_connections[role] if c != websocket]
    
    async def send_to_user(self, user_id: str, message: dict):
        for conn in self.active_connections.get(user_id, []):
            try: await conn.send_json(message)
            except: pass
    
    async def send_to_role(self, role: str, message: dict):
        for conn in self.role_connections.get(role, []):
            try: await conn.send_json(message)
            except: pass
    
    async def broadcast_to_admins(self, message: dict):
        for role in ('ADMIN', 'SUPER_ADMIN', 'SUPERVISOR'):
            await self.send_to_role(role, message)

manager = ConnectionManager()
