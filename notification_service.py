#!/usr/bin/env python3
"""
Unified notification service for POS: Email (Gmail for testing, AWS SES for production) and SMS (AWS SNS).
Configure in Settings > Notifications > Email & SMS.
"""

import base64
import io
import json
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)

# Email notification order source logos – use inline base64 for reliable display in emails
_EMAIL_LOGO_FILES = {
    "doordash": "doordash-email-logo.svg",
    "shopify": "shopify-email-logo.svg",
    "uber_eats": "uber-eats-logo.svg",
}


_EMAIL_LOGO_CID = "orderlogo"  # CID used for img src="cid:orderlogo"


def _get_email_logo_png_bytes(logo_key: str) -> Optional[bytes]:
    """Load SVG, convert to PNG, return bytes for CID attachment. Gmail blocks SVG/data URIs."""
    fname = _EMAIL_LOGO_FILES.get(logo_key)
    if not fname:
        return None
    try:
        _dir = os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(_dir, "frontend", "public", fname)
        if not os.path.isfile(path):
            return None
        try:
            import cairosvg
            png_bytes = cairosvg.svg2png(url=path, output_width=308, output_height=36)
            return png_bytes
        except ImportError:
            logger.debug("cairosvg not installed; logo will not display in email")
        except Exception as e:
            logger.debug("cairosvg conversion failed for %s: %s", logo_key, e)
    except Exception as e:
        logger.debug("Could not load email logo %s: %s", logo_key, e)
    return None

# Default preferences when none configured
DEFAULT_PREFS = {
    "orders": {"email": False, "sms": False},
    "reports": {"email": False, "sms": False},
    "scheduling": {"email": True, "sms": True},
    "clockins": {"email": False, "sms": False},
    "receipts": {"email": True, "sms": False},
}


def _get_sms_settings(store_id: int = 1):
    """Load sms_settings for store. Returns None if not found. Tolerates missing email_* columns."""
    try:
        from database_postgres import get_connection
        conn = get_connection()
        cur = conn.cursor()
        base_cols = """setting_id, store_id, sms_provider, smtp_server, smtp_port, smtp_user, smtp_password,
                      smtp_use_tls, business_name, store_phone_number,
                      aws_access_key_id, aws_secret_access_key, aws_region"""
        try:
            cur.execute(
                f"""SELECT {base_cols}, email_provider, email_from_address, notification_preferences
                   FROM sms_settings WHERE store_id = %s AND is_active = 1 LIMIT 1""",
                (store_id,)
            )
            extended = True
        except Exception:
            cur.execute(
                f"""SELECT {base_cols} FROM sms_settings WHERE store_id = %s AND is_active = 1 LIMIT 1""",
                (store_id,)
            )
            extended = False
        row = cur.fetchone()
        conn.close()
        if row:
            d = dict(row) if hasattr(row, 'keys') else None
            if d is None:
                d = {c: row[i] for i, c in enumerate([
                    'setting_id', 'store_id', 'sms_provider', 'smtp_server', 'smtp_port', 'smtp_user',
                    'smtp_password', 'smtp_use_tls', 'business_name', 'store_phone_number',
                    'aws_access_key_id', 'aws_secret_access_key', 'aws_region'
                ])}
                if extended and len(row) > 13:
                    d['email_provider'] = row[13] if len(row) > 13 else 'gmail'
                    d['email_from_address'] = row[14] if len(row) > 14 else None
                    d['notification_preferences'] = row[15] if len(row) > 15 else {}
                else:
                    d.setdefault('email_provider', 'gmail')
                    d.setdefault('email_from_address', None)
                    d.setdefault('notification_preferences', {})
            return d
    except Exception as e:
        logger.warning("notification_service: could not load sms_settings: %s", e)
    return None


def get_notification_preferences(store_id: int = 1) -> Dict[str, Dict[str, bool]]:
    """Return merged preferences (DB + defaults)."""
    s = _get_sms_settings(store_id)
    prefs = DEFAULT_PREFS.copy()
    if s and s.get('notification_preferences'):
        np = s['notification_preferences']
        if isinstance(np, str):
            try:
                np = json.loads(np) if np else {}
            except json.JSONDecodeError:
                np = {}
        for cat, chans in (np or {}).items():
            if isinstance(chans, dict) and cat in prefs:
                prefs[cat] = {**prefs[cat], **{k: bool(v) for k, v in chans.items()}}
    return prefs


def should_send(store_id: int, category: str, channel: str) -> bool:
    """Check if we should send this type of notification."""
    prefs = get_notification_preferences(store_id)
    return prefs.get(category, {}).get(channel, False)


def send_email(
    to_address: str,
    subject: str,
    body_html: str,
    body_text: Optional[str] = None,
    store_id: int = 1,
    from_name: Optional[str] = None,
    settings_override: Optional[Dict[str, Any]] = None,
    inline_images: Optional[List[tuple]] = None,
) -> Dict[str, Any]:
    """
    Send email via Gmail SMTP (testing) or AWS SES (production).
    Returns {success: bool, message: str, provider: str}.
    inline_images: optional list of (cid, png_bytes) for CID attachments (avoids data URL blocking).
    """
    s = settings_override if settings_override else _get_sms_settings(store_id)
    if not s:
        return {"success": False, "message": "No notification settings configured. Save your Gmail/credentials first, or provide them for testing.", "provider": None}

    provider = (s.get("email_provider") or "gmail").lower()
    from_addr = s.get("email_from_address") or s.get("smtp_user") or "noreply@localhost"
    from_display = from_name or s.get("business_name") or "POS"
    if from_display:
        from_header = f"{from_display} <{from_addr}>"
    else:
        from_header = from_addr

    if provider == "gmail":
        return _send_email_gmail(s, to_address, from_header, subject, body_html, body_text, inline_images=inline_images)
    if provider == "aws_ses":
        return _send_email_aws_ses(s, to_address, from_header, subject, body_html, body_text, inline_images=inline_images)
    return {"success": False, "message": f"Unknown email provider: {provider}", "provider": provider}


