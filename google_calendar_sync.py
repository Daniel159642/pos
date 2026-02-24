"""
Google Calendar sync: OAuth 2.0 flow and sync POS events to Google Calendar.
Requires: GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_REDIRECT_URI
"""
import os
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from urllib.parse import urlencode

# Lazy imports for google libs (so app starts without them if not configured)
def _get_flow():
    from google_auth_oauthlib.flow import Flow
    client_id = os.environ.get('GOOGLE_CALENDAR_CLIENT_ID')
    client_secret = os.environ.get('GOOGLE_CALENDAR_CLIENT_SECRET')
    redirect_uri = os.environ.get('GOOGLE_CALENDAR_REDIRECT_URI') or 'http://localhost:5001/api/integrations/google-calendar/callback'
    if not client_id or not client_secret:
        raise ValueError('GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET must be set')
    return Flow.from_client_config(
        {
            'web': {
                'client_id': client_id,
                'client_secret': client_secret,
                'redirect_uris': [redirect_uri],
                'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
                'token_uri': 'https://oauth2.googleapis.com/token',
            }
        },
        scopes=['https://www.googleapis.com/auth/calendar.events'],
        redirect_uri=redirect_uri,
    )


def get_oauth_url(state: Optional[str] = None) -> str:
    """Generate Google OAuth 2.0 authorization URL (calendar.events scope)."""
    flow = _get_flow()
    auth_url, _ = flow.authorization_url(
        access_type='offline',
        prompt='consent',
        state=state or '',
    )
    return auth_url


def exchange_code_for_tokens(code: str, redirect_uri: Optional[str] = None) -> Dict[str, Any]:
    """Exchange authorization code for access and refresh tokens."""
    flow = _get_flow()
    if redirect_uri:
        flow.redirect_uri = redirect_uri
    flow.fetch_token(code=code)
    creds = flow.credentials
    return {
        'access_token': creds.token,
        'refresh_token': getattr(creds, 'refresh_token') or None,
        'token_expiry': creds.expiry.isoformat() if creds.expiry else None,
    }


def get_stored_tokens(employee_id: int) -> Optional[Dict[str, Any]]:
    """Load tokens from DB for an employee."""
    from database import get_connection
    conn = get_connection()
    if not conn:
        return None
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT access_token, refresh_token, token_expiry
            FROM google_calendar_tokens
            WHERE employee_id = %s
        """, (employee_id,))
        row = cur.fetchone()
        if not row:
            return None
        return {
            'access_token': row[0],
            'refresh_token': row[1],
            'token_expiry': row[2].isoformat() if hasattr(row[2], 'isoformat') else str(row[2]) if row[2] else None,
        }
    finally:
        cur.close()
        conn.close()


def save_tokens(employee_id: int, access_token: str, refresh_token: Optional[str], token_expiry: Optional[str]) -> None:
    """Upsert tokens for an employee."""
    from database import get_connection
    conn = get_connection()
    if not conn:
        raise RuntimeError('No database connection')
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO google_calendar_tokens (employee_id, access_token, refresh_token, token_expiry, updated_at)
            VALUES (%s, %s, %s, %s::timestamptz, NOW())
            ON CONFLICT (employee_id) DO UPDATE SET
                access_token = EXCLUDED.access_token,
                refresh_token = COALESCE(EXCLUDED.refresh_token, google_calendar_tokens.refresh_token),
                token_expiry = EXCLUDED.token_expiry,
                updated_at = NOW()
        """, (employee_id, access_token, refresh_token, token_expiry))
        conn.commit()
    finally:
        cur.close()
        conn.close()


