# Google Calendar sync setup

Sync POS calendar events to Google Calendar via OAuth 2.0.

## 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. **Enable the API**: APIs & Services → Library → search "Google Calendar API" → Enable.
4. **Create OAuth credentials**:
   - APIs & Services → Credentials → Create Credentials → OAuth client ID.
   - If prompted, configure the OAuth consent screen (User type: External is fine for testing).
   - Application type: **Web application**.
   - Name: e.g. "POS Calendar Sync".
   - **Authorized redirect URIs**: add exactly:
     - `http://localhost:5001/api/integrations/google-calendar/callback` (for local)
     - Or your production URL, e.g. `https://your-domain.com/api/integrations/google-calendar/callback`.
5. Copy the **Client ID** and **Client secret**.

## 2. Environment variables

In `pos/.env`:

```env
GOOGLE_CALENDAR_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=your_client_secret
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:5001/api/integrations/google-calendar/callback
```

For production, set `GOOGLE_CALENDAR_REDIRECT_URI` to your backend URL + `/api/integrations/google-calendar/callback`.

## 3. OAuth scope

The app requests:

- `https://www.googleapis.com/auth/calendar.events` — create/update/delete events on the user’s primary calendar.

## 4. Flow

1. User clicks **Connect Google Calendar** (in the calendar link dropdown or in the event panel).
2. Backend returns the Google OAuth URL; frontend opens it in a new tab.
3. User signs in and grants access; Google redirects to your callback URL with a `code`.
4. Backend exchanges the code for access and refresh tokens and stores them per employee.
5. When the user clicks **Sync to Google Calendar** on an event, the backend uses the stored tokens (refreshing if needed) and creates or updates the event on the user’s primary calendar.
6. If the user revokes access, the next sync returns an error and the UI can prompt to reconnect.

## 5. Database

- **google_calendar_tokens**: one row per employee (access_token, refresh_token, token_expiry).
- **master_calendar.google_event_id**: set when an event is synced so future syncs use PATCH instead of creating duplicates.

Tables and column are created automatically on first use.