def _send_email_gmail(
    s: Dict, to_addr: str, from_header: str, subject: str, body_html: str, body_text: Optional[str],
    inline_images: Optional[List[tuple]] = None,
) -> Dict[str, Any]:
    smtp_server = s.get("smtp_server") or "smtp.gmail.com"
    smtp_port = int(s.get("smtp_port") or 587)
    smtp_user = (s.get("smtp_user") or "").replace("\xa0", " ").strip()
    smtp_password = (s.get("smtp_password") or "").replace("\xa0", "").replace("\u00a0", "").strip()
    use_tls = s.get("smtp_use_tls", 1)

    if not smtp_user or not smtp_password or smtp_password == "***":
        return {"success": False, "message": "Gmail: SMTP user and app password required", "provider": "gmail"}

    try:
        if inline_images:
            msg = MIMEMultipart("related")
            msg["Subject"] = subject
            msg["From"] = from_header
            msg["To"] = to_addr
            alt = MIMEMultipart("alternative")
            alt.attach(MIMEText(body_text or body_html, "plain"))
            alt.attach(MIMEText(body_html, "html"))
            msg.attach(alt)
            for cid, img_bytes in inline_images:
                if img_bytes:
                    img_part = MIMEImage(img_bytes, _subtype="png")
                    img_part.add_header("Content-ID", f"<{cid}>")
                    img_part.add_header("Content-Disposition", "inline", filename=f"{cid}.png")
                    msg.attach(img_part)
        else:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = from_header
            msg["To"] = to_addr
            msg.attach(MIMEText(body_text or body_html, "plain"))
            if body_html and body_html != (body_text or ""):
                msg.attach(MIMEText(body_html, "html"))

        with smtplib.SMTP(smtp_server, smtp_port) as server:
            if use_tls:
                server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, to_addr, msg.as_string())
        return {"success": True, "message": "Email sent via Gmail", "provider": "gmail"}
    except Exception as e:
        logger.exception("Gmail send failed")
        return {"success": False, "message": str(e), "provider": "gmail"}


def _send_email_aws_ses(
    s: Dict, to_addr: str, from_header: str, subject: str, body_html: str, body_text: Optional[str],
    inline_images: Optional[List[tuple]] = None,
) -> Dict[str, Any]:
    try:
        import boto3
    except ImportError:
        return {"success": False, "message": "boto3 not installed. pip install boto3", "provider": "aws_ses"}

    ak = s.get("aws_access_key_id")
    sk = s.get("aws_secret_access_key")
    region = s.get("aws_region") or "us-east-1"
    if not ak or not sk or sk == "***":
        return {"success": False, "message": "AWS SES: Access key and secret required", "provider": "aws_ses"}

    try:
        client = boto3.client("ses", region_name=region, aws_access_key_id=ak, aws_secret_access_key=sk)
        if inline_images:
            msg = MIMEMultipart("related")
            msg["Subject"] = subject
            msg["From"] = from_header
            msg["To"] = to_addr
            alt = MIMEMultipart("alternative")
            alt.attach(MIMEText(body_text or body_html, "plain"))
            alt.attach(MIMEText(body_html, "html"))
            msg.attach(alt)
            for cid, img_bytes in inline_images:
                if img_bytes:
                    img_part = MIMEImage(img_bytes, _subtype="png")
                    img_part.add_header("Content-ID", f"<{cid}>")
                    img_part.add_header("Content-Disposition", "inline", filename=f"{cid}.png")
                    msg.attach(img_part)
            raw = msg.as_string()
            raw_bytes = raw.encode("utf-8") if isinstance(raw, str) else raw
            client.send_raw_email(
                Source=from_header,
                Destinations=[to_addr],
                RawMessage={"Data": raw_bytes},
            )
        else:
            body = {"Html": {"Data": body_html, "Charset": "UTF-8"}}
            if body_text:
                body["Text"] = {"Data": body_text, "Charset": "UTF-8"}
            client.send_email(
                Source=from_header,
                Destination={"ToAddresses": [to_addr]},
                Message={
                    "Subject": {"Data": subject, "Charset": "UTF-8"},
                    "Body": body,
                },
            )
        return {"success": True, "message": "Email sent via AWS SES", "provider": "aws_ses"}
    except Exception as e:
        logger.exception("AWS SES send failed")
        return {"success": False, "message": str(e), "provider": "aws_ses"}


