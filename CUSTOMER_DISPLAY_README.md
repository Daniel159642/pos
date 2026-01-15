# Customer Display System

A comprehensive customer-facing display system for your POS that shows transaction details, payment options, and receipt preferences in real-time.

## Features

✅ **Real-time Transaction Display** - Shows items as they're scanned
✅ **Payment Method Selection** - Visual payment method selection with icons
✅ **Tip Prompts** - Optional tip suggestions (configurable)
✅ **Card Processing** - Visual feedback during card processing
✅ **Receipt Options** - Print, email, SMS, or no receipt
✅ **Success Confirmation** - Clear payment confirmation screen
✅ **Split Payment Support** - Multiple payment methods per transaction
✅ **Mobile Wallet Support** - Apple Pay, Google Pay, Samsung Pay

## Database Schema

The system uses the following tables:
- `transactions` - Main transaction records
- `transaction_items` - Line items for each transaction
- `payments` - Payment records (supports split payments)
- `payment_methods` - Available payment methods
- `receipt_preferences` - Customer receipt preferences
- `customer_display_settings` - Display configuration
- `customer_display_sessions` - Session tracking

## Setup

### 1. Run Migration

The database migration has already been run. If you need to run it again:

```bash
python3 migrate_customer_display.py
```

This creates all necessary tables and inserts default payment methods.

### 2. Access Customer Display

The customer display is available at:
- **URL**: `http://localhost:3000/customer-display`
- **No authentication required** (customer-facing)

### 3. Integration with POS

The POS system automatically integrates with the customer display:
- When a transaction is processed, it's sent to the customer display
- The customer display shows items, totals, and payment options
- Payment processing updates are reflected in real-time

## Usage

### For Cashiers (POS Terminal)

1. **Start Transaction**: Add items to cart as usual
2. **Process Payment**: Click "Pay" and select payment method
3. **Customer Display Updates**: The customer display automatically shows:
   - Items being scanned
   - Transaction totals
   - Payment options
   - Processing status

### For Customers (Display Screen)

1. **View Items**: See all items as they're scanned
2. **Select Payment**: Choose payment method (card, cash, mobile wallet, etc.)
3. **Add Tip** (if enabled): Select tip percentage or skip
4. **Process Payment**: Follow on-screen instructions
5. **Choose Receipt**: Select receipt delivery method
6. **Confirmation**: See payment success confirmation

## Configuration

### Payment Methods

Default payment methods are automatically created:
- Credit Card
- Debit Card
- Cash
- Apple Pay
- Google Pay
- Samsung Pay
- Gift Card
- Store Credit

To modify payment methods, update the `payment_methods` table.

### Display Settings

Configure the customer display via the `customer_display_settings` table:

```sql
UPDATE customer_display_settings 
SET tip_enabled = 1,
    tip_suggestions = '[15, 18, 20, 25]',
    theme_color = '#4CAF50'
WHERE setting_id = 1;
```

Settings:
- `tip_enabled` - Enable/disable tip prompts (0 or 1)
- `tip_suggestions` - JSON array of tip percentages
- `theme_color` - Primary theme color (hex code)
- `show_promotions` - Show promotional content on idle screen
- `show_survey_prompt` - Show customer survey prompts
- `show_loyalty_signup` - Show loyalty program signup

## API Endpoints

### Transaction Management

- `POST /api/transaction/start` - Start new transaction
- `GET /api/transaction/<id>` - Get transaction details

### Payment Processing

- `GET /api/payment-methods` - Get available payment methods
- `POST /api/payment/process` - Process payment

### Receipt Preferences

- `POST /api/receipt/preference` - Save receipt preference

### Display Settings

- `GET /api/customer-display/settings` - Get display settings

## Technical Details

### Real-time Updates

Currently uses polling (sessionStorage) for simplicity. For production, consider:
- WebSocket integration (Socket.IO)
- Server-Sent Events (SSE)
- WebRTC for ultra-low latency

### Payment Processing

The system supports:
- **Single Payment**: One payment method per transaction
- **Split Payment**: Multiple payment methods (future enhancement)
- **Partial Payment**: Track partial payments
- **Change Calculation**: Automatic change calculation for cash

### Receipt Delivery

Supports multiple receipt delivery methods:
- **Printed**: Physical receipt from printer
- **Email**: Digital receipt via email
- **SMS**: Text message receipt
- **None**: No receipt requested

## Future Enhancements

- [ ] WebSocket integration for real-time updates
- [ ] Split payment support (multiple payment methods)
- [ ] Customer loyalty integration
- [ ] Promotional content management
- [ ] Customer survey integration
- [ ] Multi-language support
- [ ] Accessibility features (screen reader support)
- [ ] Custom branding/logo upload

## Troubleshooting

### Customer Display Not Updating

1. Check that the transaction was created successfully
2. Verify sessionStorage is accessible
3. Check browser console for errors
4. Ensure both POS and customer display are on the same domain

### Payment Methods Not Showing

1. Verify payment methods exist in database:
   ```sql
   SELECT * FROM payment_methods WHERE is_active = 1;
   ```
2. Check API endpoint: `/api/payment-methods`
3. Verify CORS settings if using different domains

### Tips Not Showing

1. Check display settings:
   ```sql
   SELECT tip_enabled FROM customer_display_settings;
   ```
2. Update settings if needed:
   ```sql
   UPDATE customer_display_settings SET tip_enabled = 1;
   ```

## Support

For issues or questions, check:
- Database migration logs
- Browser console errors
- Backend server logs
- API endpoint responses








