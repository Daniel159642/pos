/** La Maison receipt template – elegant serif style for email receipts */
export const LA_MAISON_RECEIPT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light only">
    <meta name="supported-color-schemes" content="light">
    <title>Receipt</title>
    <style>
        :root { color-scheme: light only; }
        html, body { color-scheme: light only; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Georgia', 'Times New Roman', serif; background-color: #ffffff; color: #2c2c2c; line-height: 1.8; }
        .email-container { max-width: 650px; margin: 0 auto; background-color: #ffffff; }
        .header { text-align: center; padding: 50px 40px 40px; border-bottom: 2px solid #2c2c2c; }
        .logo { font-size: 32px; font-weight: 300; letter-spacing: 4px; color: #2c2c2c; margin-bottom: 8px; text-transform: uppercase; }
        .tagline { font-size: 12px; color: #666; letter-spacing: 2px; text-transform: uppercase; }
        .content { padding: 50px 40px; }
        .receipt-title { text-align: center; font-size: 14px; letter-spacing: 3px; text-transform: uppercase; color: #666; margin-bottom: 40px; font-family: Arial, sans-serif; }
        .receipt-info { display: table; width: 100%; margin-bottom: 50px; font-family: Arial, sans-serif; font-size: 13px; }
        .receipt-info-row { display: table-row; }
        .receipt-info-row > div { display: table-cell; padding: 8px 0; }
        .label { color: #666; text-transform: uppercase; letter-spacing: 1px; font-size: 11px; width: 180px; }
        .value { color: #2c2c2c; text-align: right; }
        .divider { height: 1px; background-color: #e0e0e0; margin: 40px 0; }
        .items-section h2 { font-size: 12px; font-weight: 400; letter-spacing: 2px; text-transform: uppercase; color: #666; margin-bottom: 25px; font-family: Arial, sans-serif; }
        .items-table { width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 13px; }
        .items-table thead { border-bottom: 1px solid #2c2c2c; }
        .items-table th { text-align: left; padding: 12px 0; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #666; font-weight: 400; }
        .items-table th:last-child { text-align: right; }
        .items-table td { padding: 18px 0; border-bottom: 1px solid #e0e0e0; color: #2c2c2c; }
        .items-table td:last-child { text-align: right; }
        .item-name { font-weight: 400; margin-bottom: 4px; }
        .item-description { font-size: 12px; color: #888; font-style: italic; }
        .totals-section { margin-top: 30px; font-family: Arial, sans-serif; }
        .totals-table { width: 100%; max-width: 300px; margin-left: auto; }
        .total-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 13px; }
        .total-row.subtotal, .total-row.tax, .total-row.tip { color: #666; }
        .total-row.grand-total { border-top: 2px solid #2c2c2c; padding-top: 18px; margin-top: 8px; font-size: 16px; font-weight: 600; color: #2c2c2c; }
        .payment-section { margin-top: 50px; text-align: center; font-family: Arial, sans-serif; }
        .payment-label { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #666; margin-bottom: 8px; }
        .payment-value { font-size: 13px; color: #2c2c2c; }
        .footer { border-top: 1px solid #e0e0e0; padding: 40px 40px 50px; text-align: center; }
        .footer-content { font-family: Arial, sans-serif; font-size: 11px; color: #888; line-height: 2; letter-spacing: 0.5px; }
        .footer-content p { margin-bottom: 8px; }
        .footer-content a { color: #2c2c2c; text-decoration: none; border-bottom: 1px solid #2c2c2c; }
        .footer-address { margin-top: 30px; font-size: 11px; color: #aaa; letter-spacing: 1px; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">{{store_name}}</div>
            <div class="tagline">{{store_tagline}}</div>
        </div>
        <div class="content">
            <div class="receipt-title">Receipt</div>
            <div class="receipt-info">
                <div class="receipt-info-row"><div class="label">Receipt Number</div><div class="value">{{order_number}}</div></div>
                <div class="receipt-info-row"><div class="label">Date</div><div class="value">{{receipt_date}}</div></div>
                <div class="receipt-info-row"><div class="label">Time</div><div class="value">{{receipt_time}}</div></div>
                <div class="receipt-info-row"><div class="label">Location</div><div class="value">{{location}}</div></div>
                <div class="receipt-info-row"><div class="label">Served By</div><div class="value">{{employee_name}}</div></div>
            </div>
            <div class="divider"></div>
            <div class="items-section">
                <h2>Order Details</h2>
                <table class="items-table">
                    <thead><tr><th>Item</th><th>Amount</th></tr></thead>
                    <tbody>{{items_html}}</tbody>
                </table>
            </div>
            <div class="totals-section">
                <div class="totals-table">
                    <div class="total-row subtotal"><span>Subtotal</span><span>\${{subtotal}}</span></div>
                    <div class="total-row tax"><span>Tax</span><span>\${{tax}}</span></div>
                    <div class="total-row tip"><span>Gratuity</span><span>\${{tip}}</span></div>
                    <div class="total-row grand-total"><span>Total</span><span>\${{total}}</span></div>
                </div>
            </div>
            <div class="payment-section">
                <div class="payment-label">Payment Method</div>
                <div class="payment-value">{{payment_method}}</div>
            </div>
            {{barcode_html}}
            {{signature_html}}
        </div>
        <div class="footer">
            <div class="footer-content">
                <p>{{footer_message}}</p>
                <p>For inquiries, please contact <a href="mailto:{{store_email}}">{{store_email}}</a></p>
                <p>or call {{formatted_store_phone}}</p>
            </div>
            <div class="footer-address">
                <p>{{store_address}}</p>
                <p>© {{store_name}}. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>`

/** Restaurant Promotion receipt template – hero image, promo-style layout with receipt variables */
export const LA_MAISON_RESTAURANT_PROMOTION_RECEIPT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light only">
    <meta name="supported-color-schemes" content="light">
    <title>Receipt</title>
    <style>
        :root { color-scheme: light only; }
        html, body { color-scheme: light only; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Georgia', serif; background-color: #f0f4f8; padding: 20px; }
        .email-container { max-width: 700px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .email-header { padding: 20px 30px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #6b7280; letter-spacing: 1px; text-transform: uppercase; }
        .hero-section { width: 100%; height: 200px; background: linear-gradient(135deg, #a7c7e7 0%, #e0f2fe 100%); display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 14px; position: relative; overflow: hidden; }
        .hero-placeholder { text-align: center; padding: 20px; }
        .content-section { background-color: #ffffff; padding: 40px 40px 30px; }
        .receipt-title { font-size: 18px; color: #1e293b; margin-bottom: 20px; letter-spacing: 1px; font-weight: 600; }
        .receipt-info { display: table; width: 100%; margin-bottom: 25px; font-family: Arial, sans-serif; font-size: 13px; }
        .receipt-info-row { display: table-row; }
        .receipt-info-row > div { display: table-cell; padding: 6px 0; }
        .receipt-label { color: #666; text-transform: uppercase; letter-spacing: 1px; font-size: 11px; width: 140px; }
        .receipt-value { color: #2c2c2c; text-align: right; }
        .divider { height: 1px; background-color: #e0e0e0; margin: 25px 0; }
        .items-section h2 { font-size: 12px; font-weight: 400; letter-spacing: 2px; text-transform: uppercase; color: #666; margin-bottom: 20px; font-family: Arial, sans-serif; }
        .items-table { width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 13px; }
        .items-table thead { border-bottom: 1px solid #2c2c2c; }
        .items-table th { text-align: left; padding: 10px 0; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #666; font-weight: 400; }
        .items-table th:last-child { text-align: right; }
        .items-table td { padding: 14px 0; border-bottom: 1px solid #e0e0e0; color: #2c2c2c; }
        .items-table td:last-child { text-align: right; }
        .item-name { font-weight: 400; margin-bottom: 4px; }
        .item-description { font-size: 12px; color: #888; font-style: italic; }
        .totals-section { margin-top: 25px; font-family: Arial, sans-serif; }
        .totals-table { width: 100%; max-width: 300px; margin-left: auto; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; }
        .total-row.subtotal, .total-row.tax, .total-row.tip { color: #666; }
        .total-row.grand-total { border-top: 2px solid #2c2c2c; padding-top: 14px; margin-top: 6px; font-size: 16px; font-weight: 600; color: #2c2c2c; }
        .payment-section { margin-top: 30px; text-align: center; font-family: Arial, sans-serif; }
        .payment-label { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #666; margin-bottom: 6px; }
        .payment-value { font-size: 13px; color: #2c2c2c; }
        .logo-section { padding: 30px 40px; text-align: center; background-color: #f8fafc; }
        .logo-placeholder { width: 80px; height: 80px; background-color: #93c5fd; margin: 0 auto 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 11px; letter-spacing: 1px; }
        .restaurant-name { font-family: 'Brush Script MT', cursive; font-size: 28px; color: #1e293b; margin-bottom: 8px; }
        .footer { background-color: #1e293b; color: #e2e8f0; padding: 35px; text-align: center; font-size: 13px; line-height: 1.8; }
        .footer-links { margin: 20px 0; }
        .footer-links a { color: #e2e8f0; text-decoration: none; margin: 0 15px; font-size: 12px; letter-spacing: 1px; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <span>{{receipt_date}}</span>
            <span>VIEW ONLINE | FORWARD</span>
        </div>
        <div class="hero-section">
            <div class="hero-placeholder">{{store_name}}<br>Order #{{order_number}}</div>
        </div>
        <div class="content-section">
            <h2 class="receipt-title">Receipt</h2>
            <div class="receipt-info">
                <div class="receipt-info-row"><div class="receipt-label">Receipt Number</div><div class="receipt-value">{{order_number}}</div></div>
                <div class="receipt-info-row"><div class="receipt-label">Date</div><div class="receipt-value">{{receipt_date}}</div></div>
                <div class="receipt-info-row"><div class="receipt-label">Time</div><div class="receipt-value">{{receipt_time}}</div></div>
                <div class="receipt-info-row"><div class="receipt-label">Location</div><div class="receipt-value">{{location}}</div></div>
                <div class="receipt-info-row"><div class="receipt-label">Served By</div><div class="receipt-value">{{employee_name}}</div></div>
            </div>
            <div class="divider"></div>
            <div class="items-section">
                <h2>Order Details</h2>
                <table class="items-table">
                    <thead><tr><th>Item</th><th>Amount</th></tr></thead>
                    <tbody>{{items_html}}</tbody>
                </table>
            </div>
            <div class="totals-section">
                <div class="totals-table">
                    <div class="total-row subtotal"><span>Subtotal</span><span>\${{subtotal}}</span></div>
                    <div class="total-row tax"><span>Tax</span><span>\${{tax}}</span></div>
                    <div class="total-row tip"><span>Gratuity</span><span>\${{tip}}</span></div>
                    <div class="total-row grand-total"><span>Total</span><span>\${{total}}</span></div>
                </div>
            </div>
            <div class="payment-section">
                <div class="payment-label">Payment Method</div>
                <div class="payment-value">{{payment_method}}</div>
            </div>
            {{barcode_html}}
            {{signature_html}}
        </div>
        <div class="logo-section">
            <div class="logo-placeholder">LOGO</div>
            <div class="restaurant-name">{{store_name}}</div>
            <div style="font-size: 12px; color: #64748b;">{{store_tagline}}</div>
        </div>
        <div class="footer">
            <p><strong>{{store_name}}</strong></p>
            <p>{{store_address}}</p>
            <p>Reservations: {{formatted_store_phone}}</p>
            <p style="margin-top: 12px;">{{footer_message}}</p>
            <div class="footer-links">
                <a href="{{store_website}}">WEBSITE</a>
                <a href="mailto:{{store_email}}">EMAIL</a>
            </div>
            <p style="font-size: 11px; margin-top: 25px; opacity: 0.8;">
                You're receiving this because you made a purchase.<br>
                <a href="mailto:{{store_email}}" style="color: #e2e8f0;">Contact us</a>
            </p>
        </div>
    </div>
</body>
</html>`

/** La Maison base styles – shared across all email templates */
const LA_MAISON_BASE_STYLES = `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Georgia', 'Times New Roman', serif; background-color: #ffffff; color: #2c2c2c; line-height: 1.8; }
.email-container { max-width: 650px; margin: 0 auto; background-color: #ffffff; }
.header { text-align: center; padding: 50px 40px 40px; border-bottom: 2px solid #2c2c2c; }
.logo { font-size: 32px; font-weight: 300; letter-spacing: 4px; color: #2c2c2c; margin-bottom: 8px; text-transform: uppercase; }
.tagline { font-size: 12px; color: #666; letter-spacing: 2px; text-transform: uppercase; }
.content { padding: 50px 40px; }
.page-title { text-align: center; font-size: 14px; letter-spacing: 3px; text-transform: uppercase; color: #666; margin-bottom: 40px; font-family: Arial, sans-serif; }
.receipt-info { display: table; width: 100%; margin-bottom: 30px; font-family: Arial, sans-serif; font-size: 13px; }
.receipt-info-row { display: table-row; }
.receipt-info-row > div { display: table-cell; padding: 8px 0; }
.label { color: #666; text-transform: uppercase; letter-spacing: 1px; font-size: 11px; width: 180px; }
.value { color: #2c2c2c; text-align: right; }
.message-body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.8; color: #2c2c2c; margin-bottom: 30px; }
.footer { border-top: 1px solid #e0e0e0; padding: 40px 40px 50px; text-align: center; }
.footer-content { font-family: Arial, sans-serif; font-size: 11px; color: #888; line-height: 2; letter-spacing: 0.5px; }
.footer-content p { margin-bottom: 8px; }
.footer-content a { color: #2c2c2c; text-decoration: none; border-bottom: 1px solid #2c2c2c; }
.footer-address { margin-top: 30px; font-size: 11px; color: #aaa; letter-spacing: 1px; }`

/** Order Alert – App Notification style (glassmorphism, default for order alerts) */
export const LA_MAISON_ORDER_APP_NOTIFICATION_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light only">
    <meta name="supported-color-schemes" content="light">
    <title>New Order</title>
    <style>
        :root { color-scheme: light only; supported-color-schemes: light; }
        html, body { color-scheme: light only; }
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #90caf9 100%); }
        @media (prefers-color-scheme: dark) {
          html, body { background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #90caf9 100%) !important; color: #333 !important; }
          .email-wrapper { background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #90caf9 100%) !important; }
          .glass-card { background: #ffffff !important; border-color: #e3f2fd !important; }
          .order-summary { background: #f5faff !important; }
          .order-details { background: #f0f7ff !important; color: #37474f !important; }
          .order-header h1 { color: #1565c0 !important; }
          .order-number, .order-summary .items-table td, .order-summary .total-row { color: #37474f !important; }
          .order-summary .total-row.grand-total { color: #1565c0 !important; }
        }
        .email-wrapper { width: 100%; padding: 40px 20px; background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #90caf9 100%); }
        .email-container { max-width: 600px; margin: 0 auto; position: relative; }
        .glass-card { background: #ffffff; border-radius: 24px; border: 1px solid #e3f2fd; padding: 24px 40px 50px; text-align: center; box-shadow: 0 8px 32px rgba(33, 150, 243, 0.2); position: relative; overflow: hidden; }
        .glass-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #42a5f5, #2196f3, #1976d2); }
        .order-header { margin-bottom: 16px; }
        .order-header h1 { color: #1565c0; font-size: 32px; margin: 0; font-weight: 600; }
        .order-number { color: #546e7a; font-size: 14px; margin-top: 0; }
        .order-source-logos { display: flex; justify-content: center; gap: 12px; margin: 6px 0; flex-wrap: wrap; }
        .order-source-logos img { display: block; margin: 0 auto; height: 40px !important; width: auto !important; max-width: 160px !important; object-fit: contain; }
        .order-summary { text-align: left; background: #f5faff; border-radius: 12px; padding: 20px; margin: 20px 0; font-size: 14px; }
        .order-summary .items-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .order-summary .items-table th { text-align: left; padding: 8px 0; font-size: 11px; text-transform: uppercase; color: #546e7a; border-bottom: 1px solid rgba(33,150,243,0.3); }
        .order-summary .items-table th:last-child { text-align: right; }
        .order-summary .items-table td { padding: 10px 0; color: #37474f; }
        .order-summary .items-table td:last-child { text-align: right; }
        .order-summary .item-line { font-weight: 500; }
        .order-summary .item-notes { font-size: 11px; color: #78909c; font-style: italic; margin-top: 2px; }
        .order-summary .totals { margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(33,150,243,0.3); font-size: 11px; }
        .order-summary .total-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; }
        .order-summary .totals .total-row:not(.grand-total) { font-size: 11px; }
        .order-summary .total-row.grand-total { font-weight: 600; font-size: 16px !important; color: #1565c0; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(33,150,243,0.3); }
        .order-summary .barcode-wrap { text-align: center; margin: 16px 0; }
        .order-details { text-align: left; background: #f0f7ff; border-radius: 10px; padding: 14px 18px; margin: 16px 0; font-size: 12px; color: #37474f; line-height: 1.6; }
        .order-details:empty { display: none; }
        .order-details div { margin: 4px 0; }
        .cta-wrap { margin-top: 16px; width: 100%; }
        .cta-button { display: block; width: 100%; box-sizing: border-box; background: linear-gradient(135deg, #42a5f5 0%, #2196f3 100%); color: #ffffff; text-decoration: none; padding: 8px 16px; border-radius: 12px; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 20px rgba(33, 150, 243, 0.4); text-align: center; }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-container">
            <div class="glass-card">
                <div class="order-header">
                    <h1>{{order_title}}</h1>
                    <div class="order-number">{{order_number}}</div>
                </div>
                <div class="order-source-logos">{{order_source_logo_html}}</div>
                <div class="order-summary">
                    <table class="items-table">
                        <tbody>{{items_html}}</tbody>
                    </table>
                    <div class="totals">
                        <div class="total-row">Subtotal: <span>\${{subtotal}}</span></div>
                        <div class="total-row">Tax: <span>\${{tax}}</span></div>
                        <div class="total-row">Tip: <span>\${{tip}}</span></div>
                        <div class="total-row grand-total">Total: <span>\${{total}}</span></div>
                    </div>
                    <div class="barcode-wrap">{{barcode_html}}</div>
                </div>
                <div class="order-details">{{order_details_html}}</div>
                <div class="cta-wrap"><a href="{{order_url}}" class="cta-button">View Order</a></div>
            </div>
        </div>
    </div>
</body>
</html>`

/** La Maison Order Alert template */
export const LA_MAISON_ORDER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light only">
    <meta name="supported-color-schemes" content="light">
    <title>New Order</title>
    <style>
        :root { color-scheme: light only; }
        html, body { color-scheme: light only; }
        ${LA_MAISON_BASE_STYLES}
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">{{store_name}}</div>
            <div class="tagline">{{store_tagline}}</div>
        </div>
        <div class="content">
            <div class="page-title">New Order</div>
            <div class="receipt-info">
                <div class="receipt-info-row"><div class="label">Order Number</div><div class="value">{{order_number}}</div></div>
                <div class="receipt-info-row"><div class="label">Total</div><div class="value">\${{total}}</div></div>
            </div>
            <div class="message-body">
                <p>A new order has been received.</p>
            </div>
        </div>
        <div class="footer">
            <div class="footer-content">
                <p>{{footer_message}}</p>
                <p>For inquiries, please contact <a href="mailto:{{store_email}}">{{store_email}}</a></p>
                <p>or call {{formatted_store_phone}}</p>
            </div>
            <div class="footer-address">
                <p>{{store_address}}</p>
                <p>© {{store_name}}. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>`

/** Schedule – App Notification style (glassmorphism, default for schedule emails) */
export const LA_MAISON_SCHEDULE_APP_NOTIFICATION_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light only">
    <meta name="supported-color-schemes" content="light">
    <title>Schedule Updated</title>
    <style>
        :root { color-scheme: light only; supported-color-schemes: light; }
        html, body { color-scheme: light only; }
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #90caf9 100%); }
        .email-wrapper { width: 100%; padding: 40px 20px; background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #90caf9 100%); }
        .email-container { max-width: 600px; margin: 0 auto; position: relative; }
        .glass-card { background: #ffffff; border-radius: 24px; border: 1px solid #e3f2fd; padding: 50px 40px; text-align: center; box-shadow: 0 8px 32px rgba(33, 150, 243, 0.2); position: relative; overflow: hidden; }
        .glass-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #42a5f5, #2196f3, #1976d2); }
        h1 { color: #1565c0; font-size: 32px; margin: 0 0 16px 0; font-weight: 600; }
        .message { color: #546e7a; font-size: 16px; line-height: 1.6; margin-bottom: 32px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #42a5f5 0%, #2196f3 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 20px rgba(33, 150, 243, 0.4); margin-bottom: 0; }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-container">
            <div class="glass-card">
                <h1>Schedule Updated</h1>
                <p class="message">{{message}}</p>
                <a href="#" class="cta-button">View Schedule</a>
            </div>
        </div>
    </div>
</body>
</html>`

/** La Maison Schedule template (Classic) */
export const LA_MAISON_SCHEDULE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Schedule Updated</title>
    <style>${LA_MAISON_BASE_STYLES}</style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">{{store_name}}</div>
            <div class="tagline">{{store_tagline}}</div>
        </div>
        <div class="content">
            <div class="page-title">Schedule Updated</div>
            <div class="message-body">
                <p>{{message}}</p>
            </div>
        </div>
        <div class="footer">
            <div class="footer-content">
                <p>{{footer_message}}</p>
                <p>For inquiries, please contact <a href="mailto:{{store_email}}">{{store_email}}</a></p>
                <p>or call {{formatted_store_phone}}</p>
            </div>
            <div class="footer-address">
                <p>{{store_address}}</p>
                <p>© {{store_name}}. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>`

/** Clock-in – App Notification style (glassmorphism, default for clock-in emails) */
export const LA_MAISON_CLOCKIN_APP_NOTIFICATION_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light only">
    <meta name="supported-color-schemes" content="light">
    <title>Clock {{action}}</title>
    <style>
        :root { color-scheme: light only; supported-color-schemes: light; }
        html, body { color-scheme: light only; }
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #90caf9 100%); }
        .email-wrapper { width: 100%; padding: 40px 20px; background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #90caf9 100%); }
        .email-container { max-width: 600px; margin: 0 auto; position: relative; }
        .glass-card { background: #ffffff; border-radius: 24px; border: 1px solid #e3f2fd; padding: 50px 40px; text-align: center; box-shadow: 0 8px 32px rgba(33, 150, 243, 0.2); position: relative; overflow: hidden; }
        .glass-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #42a5f5, #2196f3, #1976d2); }
        h1 { color: #1565c0; font-size: 32px; margin: 0 0 16px 0; font-weight: 600; }
        .message { color: #546e7a; font-size: 16px; line-height: 1.6; margin-bottom: 32px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #42a5f5 0%, #2196f3 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 20px rgba(33, 150, 243, 0.4); margin-bottom: 0; }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-container">
            <div class="glass-card">
                <h1>{{employee_name}} {{action}}</h1>
                <p class="message">Timekeeping notification.</p>
                <a href="#" class="cta-button">View Schedule</a>
            </div>
        </div>
    </div>
</body>
</html>`

/** La Maison Clock-in template (Classic) */
export const LA_MAISON_CLOCKIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clock {{action}}</title>
    <style>${LA_MAISON_BASE_STYLES}</style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">{{store_name}}</div>
            <div class="tagline">{{store_tagline}}</div>
        </div>
        <div class="content">
            <div class="page-title">{{employee_name}} {{action}}</div>
            <div class="message-body">
                <p>Timekeeping notification.</p>
            </div>
        </div>
        <div class="footer">
            <div class="footer-content">
                <p>{{footer_message}}</p>
                <p>For inquiries, please contact <a href="mailto:{{store_email}}">{{store_email}}</a></p>
                <p>or call {{formatted_store_phone}}</p>
            </div>
            <div class="footer-address">
                <p>{{store_address}}</p>
                <p>© {{store_name}}. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>`

/** Report – App Notification style (glassmorphism, default for report emails) */
export const LA_MAISON_REPORT_APP_NOTIFICATION_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light only">
    <meta name="supported-color-schemes" content="light">
    <title>{{report_name}}</title>
    <style>
        :root { color-scheme: light only; supported-color-schemes: light; }
        html, body { color-scheme: light only; }
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #90caf9 100%); }
        .email-wrapper { width: 100%; padding: 40px 20px; background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #90caf9 100%); }
        .email-container { max-width: 600px; margin: 0 auto; position: relative; }
        .glass-card { background: #ffffff; border-radius: 24px; border: 1px solid #e3f2fd; padding: 50px 40px; text-align: center; box-shadow: 0 8px 32px rgba(33, 150, 243, 0.2); position: relative; overflow: hidden; }
        .glass-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #42a5f5, #2196f3, #1976d2); }
        h1 { color: #1565c0; font-size: 32px; margin: 0 0 16px 0; font-weight: 600; }
        .message { color: #546e7a; font-size: 16px; line-height: 1.6; margin-bottom: 32px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #42a5f5 0%, #2196f3 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 20px rgba(33, 150, 243, 0.4); margin-bottom: 0; }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-container">
            <div class="glass-card">
                <h1>{{report_name}}</h1>
                <p class="message">Report for {{report_date}}. Please find your report attached or as requested.</p>
                <a href="#" class="cta-button">View Report</a>
            </div>
        </div>
    </div>
</body>
</html>`

/** La Maison Report template (Classic) */
export const LA_MAISON_REPORT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{report_name}}</title>
    <style>${LA_MAISON_BASE_STYLES}</style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">{{store_name}}</div>
            <div class="tagline">{{store_tagline}}</div>
        </div>
        <div class="content">
            <div class="page-title">{{report_name}}</div>
            <div class="receipt-info">
                <div class="receipt-info-row"><div class="label">Report Date</div><div class="value">{{report_date}}</div></div>
            </div>
            <div class="message-body">
                <p>Please find your report attached or as requested.</p>
            </div>
        </div>
        <div class="footer">
            <div class="footer-content">
                <p>{{footer_message}}</p>
                <p>For inquiries, please contact <a href="mailto:{{store_email}}">{{store_email}}</a></p>
                <p>or call {{formatted_store_phone}}</p>
            </div>
            <div class="footer-address">
                <p>{{store_address}}</p>
                <p>© {{store_name}}. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>`
