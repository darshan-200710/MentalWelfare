from app.websocket.manager import manager

async def emit_alert_created(alert_data: dict):
    """Notify admins/supervisors when a new alert is created."""
    await manager.broadcast_to_admins({"type": "alert_created", "data": alert_data})

async def emit_risk_event(user_id: str, risk_data: dict):
    """Notify admins when risk level changes."""
    await manager.broadcast_to_admins({"type": "risk_event", "data": risk_data})

async def emit_notification(user_id: str, notification: dict):
    """Send notification to specific user."""
    await manager.send_to_user(user_id, {"type": "notification", "data": notification})

async def emit_morale_update(user_id: str, morale_data: dict):
    """Broadcast morale score updates for dashboard."""
    await manager.broadcast_to_admins({"type": "morale_update", "data": {"user_id": user_id, **morale_data}})
