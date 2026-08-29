import smtplib
from email.message import EmailMessage
from abc import ABC, abstractmethod
from typing import Tuple

from app.core.config import get_settings

class EmailProvider(ABC):
    @abstractmethod
    async def send(self, to: str, subject: str, html_body: str) -> bool:
        pass

class ConsoleEmailProvider(EmailProvider):
    async def send(self, to: str, subject: str, html_body: str) -> bool:
        print(f"--- EMAIL TO: {to} ---")
        print(f"SUBJECT: {subject}")
        print(f"BODY:\n{html_body}")
        print("-----------------------")
        return True

class SMTPEmailProvider(EmailProvider):
    def __init__(self):
        settings = get_settings()
        self.host = settings.smtp_host
        self.port = settings.smtp_port
        self.user = settings.smtp_user
        self.password = settings.smtp_password
        self.from_email = settings.smtp_from

    async def send(self, to: str, subject: str, html_body: str) -> bool:
        if not self.host:
            print("SMTP Host not configured.")
            return False

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = self.from_email
        msg["To"] = to
        msg.set_content(html_body, subtype="html")

        try:
            # Using synchronous smtplib in an async context, ideally this should be run in a threadpool
            # but for simplicity and standard lib constraint, doing it directly
            import asyncio
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, self._send_sync, msg)
            return True
        except Exception as e:
            print(f"Failed to send email: {e}")
            return False

    def _send_sync(self, msg: EmailMessage):
        with smtplib.SMTP(self.host, self.port) as server:
            server.starttls()
            if self.user and self.password:
                server.login(self.user, self.password)
            server.send_message(msg)

def get_email_provider() -> EmailProvider:
    settings = get_settings()
    if settings.environment == "production" and settings.smtp_host:
        return SMTPEmailProvider()
    return ConsoleEmailProvider()

def verification_email(name: str, token: str, base_url: str) -> Tuple[str, str]:
    subject = "Verify your email - MentalWelfare"
    verify_url = f"{base_url}/verify-email?token={token}"
    html = f"""
    <p>Hi {name},</p>
    <p>Please verify your email address by clicking the link below:</p>
    <p><a href="{verify_url}">Verify Email</a></p>
    <p>If you didn't request this, you can ignore this email.</p>
    """
    return subject, html

def password_reset_email(name: str, token: str, base_url: str) -> Tuple[str, str]:
    subject = "Password Reset Request - MentalWelfare"
    reset_url = f"{base_url}/reset-password?token={token}"
    html = f"""
    <p>Hi {name},</p>
    <p>We received a request to reset your password. Click the link below to set a new one:</p>
    <p><a href="{reset_url}">Reset Password</a></p>
    <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
    """
    return subject, html

def alert_notification_email(name: str, alert_details: dict) -> Tuple[str, str]:
    subject = f"Alert Notification: {alert_details.get('severity', 'Info')}"
    html = f"""
    <p>Hi {name},</p>
    <p>A new alert requires your attention:</p>
    <p><b>Reason:</b> {alert_details.get('reason', 'N/A')}</p>
    <p><b>Source:</b> {alert_details.get('source', 'N/A')}</p>
    <p>Please log in to the platform to review.</p>
    """
    return subject, html