def send_sms(
    phone_number: str,
    message_text: str,
    store_id: int = 1,
    message_type: str = "manual",
    customer_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Send SMS via Email-to-SMS (Gmail) or AWS SNS.
    Returns {success: bool, message: str, provider: str, message_id: Optional[int]}.
    """
    s = _get_sms_settings(store_id)
    if not s:
        return {"success": False, "message": "No notification settings configured", "provider": None, "message_id": None}

    provider = (s.get("sms_provider") or "aws_sns").lower()
    text = (message_text or "")[:160]

    if provider == "email":
        return _send_sms_email(s, store_id, phone_number, text, message_type, customer_id)
    if provider == "aws_sns":
        return _send_sms_aws_sns(s, store_id, phone_number, text, message_type, customer_id)
    return {"success": False, "message": f"Unknown SMS provider: {provider}", "provider": provider, "message_id": None}


def _normalize_phone(phone: str) -> str:
    """Normalize to 10-digit US format."""
    digits = "".join(c for c in str(phone) if c.isdigit())
    if len(digits) == 11 and digits.startswith("1"):
        return digits[1:]
    return digits[:10] if len(digits) >= 10 else digits


def _send_sms_email(
    s: Dict, store_id: int, phone: str, text: str, message_type: str, customer_id: Optional[int]
) -> Dict[str, Any]:
    """Send via SMTP to carrier gateway (e.g. number@txt.att.net)."""
    smtp_server = s.get("smtp_server") or "smtp.gmail.com"
    smtp_port = int(s.get("smtp_port") or 587)
    smtp_user = s.get("smtp_user")
    smtp_password = s.get("smtp_password")
    use_tls = s.get("smtp_use_tls", 1)

    if not smtp_user or not smtp_password or smtp_password == "***":
        return {"success": False, "message": "Gmail: SMTP credentials required for email-to-SMS", "provider": "email", "message_id": None}

    normalized = _normalize_phone(phone)
    if len(normalized) != 10:
        return {"success": False, "message": "US 10-digit phone required for email-to-SMS", "provider": "email", "message_id": None}

    # Verizon gateway (others largely discontinued per SMS_TESTING.md)
    gateway = f"{normalized}@vtext.com"
    try:
        msg = MIMEText(text, "plain")
        msg["Subject"] = ""
        msg["From"] = smtp_user
        msg["To"] = gateway

        with smtplib.SMTP(smtp_server, smtp_port) as server:
            if use_tls:
                server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, gateway, msg.as_string())

        msg_id = _log_sms_message(store_id, phone, text, "sent", "email", customer_id)
        return {"success": True, "message": "SMS sent via email gateway", "provider": "email", "message_id": msg_id}
    except Exception as e:
        _log_sms_message(store_id, phone, text, "failed", "email", customer_id, error=str(e))
        logger.exception("Email-to-SMS failed")
        return {"success": False, "message": str(e), "provider": "email", "message_id": None}


def _send_sms_aws_sns(
    s: Dict, store_id: int, phone: str, text: str, message_type: str, customer_id: Optional[int]
) -> Dict[str, Any]:
    try:
        import boto3
    except ImportError:
        return {"success": False, "message": "boto3 not installed. pip install boto3", "provider": "aws_sns", "message_id": None}

    ak = s.get("aws_access_key_id")
    sk = s.get("aws_secret_access_key")
    region = s.get("aws_region") or "us-east-1"
    if not ak or not sk or sk == "***":
        return {"success": False, "message": "AWS SNS: Access key and secret required", "provider": "aws_sns", "message_id": None}

    normalized = _normalize_phone(phone)
    if len(normalized) < 10:
        return {"success": False, "message": "Valid phone number required", "provider": "aws_sns", "message_id": None}
    e164 = f"+1{normalized}" if len(normalized) == 10 else f"+{normalized}"

    try:
        client = boto3.client("sns", region_name=region, aws_access_key_id=ak, aws_secret_access_key=sk)
        r = client.publish(PhoneNumber=e164, Message=text)
        msg_id = _log_sms_message(store_id, phone, text, "sent", "aws_sns", customer_id, provider_sid=r.get("MessageId"))
        return {"success": True, "message": "SMS sent via AWS SNS", "provider": "aws_sns", "message_id": msg_id}
    except Exception as e:
        _log_sms_message(store_id, phone, text, "failed", "aws_sns", customer_id, error=str(e))
        logger.exception("AWS SNS send failed")
        return {"success": False, "message": str(e), "provider": "aws_sns", "message_id": None}


def _log_sms_message(
    store_id: int,
    phone: str,
    text: str,
    status: str,
    provider: str,
    customer_id: Optional[int] = None,
    provider_sid: Optional[str] = None,
    error: Optional[str] = None,
) -> Optional[int]:
    try:
        from database_postgres import get_connection
        from datetime import datetime
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO sms_messages (store_id, customer_id, phone_number, message_text, direction, status, provider, provider_sid, sent_at, error_message)
               VALUES (%s, %s, %s, %s, 'outbound', %s, %s, %s, %s, %s) RETURNING message_id""",
            (store_id, customer_id, phone, text, status, provider, provider_sid, datetime.utcnow() if status == "sent" else None, error),
        )
        row = cur.fetchone()
        conn.commit()
        conn.close()
        return row[0] if row else None
    except Exception as e:
        logger.warning("Could not log sms_message: %s", e)
        return None


def get_email_template(store_id: int, category: str) -> Optional[Dict[str, Any]]:
    """Load the default email template for a category. Falls back to first template if no default."""
    try:
        from database_postgres import get_connection
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """SELECT id, store_id, category, name, subject_template, body_html_template, body_text_template, variables
               FROM email_templates WHERE store_id = %s AND category = %s ORDER BY is_default DESC, id DESC LIMIT 1""",
            (store_id, category),
        )
        row = cur.fetchone()
        conn.close()
        if row:
            cols = ['id', 'store_id', 'category', 'name', 'subject_template', 'body_html_template', 'body_text_template', 'variables']
            return dict(zip(cols, row)) if hasattr(row, '__iter__') and not hasattr(row, 'keys') else dict(row)
    except Exception as e:
        logger.warning("get_email_template: %s", e)
    return None


def render_template(template_str: str, variables: Dict[str, Any]) -> str:
    """Replace {{variable}} placeholders. Escapes HTML for safety (use body_html with pre-escaped content)."""
    if not template_str:
        return ""
    result = template_str
    for k, v in (variables or {}).items():
        placeholder = "{{" + str(k) + "}}"
        result = result.replace(placeholder, str(v) if v is not None else "")
    return result


def build_receipt_email_html(order_data: Dict[str, Any], order_items: List[Dict], store_settings: Dict[str, Any], barcode_base64: Optional[str] = None, use_cid_barcode: bool = False, use_cid_signature: bool = False) -> tuple:
    """
    Build receipt HTML and text from order data. Returns (body_html, body_text).
    Used when no custom template exists or as fallback.
    """
    store_name = store_settings.get('store_name') or order_data.get('store_name') or 'Store'
    order_number = order_data.get('order_number', '')
    order_date = order_data.get('order_date', '')
    subtotal = order_data.get('subtotal', 0)
    tax = order_data.get('tax_amount', order_data.get('tax', 0))
    total = order_data.get('total', 0)
    footer = store_settings.get('footer_message', '') or ''

    def _fmt(x):
        try:
            return f"{float(x):.2f}"
        except (TypeError, ValueError):
            return str(x)

    items_html_parts = []
    items_text_parts = []
    for it in (order_items or []):
        name = it.get('product_name', it.get('name', ''))
        qty = it.get('quantity', 1)
        up = float(it.get('unit_price', 0) or 0)
        st = float(it.get('subtotal', qty * up) or qty * up)
        items_html_parts.append(f"<tr><td>{name} x {qty}</td><td style='text-align:right'>${_fmt(st)}</td></tr>")
        items_text_parts.append(f"{name} x {qty} ${_fmt(st)}")

    items_html = "<table style='width:100%;border-collapse:collapse'>" + "".join(items_html_parts) + "</table>"
    items_text = "\n".join(items_text_parts)

    barcode_html = ''
    if order_number and store_settings.get('show_barcode', 1):
        if use_cid_barcode and barcode_base64:
            barcode_html = f'<div style="text-align:center;margin:24px 0"><img src="cid:receiptbarcode" alt="Order barcode" style="max-width:280px;height:auto" /><div style="font-size:13px;margin-top:8px">Order # {order_number}</div></div>'
        elif barcode_base64:
            barcode_html = f'<div style="text-align:center;margin:24px 0"><img src="data:image/png;base64,{barcode_base64}" alt="Order barcode" style="max-width:280px;height:auto" /><div style="font-size:13px;margin-top:8px">Order # {order_number}</div></div>'
        else:
            barcode_html = f'<div style="text-align:center;margin:24px 0"><div style="font-size:13px">Order # {order_number}</div></div>'
    signature_html = ''
    if store_settings.get('show_signature', 1) and order_data.get('signature'):
        try:
            if use_cid_signature:
                signature_html = '<div style="margin:24px 0;text-align:center"><div style="font-size:11px;color:#666;margin-bottom:8px">Signature</div><img src="cid:receiptsignature" alt="Signature" style="max-width:200px;height:auto;border-bottom:1px solid #ddd" /></div>'
            else:
                import base64
                sig_raw = str(order_data['signature']).strip()
                if sig_raw.startswith('data:image'):
                    sig_src = sig_raw
                else:
                    decoded = base64.b64decode(sig_raw)
                    sig_src = 'data:image/png;base64,' + base64.b64encode(decoded).decode('ascii')
                signature_html = f'<div style="margin:24px 0;text-align:center"><div style="font-size:11px;color:#666;margin-bottom:8px">Signature</div><img src="{sig_src}" alt="Signature" style="max-width:200px;height:auto;border-bottom:1px solid #ddd" /></div>'
        except Exception:
            pass

    vars_ = {
        "store_name": store_name,
        "order_number": order_number,
        "order_date": order_date,
        "items_html": items_html,
        "items_text": items_text,
        "subtotal": _fmt(subtotal),
        "tax": _fmt(tax),
        "total": _fmt(total),
        "footer_message": footer,
        "barcode_html": barcode_html,
        "signature_html": signature_html,
    }
    default_html = """<div style="font-family:sans-serif;max-width:400px;margin:0 auto">
<h2 style="text-align:center">{{store_name}}</h2>
<p style="text-align:center;color:#666">Order #{{order_number}} · {{order_date}}</p>
<hr/>
<div>{{items_html}}</div>
<hr/>
<p style="text-align:right">Subtotal: ${{subtotal}}<br/>Tax: ${{tax}}<br/><strong>Total: ${{total}}</strong></p>
{{barcode_html}}
{{signature_html}}
<p style="text-align:center;font-size:12px;color:#999">{{footer_message}}</p>
</div>"""
    default_text = f"Receipt for Order {order_number}\n{store_name}\nOrder #{{order_number}} {{order_date}}\n{{items_text}}\nSubtotal: ${{subtotal}} Tax: ${{tax}} Total: ${{total}}\n{{footer_message}}"
    html_out = render_template(default_html, vars_)
    text_out = render_template(default_text, vars_)
    return (html_out, text_out)


