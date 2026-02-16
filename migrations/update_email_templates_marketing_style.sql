-- Update default email templates to marketing-style designs (containers, headers, footers, professional layout)

UPDATE email_templates SET
  name = 'Receipt (Marketing)',
  subject_template = 'Your receipt – Order #{{order_number}}',
  body_html_template = '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;background:#f4f4f5;color:#1f2937;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1);">
<tr><td style="background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);padding:24px 32px;text-align:center;">
<h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">{{store_name}}</h1>
<p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,.9);">Order #{{order_number}} · {{order_date}}</p>
</td></tr>
<tr><td style="padding:32px;">
{{items_html}}
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:15px;">
<tr><td style="padding:4px 0;">Subtotal</td><td align="right" style="padding:4px 0;">${{subtotal}}</td></tr>
<tr><td style="padding:4px 0;">Tax</td><td align="right" style="padding:4px 0;">${{tax}}</td></tr>
<tr><td style="padding:12px 0 0;font-weight:700;font-size:17px;">Total</td><td align="right" style="padding:12px 0 0;font-weight:700;font-size:17px;">${{total}}</td></tr>
</table>
</td></tr>
<tr><td style="padding:20px 32px;background:#f9fafb;text-align:center;font-size:13px;color:#6b7280;">{{footer_message}}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>',
  body_text_template = '{{store_name}}
Order #{{order_number}} · {{order_date}}

{{items_text}}

Subtotal: ${{subtotal}}
Tax: ${{tax}}
Total: ${{total}}

{{footer_message}}'
WHERE category = 'receipt' AND is_default = 1;

UPDATE email_templates SET
  name = 'Order Alert (Marketing)',
  subject_template = 'New order #{{order_number}} – ${{total}}',
  body_html_template = '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;background:#f4f4f5;color:#1f2937;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,.1);">
<tr><td style="background:linear-gradient(135deg,#059669 0%,#047857 100%);padding:24px 32px;">
<h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;">New order received</h1>
</td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 16px;font-size:16px;">Order <strong>#{{order_number}}</strong></p>
<p style="margin:0 0 8px;font-size:15px;color:#6b7280;">Total: <strong style="color:#1f2937;">${{total}}</strong></p>
<p style="margin:24px 0 0;font-size:14px;color:#9ca3af;">{{store_name}}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>'
WHERE category = 'order' AND is_default = 1;

UPDATE email_templates SET
  name = 'Schedule (Marketing)',
  body_html_template = '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;background:#f4f4f5;color:#1f2937;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,.1);">
<tr><td style="background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);padding:24px 32px;">
<h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;">Schedule updated</h1>
</td></tr>
<tr><td style="padding:32px;">
<p style="margin:0;font-size:16px;line-height:1.6;">{{message}}</p>
<p style="margin:24px 0 0;font-size:14px;color:#9ca3af;">{{store_name}}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>'
WHERE category = 'schedule' AND is_default = 1;