def refresh_access_token(employee_id: int) -> Optional[Dict[str, Any]]:
    """Refresh access token using refresh_token; update DB and return new tokens."""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    stored = get_stored_tokens(employee_id)
    if not stored or not stored.get('refresh_token'):
        return None
    creds = Credentials(
        token=stored['access_token'],
        refresh_token=stored['refresh_token'],
        token_uri='https://oauth2.googleapis.com/token',
        client_id=os.environ.get('GOOGLE_CALENDAR_CLIENT_ID'),
        client_secret=os.environ.get('GOOGLE_CALENDAR_CLIENT_SECRET'),
    )
    if stored.get('token_expiry'):
        try:
            ts = stored['token_expiry']
            if isinstance(ts, str) and 'T' in ts:
                creds.expiry = datetime.fromisoformat(ts.replace('Z', '+00:00'))
            elif isinstance(ts, str):
                creds.expiry = datetime.strptime(ts[:19], '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc)
        except Exception:
            pass
    creds.refresh(Request())
    save_tokens(
        employee_id,
        creds.token,
        getattr(creds, 'refresh_token') or stored.get('refresh_token'),
        creds.expiry.isoformat() if creds.expiry else None,
    )
    return get_stored_tokens(employee_id)


def get_valid_credentials(employee_id: int):
    """Return google.oauth2.credentials.Credentials that are valid (refreshing if needed)."""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    stored = get_stored_tokens(employee_id)
    if not stored:
        return None
    creds = Credentials(
        token=stored['access_token'],
        refresh_token=stored.get('refresh_token'),
        token_uri='https://oauth2.googleapis.com/token',
        client_id=os.environ.get('GOOGLE_CALENDAR_CLIENT_ID'),
        client_secret=os.environ.get('GOOGLE_CALENDAR_CLIENT_SECRET'),
    )
    if stored.get('token_expiry'):
        try:
            ts = stored['token_expiry']
            if isinstance(ts, str) and 'T' in ts:
                creds.expiry = datetime.fromisoformat(ts.replace('Z', '+00:00'))
            elif isinstance(ts, str):
                creds.expiry = datetime.strptime(ts[:19], '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc)
        except Exception:
            pass
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        save_tokens(
            employee_id,
            creds.token,
            getattr(creds, 'refresh_token') or stored.get('refresh_token'),
            creds.expiry.isoformat() if creds.expiry else None,
        )
    return creds


def sync_event_to_google(
    employee_id: int,
    event: Dict[str, Any],
    *,
    google_event_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create or update a Google Calendar event from a POS event.
    event: { title, date, startTime, endTime, notes?, customerId? } or DB row with event_date, start_time, end_time, title, description.
    Returns: { 'success': bool, 'google_event_id': str|None, 'error': str|None }
    """
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError

    creds = get_valid_credentials(employee_id)
    if not creds:
        return {'success': False, 'google_event_id': None, 'error': 'Google Calendar not connected'}

    # Normalize POS event to date + start/end times
    event_date = event.get('event_date') or event.get('date')
    if hasattr(event_date, 'isoformat'):
        event_date = event_date.isoformat()
    if isinstance(event_date, datetime):
        event_date = event_date.date().isoformat()
    start_time = event.get('start_time') or event.get('startTime') or '00:00'
    end_time = event.get('end_time') or event.get('endTime') or '23:59'
    if hasattr(start_time, 'strftime'):
        start_time = start_time.strftime('%H:%M')
    if hasattr(end_time, 'strftime'):
        end_time = end_time.strftime('%H:%M')
    title = event.get('title') or 'POS Event'
    description = event.get('description') or event.get('notes') or ''

    # Normalize time to HH:MM
    if isinstance(start_time, str) and len(start_time) >= 5:
        start_time = start_time[:5]
    if isinstance(end_time, str) and len(end_time) >= 5:
        end_time = end_time[:5]
    start_dt = f"{event_date}T{start_time}:00"
    end_dt = f"{event_date}T{end_time}:00"
    body = {
        'summary': title,
        'description': description,
        'start': {'dateTime': start_dt, 'timeZone': 'America/New_York'},
        'end': {'dateTime': end_dt, 'timeZone': 'America/New_York'},
    }

    try:
        service = build('calendar', 'v3', credentials=creds, cache_discovery=False)
        if google_event_id:
            # Update existing
            updated = service.events().patch(calendarId='primary', eventId=google_event_id, body=body).execute()
            return {'success': True, 'google_event_id': updated.get('id'), 'error': None}
        else:
            # Create new
            created = service.events().insert(calendarId='primary', body=body).execute()
            return {'success': True, 'google_event_id': created.get('id'), 'error': None}
    except HttpError as e:
        if e.resp.status == 401:
            return {'success': False, 'google_event_id': None, 'error': 'Google access revoked; please reconnect'}
        return {'success': False, 'google_event_id': None, 'error': str(e)}
    except Exception as e:
        return {'success': False, 'google_event_id': None, 'error': str(e)}


def update_master_calendar_google_event_id(calendar_id: int, google_event_id: str) -> None:
    """Store Google event id on master_calendar row for future PATCH."""
    from database import get_connection
    conn = get_connection()
    if not conn:
        return
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE master_calendar SET google_event_id = %s, updated_at = NOW() WHERE calendar_id = %s",
            (google_event_id, calendar_id),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()