def send_order_notification(store_id: int, order_info: Dict, emails: List[str], phones: List[str]) -> Dict[str, List[Dict]]:
    """Send order notifications (email + SMS) if enabled. Uses email template when available."""
    results = {"email": [], "sms": []}
    if not should_send(store_id, "orders", "email") and not should_send(store_id, "orders", "sms"):
        return results

    subj = f"New Order #{order_info.get('order_number', order_info.get('order_id', '?'))}"
    body = f"Order received: {order_info.get('order_number', '')} Total: ${order_info.get('total', '0')}"
    body_html = f"<p>{body}</p>"
    order_logo_png = None

    tpl = get_email_template(store_id, "order")
    if tpl:
        store_settings = _get_store_settings(store_id)
        vars_ = _build_store_header_vars(store_settings)
        _merge_order_design_into_vars(vars_, tpl)
        order_source = (order_info.get('order_source') or '').strip().lower()
        logo_html = order_info.get('order_source_logo_html', '')
        order_logo_png = None
        if not logo_html and order_source and order_source in _EMAIL_LOGO_FILES:
            order_logo_png = _get_email_logo_png_bytes(order_source)
            if order_logo_png:
                alt = order_source.replace("_", " ").title()
                logo_html = f'<img src="cid:{_EMAIL_LOGO_CID}" alt="{alt}" style="height:40px;width:auto;vertical-align:middle" />'
        vars_.update({
            "order_number": order_info.get('order_number', order_info.get('order_id', '?')),
            "total": str(order_info.get('total', '0')),
            "subtotal": str(order_info.get('subtotal', order_info.get('total', '0'))),
            "tax": str(order_info.get('tax', '0')),
            "tip": str(order_info.get('tip', '0')),
            "items_html": order_info.get('items_html', ''),
            "barcode_html": order_info.get('barcode_html', ''),
            "order_url": order_info.get('order_url', '#'),
            "order_source_logo_html": logo_html,
            "order_details_html": order_info.get('order_details_html', ''),
        })
        subj = render_template(tpl.get('subject_template', ''), vars_) or subj
        body_html = render_template(tpl.get('body_html_template', ''), vars_) or body_html
        body = render_template(tpl.get('body_text_template', ''), vars_) or body

    inline_images = None
    if order_logo_png:
        inline_images = [(_EMAIL_LOGO_CID, order_logo_png)]
    if should_send(store_id, "orders", "email") and emails:
        for addr in emails:
            r = send_email(addr, subj, body_html, body, store_id, inline_images=inline_images)
            results["email"].append({"to": addr, **r})
    if should_send(store_id, "orders", "sms") and phones:
        for p in phones:
            r = send_sms(p, body[:160], store_id, "order")
            results["sms"].append({"to": p, **r})
    return results


def _get_store_settings(store_id: int = 1) -> Dict[str, Any]:
    """Load store location + receipt settings for template variables. Same sources as receipt."""
    out = {}
    try:
        from database import get_store_location_settings
        s = get_store_location_settings() or {}
        if s:
            out.update(dict(s))
            out['store_name'] = out.get('store_name') or out.get('address', '') or 'Store'
            if out.get('address'):
                out['store_address'] = out['address']
    except Exception as e:
        logger.warning("_get_store_settings: %s", e)
    try:
        from receipt_generator import get_receipt_settings
        rs = get_receipt_settings() or {}
        if rs:
            out['footer_message'] = rs.get('footer_message', '') or out.get('footer_message', '')
            out.setdefault('store_name', rs.get('store_name', 'Store'))
            out.setdefault('store_tagline', rs.get('store_tagline', ''))
            out.setdefault('store_phone', rs.get('store_phone', ''))
            out.setdefault('store_city', rs.get('store_city', '') or out.get('city', ''))
            out.setdefault('store_state', rs.get('store_state', '') or out.get('state', ''))
            out.setdefault('store_zip', rs.get('store_zip', '') or out.get('zip', ''))
            out.setdefault('store_email', rs.get('store_email', ''))
            out.setdefault('store_website', rs.get('store_website', ''))
            out.setdefault('return_policy', rs.get('return_policy', ''))
            out.setdefault('show_signature', 1 if rs.get('show_signature', 1) else 0)
            ts = rs.get('template_styles') or {}
            out.setdefault('show_barcode', 1 if ts.get('show_barcode', True) is not False else 0)
    except Exception:
        pass
    # Build full formatted address (same as receipt) from address + city + state + zip
    addr = out.get('address', '') or out.get('store_address', '')
    city = out.get('store_city', '') or out.get('city', '')
    state = out.get('store_state', '') or out.get('state', '')
    zip_ = out.get('store_zip', '') or out.get('zip', '')
    full_addr = ' '.join(x for x in [addr, city, state, zip_] if x).strip()
    if full_addr:
        out['store_address'] = full_addr
    # Formatted phone (same as receipt)
    store_phone_raw = out.get('store_phone', '')
    out['formatted_store_phone'] = _format_phone(store_phone_raw) if store_phone_raw else store_phone_raw
    return out


