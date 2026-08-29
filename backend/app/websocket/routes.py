from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import jwt
from app.core.config import get_settings
from app.websocket.manager import manager

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    settings = get_settings()
    try:
        # Validate JWT token from query param
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        
        # Extract user_id and role
        user_id = payload.get("sub")
        role = payload.get("role", "USER")
        
        if not user_id:
            await websocket.close(code=1008)
            return
            
    except jwt.PyJWTError:
        await websocket.close(code=1008)
        return

    # Connect to manager
    await manager.connect(websocket, user_id, role)
    try:
        # Keep alive with ping/pong
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        # On disconnect, clean up
        manager.disconnect(websocket, user_id, role)
