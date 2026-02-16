-- Update default receipt template to premium design
-- Run after update_email_templates_marketing_style.sql

UPDATE email_templates SET
  name = 'Receipt (Premium)',
  subject_template = 'Your receipt – Order #{{order_number}}',
  body_html_template = '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receipt</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;background:#f8fafc;color:#1e293b;-webkit-font-smoothing:antialiased;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%);padding:40px 20px;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.08),0 2px 8px rgba(0,0,0,.04);border:1px solid rgba(0,0,0,.06);">
<tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#334155 100%);padding:32px 40px;text-align:center;">
<div style="display:inline-block;background:rgba(255,255,255,.12);color:#fff;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;padding:6px 14px;border-radius:20px;margin-bottom:16px;">Receipt</div>
<h1 style="margin:0;font-size:26px;font-weight:700;color:#fff;letter-spacing:-0.5px;">{{store_name}}</h1>
<p style="margin:12px 0 0;font-size:15px;color:rgba(255,255,255,.85);">Order #{{order_number}}</p>
<p style="margin:4px 0 0;font-size:14px;color:rgba(255,255,255,.7);">{{order_date}}</p>
</td></tr>
<tr><td style="padding:36px 40px;">
<div style="margin-bottom:16px;"><span style="display:inline-block;font-weight:600;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;">Order items</span></div>
{{items_html}}
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:28px;padding-top:24px;border-top:1px solid #e2e8f0;font-size:15px;">
<tr><td style="padding:6px 0;color:#64748b;">Subtotal</td><td align="right" style="padding:6px 0;color:#334155;">${{subtotal}}</td></tr>
<tr><td style="padding:6px 0;color:#64748b;">Tax</td><td align="right" style="padding:6px 0;color:#334155;">${{tax}}</td></tr>
<tr><td style="padding:16px 0 0;font-weight:700;font-size:18px;color:#0f172a;">Total</td><td align="right" style="padding:16px 0 0;font-weight:700;font-size:18px;color:#0f172a;">${{total}}</td></tr>
</table>
</td></tr>
<tr><td style="padding:28px 40px;background:#f8fafc;text-align:center;font-size:14px;color:#64748b;line-height:1.6;border-top:1px solid #e2e8f0;">{{footer_message}}</td></tr>
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
