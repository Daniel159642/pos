# Email & SMS Notifications

Configure **Settings → Notifications → Email & SMS Notifications** for orders, reports, scheduling, clock-ins, and receipts.

## Quick Setup

1. **Open Settings** and go to the **Notifications** tab.
2. In the **Email & SMS Notifications** section:
   - **Email service**: Gmail (test email) or AWS SES (production email)
   - **SMS service**: AWS SNS only (~$0.006/SMS) — separate from email
3. **To test email with Gmail**:
   - SMTP Server: `smtp.gmail.com`
   - Gmail Address: your Gmail
   - App Password: Create at [Google Account → Security → 2-Step Verification → App passwords](https://myaccount.google.com/apppasswords)
4. **For AWS (production)**:
   - AWS Access Key ID, Secret Access Key, Region (e.g. `us-east-1`)
5. Toggle **Notify for** (Orders, Reports, Scheduling, Clock-ins, Receipts) for email/SMS.
6. Click **Save**, then **Test Email** or **Test SMS**.

## Important: Email-to-SMS is largely discontinued

**ATT** (June 2025), **Verizon**, and **T-Mobile** (late 2024) have shut down their free email-to-SMS gateways. For **reliable SMS delivery**, use **AWS SNS** (~$0.006/SMS).

## Migrations

Run these if the tables don't exist yet:

```bash
psql $DATABASE_URL -f migrations/add_sms_tables_postgres.sql
psql $DATABASE_URL -f migrations/add_notification_settings_postgres.sql
```

The second migration adds `email_provider`, `email_from_address`, and `notification_preferences` to `sms_settings`.