def send_receipt_email(store_id: int, to_address: str, subject: str, body_html: str, body_text: Optional[str] = None, inline_images: Optional[List[tuple]] = None) -> Dict[str, Any]:
    """Send receipt email if receipts email is enabled. inline_images: [(cid, png_bytes), ...] for barcode/signature."""
    if not should_send(store_id, "receipts", "email"):
        return {"success": False, "message": "Receipts email disabled", "provider": None}
    return send_email(to_address, subject, body_html, body_text, store_id, inline_images=inline_images)


def send_receipt_email_for_order(
    store_id: int, order_id: int, to_address: str,
    order_data: Optional[Dict] = None, order_items: Optional[List[Dict]] = None,
    transaction_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Build receipt email from template (or default) and send. If order_data/order_items not provided,
    fetches from DB. Use when customer opts for email receipt after payment.
    transaction_id: When provided, used to fetch signature directly (more reliable than order_id).
    """
    if not should_send(store_id, "receipts", "email"):
        return {"success": False, "message": "Receipts email disabled", "provider": None}

    barcode_base64 = None
    if order_data is None or order_items is None:
        # Use same backend as printed receipts (/api/receipt/transaction, /api/receipt/<order_id>)
        from receipt_generator import get_receipt_data_for_email
        rd = get_receipt_data_for_email(transaction_id=transaction_id, order_id=order_id)
        if rd is None:
            return {"success": False, "message": "Order not found", "provider": None}
        order_data = rd['order_data']
        order_items = rd['order_items']
        barcode_base64 = rd.get('barcode_base64', '')
        # order_data already has signature from receipt_generator

    store_settings = _get_store_settings(store_id)
    inline_images = []
    use_cid_barcode = bool(barcode_base64)
    use_cid_signature = False
    if barcode_base64:
        try:
            import base64
            inline_images.append(('receiptbarcode', base64.b64decode(barcode_base64)))
        except Exception:
            use_cid_barcode = False
    sig = order_data.get('signature')
    if sig and store_settings.get('show_signature', 1):
        try:
            import base64
            sig_raw = str(sig).strip()
            if sig_raw.startswith('data:image'):
                b64_part = sig_raw.split(',', 1)[-1] if ',' in sig_raw else ''
            else:
                b64_part = sig_raw
            if b64_part:
                inline_images.append(('receiptsignature', base64.b64decode(b64_part)))
                use_cid_signature = True
        except Exception:
            pass

    tpl = get_email_template(store_id, "receipt")
    if tpl:
        vars_ = _build_receipt_variables(order_data, order_items, store_settings, barcode_base64=barcode_base64, use_cid_barcode=use_cid_barcode, use_cid_signature=use_cid_signature)
        subj = render_template(tpl.get('subject_template', ''), vars_)
        body_html = render_template(tpl.get('body_html_template', ''), vars_)
        body_text = render_template(tpl.get('body_text_template', '') or '', vars_)
    else:
        body_html, body_text = build_receipt_email_html(order_data, order_items, store_settings, barcode_base64=barcode_base64, use_cid_barcode=use_cid_barcode, use_cid_signature=use_cid_signature)
        subj = f"Receipt for Order {order_data.get('order_number', order_id)}"

    return send_receipt_email(store_id, to_address, subj, body_html, body_text, inline_images=inline_images if inline_images else None)


def _format_phone(phone: str) -> str:
    """Format phone number for display, e.g. (555) 123-4567 or +1 (555) 123-4567."""
    if not phone or not isinstance(phone, str):
        return ''
    digits = ''.join(c for c in phone if c.isdigit())
    if len(digits) == 10:
        return f"({digits[0:3]}) {digits[3:6]}-{digits[6:]}"
    if len(digits) == 11 and digits[0] == '1':
        return f"+1 ({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
    if len(digits) >= 10:
        return f"({digits[-10:-7]}) {digits[-7:-4]}-{digits[-4:]}"
    return phone.strip()


def _build_store_header_vars(store_settings: Dict[str, Any]) -> Dict[str, Any]:
    """Build header/footer variables from receipt settings + store location (same as receipt)."""
    return {
        "store_name": store_settings.get('store_name', 'Store'),
        "store_tagline": store_settings.get('store_tagline', ''),
        "store_address": store_settings.get('store_address', ''),
        "store_phone": store_settings.get('store_phone', ''),
        "formatted_store_phone": store_settings.get('formatted_store_phone', '') or store_settings.get('store_phone', ''),
        "store_email": store_settings.get('store_email', ''),
        "store_website": store_settings.get('store_website', ''),
        "footer_message": store_settings.get('footer_message', 'Thank you for your business!'),
    }


def _merge_order_design_into_vars(vars_: Dict[str, Any], template: Optional[Dict]) -> None:
    """Merge template variables.orderDesign into vars_ (modifies in place). Used for order, schedule, clockin, report."""
    if not template:
        return
    design = (template.get('variables') or {}).get('orderDesign')
    if not design or not isinstance(design, dict):
        return
    for k in ('store_name', 'store_tagline', 'store_address', 'store_phone', 'store_email', 'footer_message'):
        if k in design:
            vars_[k] = str(design[k]) if design[k] is not None else ''
    if 'store_phone' in design and design.get('store_phone'):
        vars_['formatted_store_phone'] = _format_phone(str(design['store_phone']))


def _build_receipt_variables(order_data: Dict, order_items: List[Dict], store_settings: Dict, barcode_base64: Optional[str] = None, use_cid_barcode: bool = False, use_cid_signature: bool = False) -> Dict:
    def _fmt(x):
        try:
            return f"{float(x):.2f}"
        except (TypeError, ValueError):
            return str(x)

    store_name = store_settings.get('store_name') or order_data.get('store_name') or 'Store'
    order_date_raw = order_data.get('order_date', '')
    order_date_str = str(order_date_raw) if order_date_raw else ''
    # Parse date/time for formatted output
    receipt_date = order_date_str
    receipt_time = ''
    try:
        from datetime import datetime
        if order_date_raw:
            if hasattr(order_date_raw, 'strftime'):
                dt = order_date_raw
            else:
                dt = datetime.fromisoformat(str(order_date_raw).replace('Z', '+00:00'))
                dt = dt.replace(tzinfo=None) if dt.tzinfo else dt
            receipt_date = dt.strftime('%B %d, %Y')
            t = dt.strftime('%I:%M %p')
            receipt_time = t[1:] if len(t) > 0 and t[0] == '0' else t
    except (ValueError, TypeError):
        pass

    addr = store_settings.get('address', '') or store_settings.get('store_address', '')
    city = store_settings.get('store_city', '') or store_settings.get('city', '')
    state = store_settings.get('store_state', '') or store_settings.get('state', '')
    zip_ = store_settings.get('store_zip', '') or store_settings.get('zip', '')
    location = ' '.join(x for x in [addr, city, state, zip_] if x).strip() or store_name

    # Receipt type support (exchange, return, store credit)
    is_return_receipt = bool(order_data.get('is_return_receipt'))
    is_store_credit_receipt = bool(order_data.get('is_store_credit_receipt'))
    is_exchange_completion = bool(order_data.get('is_exchange_completion'))
    if is_exchange_completion:
        receipt_type_label = 'Exchange'
    elif is_store_credit_receipt:
        receipt_type_label = 'Store Credit Receipt'
    elif is_return_receipt:
        receipt_type_label = 'Return Receipt'
    else:
        receipt_type_label = 'Receipt'

    # Totals labels for different receipt types (matches receipt_generator)
    if is_store_credit_receipt:
        subtotal_label, tax_label, total_label = 'Store Credit Subtotal', 'Store Credit Tax', 'Total Store Credit'
    elif is_return_receipt and not is_exchange_completion:
        subtotal_label, tax_label, total_label = 'Return Subtotal', 'Return Tax', 'Refund Amount'
    else:
        subtotal_label, tax_label, total_label = 'Subtotal', 'Tax', 'Total'

    items_html_parts = []
    items_text_parts = []
    for it in (order_items or []):
        name = it.get('product_name', it.get('name', ''))
        desc = it.get('notes', it.get('description', '')) or ''
        qty = int(it.get('quantity', 1) or 1)
        up = float(it.get('unit_price', 0) or 0)
        st = float(it.get('subtotal', qty * up) or qty * up)
        # Item line: "Name x 2 @ $5.00" or "Name" for qty 1
        if qty != 1:
            item_line = f"{name} x {qty} @ ${_fmt(up)}"
        else:
            item_line = f"{name} @ ${_fmt(up)}"
        desc_html = f'<div class="item-description">{desc}</div>' if desc else ''
        items_html_parts.append(
            f"<tr><td><div class=\"item-name\">{item_line}</div>{desc_html}</td>"
            f"<td>${_fmt(st)}</td></tr>"
        )
        items_text_parts.append(f"{item_line} ${_fmt(st)}")

    subtotal_val = float(order_data.get('subtotal', 0) or 0)
    tax_val = float(order_data.get('tax_amount', order_data.get('tax', 0)) or 0)
    tip_val = order_data.get('tip', 0)
    tip_str = _fmt(tip_val) if tip_val else '0.00'
    discount_val = float(order_data.get('discount', 0) or 0)
    transaction_fee_val = float(order_data.get('transaction_fee', 0) or 0)
    total_val = float(order_data.get('total', 0) or 0)

    # Payment method: align with receipt_generator (lines 676-722)
    payment_status = (order_data.get('payment_status') or 'completed').lower()
    order_type_payment = (order_data.get('order_type') or '').lower()
    payment_method_raw = (order_data.get('payment_method') or 'Unknown').strip().lower()
    payment_method_type = (order_data.get('payment_method_type') or payment_method_raw or '').lower()
    is_cash = payment_method_type == 'cash' or 'cash' in payment_method_raw

    if payment_status == 'pending':
        if order_type_payment == 'delivery':
            not_paid_phrase = 'Pay at delivery'
        elif order_type_payment == 'pickup':
            not_paid_phrase = 'Pay at pickup'
        else:
            not_paid_phrase = 'Pay at counter'
        payment_display = f'Not paid - {not_paid_phrase}'
        payment_extra_lines = ''
    else:
        if is_cash:
            payment_display = 'Paid with Cash'
        elif 'card' in payment_method_raw or payment_method_raw in ('credit_card', 'debit_card', 'credit', 'debit'):
            payment_display = 'Paid by Card'
        elif 'store_credit' in payment_method_raw or 'store credit' in payment_method_raw:
            payment_display = 'Paid with Store Credit'
        elif 'check' in payment_method_raw:
            payment_display = 'Paid by Check'
        elif 'mobile' in payment_method_raw or 'apple' in payment_method_raw or 'google' in payment_method_raw:
            payment_display = 'Paid by Mobile'
        else:
            pm_title = (order_data.get('payment_method') or 'Unknown').replace('_', ' ').title()
            payment_display = f'Payment: {pm_title}' if pm_title and pm_title != 'Unknown' else 'Paid by Card'

        amount_paid = order_data.get('amount_paid')
        change = order_data.get('change', 0)
        payment_extra_lines = ''
        if amount_paid and is_cash:
            payment_extra_lines = f'<div class="payment-value">Amount Paid: ${float(amount_paid):.2f}</div>'
            if change and float(change) > 0:
                payment_extra_lines += f'<div class="payment-value">Change: ${float(change):.2f}</div>'

    store_phone_raw = store_settings.get('store_phone', '')
    formatted_store_phone = _format_phone(store_phone_raw) if store_phone_raw else store_phone_raw
    footer = store_settings.get('footer_message', '') or 'Thank you for your business!'

    # Order barcode and order number - use cid: for email (many clients block data URLs)
    order_number = order_data.get('order_number', '')
    barcode_img = ''
    show_barcode = store_settings.get('show_barcode', 1)
    if show_barcode and order_number:
        if use_cid_barcode and barcode_base64:
            barcode_img = '<img src="cid:receiptbarcode" alt="Order barcode" style="max-width:280px;height:auto" />'
        elif barcode_base64:
            barcode_img = f'<img src="data:image/png;base64,{barcode_base64}" alt="Order barcode" style="max-width:280px;height:auto" />'
        else:
            import base64
            try:
                from receipt_generator import generate_barcode_data
                barcode_bytes = generate_barcode_data(order_number)
                if barcode_bytes and len(barcode_bytes) > 0:
                    b64 = base64.b64encode(barcode_bytes).decode('ascii')
                    barcode_img = f'<img src="data:image/png;base64,{b64}" alt="Order barcode" style="max-width:280px;height:auto" />'
            except Exception as e:
                logger.warning("Barcode generation for email (Code128): %s", e)
            if not barcode_img:
                try:
                    import qrcode
                    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=4, border=2)
                    qr.add_data(order_number)
                    qr.make(fit=True)
                    img = qr.make_image(fill_color="black", back_color="white")
                    buf = io.BytesIO()
                    img.save(buf, format='PNG')
                    buf.seek(0)
                    b64 = base64.b64encode(buf.getvalue()).decode('ascii')
                    barcode_img = f'<img src="data:image/png;base64,{b64}" alt="Order barcode" style="max-width:180px;height:auto" />'
                except Exception as qr_err:
                    logger.warning("QR fallback for email barcode: %s", qr_err)
    # Always show barcode section with order number (barcode image when available)
    barcode_html = ''
    if order_number:
        barcode_html = f'<div class="barcode-section" style="text-align:center;margin:24px 0">{barcode_img}<div style="font-size:13px;font-weight:600;color:#2c2c2c;margin-top:8px;letter-spacing:1px">Order # {order_number}</div></div>'

    # Signature (optional) - use cid: for email when use_cid
    signature_html = ''
    show_signature = store_settings.get('show_signature', 1)
    signature = order_data.get('signature')
    if show_signature and signature:
        try:
            import base64
            sig_raw = str(signature).strip()
            if use_cid_signature:
                signature_html = '<div class="signature-section" style="margin:24px 0;text-align:center"><div style="font-size:11px;color:#666;margin-bottom:8px;letter-spacing:1px">Signature</div><img src="cid:receiptsignature" alt="Signature" style="max-width:200px;height:auto;border-bottom:1px solid #ddd;padding-bottom:4px" /></div>'
            else:
                if sig_raw.startswith('data:image'):
                    sig_src = sig_raw
                else:
                    decoded = base64.b64decode(sig_raw)
                    sig_src = 'data:image/png;base64,' + base64.b64encode(decoded).decode('ascii')
                signature_html = f'<div class="signature-section" style="margin:24px 0;text-align:center"><div style="font-size:11px;color:#666;margin-bottom:8px;letter-spacing:1px">Signature</div><img src="{sig_src}" alt="Signature" style="max-width:200px;height:auto;border-bottom:1px solid #ddd;padding-bottom:4px" /></div>'
        except Exception as e:
            logger.debug("Signature for email: %s", e)

    # Optional customer info block (for pickup/delivery)
    customer_parts = []
    cname = order_data.get('customer_name') or order_data.get('profile_customer_name', '')
    cphone = order_data.get('customer_phone', '')
    caddr = order_data.get('customer_address', '')
    if cname:
        customer_parts.append(f'<div class="receipt-info-row"><div class="label">Customer</div><div class="value">{cname}</div></div>')
    if cphone:
        customer_parts.append(f'<div class="receipt-info-row"><div class="label">Phone</div><div class="value">{cphone}</div></div>')
    if caddr:
        customer_parts.append(f'<div class="receipt-info-row"><div class="label">Address</div><div class="value">{caddr}</div></div>')
    customer_info_html = ''.join(customer_parts)

    return {
        "store_name": store_name,
        "store_tagline": store_settings.get('store_tagline', ''),
        "store_address": location,
        "store_city": city,
        "store_state": state,
        "store_zip": zip_,
        "store_phone": store_phone_raw,
        "formatted_store_phone": formatted_store_phone or store_phone_raw,
        "store_email": store_settings.get('store_email', ''),
        "store_website": store_settings.get('store_website', ''),
        "return_policy": store_settings.get('return_policy', ''),
        "footer_message": footer,
        "order_number": order_data.get('order_number', ''),
        "order_date": order_date_str,
        "order_type": order_data.get('order_type', ''),
        "receipt_date": receipt_date,
        "receipt_time": receipt_time,
        "receipt_type_label": receipt_type_label,
        "is_return_receipt": is_return_receipt,
        "is_store_credit_receipt": is_store_credit_receipt,
        "is_exchange_completion": is_exchange_completion,
        "location": location,
        "employee_name": order_data.get('employee_name', ''),
        "customer_name": order_data.get('customer_name') or order_data.get('profile_customer_name', ''),
        "customer_phone": order_data.get('customer_phone', ''),
        "customer_address": order_data.get('customer_address', ''),
        "items_html": "".join(items_html_parts),
        "items_text": "\n".join(items_text_parts),
        "subtotal": _fmt(subtotal_val),
        "subtotal_label": subtotal_label,
        "tax": _fmt(tax_val),
        "tax_label": tax_label,
        "tip": tip_str,
        "discount": _fmt(discount_val),
        "transaction_fee": _fmt(transaction_fee_val),
        "total": _fmt(total_val),
        "total_label": total_label,
        "payment_method": payment_display,
        "payment_extra_lines": payment_extra_lines,
        "payment_status": payment_status,
        "amount_paid": _fmt(order_data.get('amount_paid', 0)) if order_data.get('amount_paid') else '',
        "change": _fmt(order_data.get('change', 0)) if order_data.get('change') else '',
        "barcode_html": barcode_html,
        "signature_html": signature_html,
        "discount_row": f'<div class="total-row discount"><span>Discount</span><span>-${_fmt(discount_val)}</span></div>' if discount_val > 0 else '',
        "discount_line": f"Discount: -${_fmt(discount_val)}\n" if discount_val > 0 else "",
        "transaction_fee_row": f'<div class="total-row transaction-fee"><span>Processing Fee</span><span>${_fmt(transaction_fee_val)}</span></div>' if transaction_fee_val > 0 else '',
        "processing_fee": _fmt(transaction_fee_val),
        "transaction_fee_line": f"Processing Fee: ${_fmt(transaction_fee_val)}\n" if transaction_fee_val > 0 else "",
        "customer_info_html": customer_info_html,
    }


def _fetch_order_for_receipt(order_id: int, transaction_id: Optional[int] = None) -> tuple:
    """Fetch order and items for receipt. Returns (order_data, order_items) or (None, None).
    When transaction_id is provided, fetches signature by transaction_id for reliable lookup."""
    try:
        from database_postgres import get_connection
        from psycopg2.extras import RealDictCursor
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """SELECT o.*, e.first_name || ' ' || e.last_name as employee_name,
                      c.customer_name AS profile_customer_name,
                      c.phone AS profile_customer_phone
               FROM orders o
               LEFT JOIN employees e ON o.employee_id = e.employee_id
               LEFT JOIN customers c ON o.customer_id = c.customer_id
               WHERE o.order_id = %s""",
            (order_id,),
        )
        row = cur.fetchone()
        if not row:
            conn.close()
            return (None, None)
        order_data = dict(row)
        # Enrich customer fields from profile when order snapshot is empty
        if not order_data.get('customer_name') and order_data.get('profile_customer_name'):
            order_data['customer_name'] = order_data['profile_customer_name']
        if not order_data.get('customer_phone') and order_data.get('profile_customer_phone'):
            order_data['customer_phone'] = order_data['profile_customer_phone']
        cur.execute(
            """SELECT oi.*, i.product_name, i.sku FROM order_items oi
               LEFT JOIN inventory i ON oi.product_id = i.product_id
               WHERE oi.order_id = %s ORDER BY oi.order_item_id""",
            (order_id,),
        )
        order_items = [dict(r) for r in cur.fetchall()]
        # Fetch signature from transactions (customer display / checkout flow)
        try:
            if transaction_id:
                cur.execute(
                    """SELECT signature FROM public.transactions
                       WHERE transaction_id = %s AND signature IS NOT NULL AND TRIM(signature) != ''""",
                    (transaction_id,),
                )
            else:
                cur.execute(
                    """SELECT signature FROM public.transactions
                       WHERE order_id = %s AND signature IS NOT NULL AND TRIM(signature) != ''
                       ORDER BY transaction_id DESC LIMIT 1""",
                    (order_id,),
                )
            sig_row = cur.fetchone()
            if sig_row:
                sig_val = sig_row.get('signature') if isinstance(sig_row, dict) else sig_row[0]
                if sig_val and str(sig_val).strip():
                    order_data['signature'] = sig_val
        except Exception as sig_err:
            logger.debug("Fetch signature for order %s: %s", order_id, sig_err)
        conn.close()
        return (order_data, order_items)
    except Exception as e:
        logger.warning("_fetch_order_for_receipt: %s", e)
        return (None, None)


def send_schedule_notification(store_id: int, employee_emails: List[str], employee_phones: List[str], message: str) -> Dict[str, List[Dict]]:
    """Send schedule notifications if enabled. Uses email template when available."""
    results = {"email": [], "sms": []}
    if not should_send(store_id, "scheduling", "email") and not should_send(store_id, "scheduling", "sms"):
        return results

    subj = "Schedule Updated"
    body_html = f"<p>{message}</p>"
    body = message
    tpl = get_email_template(store_id, "schedule")
    if tpl:
        store_settings = _get_store_settings(store_id)
        vars_ = _build_store_header_vars(store_settings)
        _merge_order_design_into_vars(vars_, tpl)
        vars_["message"] = message
        subj = render_template(tpl.get('subject_template', ''), vars_) or subj
        body_html = render_template(tpl.get('body_html_template', ''), vars_) or body_html
        body = render_template(tpl.get('body_text_template', ''), vars_) or body

    if should_send(store_id, "scheduling", "email") and employee_emails:
        for addr in employee_emails:
            r = send_email(addr, subj, body_html, body, store_id)
            results["email"].append({"to": addr, **r})
    if should_send(store_id, "scheduling", "sms") and employee_phones:
        for p in employee_phones:
            r = send_sms(p, message[:160], store_id, "schedule")
            results["sms"].append({"to": p, **r})
    return results


def send_clock_in_notification(store_id: int, employee_email: Optional[str], employee_phone: Optional[str], action: str, employee_name: str) -> Dict[str, List[Dict]]:
    """Send clock-in/out notification if enabled. Uses email template when available."""
    results = {"email": [], "sms": []}
    if not should_send(store_id, "clockins", "email") and not should_send(store_id, "clockins", "sms"):
        return results

    msg = f"{employee_name} {action}"
    subj = f"Clock {action}"
    body_html = f"<p>{msg}</p>"
    tpl = get_email_template(store_id, "clockin")
    if tpl:
        store_settings = _get_store_settings(store_id)
        vars_ = _build_store_header_vars(store_settings)
        _merge_order_design_into_vars(vars_, tpl)
        vars_.update({"employee_name": employee_name, "action": action})
        subj = render_template(tpl.get('subject_template', ''), vars_) or subj
        body_html = render_template(tpl.get('body_html_template', ''), vars_) or body_html
        msg = render_template(tpl.get('body_text_template', ''), vars_) or msg

    if should_send(store_id, "clockins", "email") and employee_email:
        r = send_email(employee_email, subj, body_html, msg, store_id)
        results["email"].append({"to": employee_email, **r})
    if should_send(store_id, "clockins", "sms") and employee_phone:
        r = send_sms(employee_phone, msg[:160], store_id, "clockin")
        results["sms"].append({"to": employee_phone, **r})
    return results


def send_report_notification(store_id: int, to_emails: List[str], subject: str, body_html: str, body_text: Optional[str] = None) -> Dict[str, List[Dict]]:
    """Send report notification if enabled. Uses report template to wrap subject when available."""
    results = {"email": []}
    if not should_send(store_id, "reports", "email") or not to_emails:
        return results
    tpl = get_email_template(store_id, "report")
    if tpl:
        store_settings = _get_store_settings(store_id)
        vars_ = _build_store_header_vars(store_settings)
        _merge_order_design_into_vars(vars_, tpl)
        vars_.update({"report_name": subject, "report_date": ""})
        from datetime import date
        vars_["report_date"] = str(date.today())
        subj_rendered = render_template(tpl.get('subject_template', ''), vars_)
        if subj_rendered:
            subject = subj_rendered
    for addr in to_emails:
        r = send_email(addr, subject, body_html, body_text, store_id)
        results["email"].append({"to": addr, **r})
    return results
