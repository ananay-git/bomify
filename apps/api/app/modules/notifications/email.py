"""
Email delivery for notifications (plain SMTP, no extra dependencies).

Emails are sent from a background task so the API response is never held up by
a slow mail server, and a failure to send never breaks the request that
triggered it. If SMTP_HOST is empty, email is skipped and a line is logged.
"""

import asyncio
import logging
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage as MimeMessage
from html import escape

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class EmailMessage:
    to: str
    subject: str
    text: str
    html: str | None = None


def email_enabled() -> bool:
    return bool(settings.SMTP_HOST)


def build_notification_email(
    to: str, full_name: str, title: str, message: str, link: str | None
) -> EmailMessage:
    """Build a simple text + HTML email for a notification."""
    url = f"{settings.APP_BASE_URL.rstrip('/')}{link}" if link else settings.APP_BASE_URL

    text = f"Hi {full_name},\n\n{message}\n\nOpen QuadStack: {url}\n"

    safe_message = escape(message).replace("\n", "<br>")
    html = (
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2937;">'
        f"<p>Hi {escape(full_name)},</p>"
        f"<p>{safe_message}</p>"
        f'<p><a href="{escape(url, quote=True)}" '
        'style="display:inline-block;padding:10px 18px;background:#1677ff;'
        'color:#ffffff;text-decoration:none;border-radius:6px;">Open QuadStack</a></p>'
        "</div>"
    )
    return EmailMessage(to=to, subject=title, text=text, html=html)


def _send_sync(messages: list[EmailMessage]) -> None:
    """Send all messages over a single SMTP connection (blocking)."""
    context = ssl.create_default_context()
    if settings.SMTP_USE_SSL:
        server: smtplib.SMTP = smtplib.SMTP_SSL(
            settings.SMTP_HOST, settings.SMTP_PORT, timeout=15, context=context
        )
    else:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)

    with server:
        if not settings.SMTP_USE_SSL and settings.SMTP_USE_TLS:
            server.starttls(context=context)
        if settings.SMTP_USERNAME:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)

        for m in messages:
            mime = MimeMessage()
            mime["Subject"] = m.subject
            mime["From"] = settings.SMTP_FROM
            mime["To"] = m.to
            mime.set_content(m.text)
            if m.html:
                mime.add_alternative(m.html, subtype="html")
            server.send_message(mime)


async def send_emails(messages: list[EmailMessage]) -> None:
    """Send emails without ever raising. Safe to use as a FastAPI background task."""
    if not messages:
        return
    if not email_enabled():
        logger.info(
            "SMTP_HOST is not set — skipped %d notification email(s).", len(messages)
        )
        return
    try:
        await asyncio.to_thread(_send_sync, messages)
        logger.info("Sent %d notification email(s).", len(messages))
    except Exception:  # noqa: BLE001 — a mail problem must never break the app
        logger.exception("Could not send notification email(s).")
