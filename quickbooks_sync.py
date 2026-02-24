import os
import json
import requests
import base64
from datetime import datetime, timedelta
from database_postgres import get_connection

# Intuit OAuth 2.0 Endpoints
QBO_DISCOVERY_URL = "https://developer.api.intuit.com/.well-known/openid_sandbox_configuration" # Sandbox discovery
# Production discovery: "https://developer.api.intuit.com/.well-known/openid_configuration"

# You typically discover these dynamically, but hardcoding the standard endpoints is common:
QBO_AUTHORIZATION_URL = "https://appcenter.intuit.com/connect/oauth2"
QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"

def get_oauth_url() -> str:
    """Generate the OAuth2 URL for the user to grant access to QuickBooks Online"""
    client_id = os.environ.get("QBO_CLIENT_ID")
    redirect_uri = os.environ.get("QBO_REDIRECT_URI", "http://localhost:5001/api/quickbooks/callback")
    
    if not client_id:
        raise ValueError("QBO_CLIENT_ID environment variable not set.")
        
    scopes = "com.intuit.quickbooks.accounting"
    # CSRF Token (should ideally be generated dynamically and stored in session, simplified here)
    state = "pos_qbo_auth_state" 
    
    url = (
        f"{QBO_AUTHORIZATION_URL}"
        f"?client_id={client_id}"
        f"&response_type=code"
        f"&scope={scopes}"
        f"&redirect_uri={redirect_uri}"
        f"&state={state}"
    )
    return url

def exchange_code_for_tokens(auth_code: str, realm_id: str):
    """Exchange the authorization code for an access token and refresh token"""
    client_id = os.environ.get("QBO_CLIENT_ID")
    client_secret = os.environ.get("QBO_CLIENT_SECRET")
    redirect_uri = os.environ.get("QBO_REDIRECT_URI", "http://localhost:5001/api/quickbooks/callback")
    
    if not client_id or not client_secret:
        raise ValueError("QBO_CLIENT_ID or QBO_CLIENT_SECRET not set.")

    # Intuit requires Basic Auth using base64 encoded client_id:client_secret
    auth_header_value = base64.b64encode(f"{client_id}:{client_secret}".encode('utf-8')).decode('utf-8')

    headers = {
        "Authorization": f"Basic {auth_header_value}",
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
    }

    data = {
        "grant_type": "authorization_code",
        "code": auth_code,
        "redirect_uri": redirect_uri
    }

    response = requests.post(QBO_TOKEN_URL, headers=headers, data=data)
    
    if response.status_code != 200:
        raise Exception(f"Failed to get tokens: {response.text}")
        
    token_data = response.json()
    save_tokens('quickbooks', token_data['access_token'], token_data['refresh_token'], realm_id, token_data.get('expires_in', 3600))
    return True

def save_tokens(provider_name: str, access_token: str, refresh_token: str, realm_id: str, expires_in_sec: int):
    """Save or update tokens in the integrations table"""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        expires_at = datetime.now() + timedelta(seconds=expires_in_sec)
        
        cursor.execute("""
            INSERT INTO integrations (provider_name, access_token, refresh_token, realm_id, expires_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (provider_name) DO UPDATE SET
                access_token = EXCLUDED.access_token,
                refresh_token = EXCLUDED.refresh_token,
                realm_id = EXCLUDED.realm_id,
                expires_at = EXCLUDED.expires_at,
                updated_at = CURRENT_TIMESTAMP
        """, (provider_name, access_token, refresh_token, realm_id, expires_at))
        conn.commit()
    finally:
        cursor.close()
        conn.close()

def get_stored_tokens(provider_name: str = 'quickbooks'):
    """Retrieve stored tokens. Note: in a real app, check expires_at and use refresh_token if needed."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT access_token, refresh_token, realm_id, expires_at FROM integrations WHERE provider_name = %s", (provider_name,))
        row = cursor.fetchone()
        if not row:
            return None
            
        data = {
            'access_token': row.get('access_token'),
            'refresh_token': row.get('refresh_token'),
            'realm_id': row.get('realm_id'),
            'expires_at': row.get('expires_at')
        }
        return data
    finally:
        cursor.close()
        conn.close()

def refresh_qbo_tokens(refresh_token: str, realm_id: str):
    """Refresh the QuickBooks access token using the refresh token."""
    client_id = os.environ.get("QBO_CLIENT_ID")
    client_secret = os.environ.get("QBO_CLIENT_SECRET")
    
    if not client_id or not client_secret:
        raise ValueError("QBO_CLIENT_ID or QBO_CLIENT_SECRET not set.")
        
    auth_header_value = base64.b64encode(f"{client_id}:{client_secret}".encode('utf-8')).decode('utf-8')

    headers = {
        "Authorization": f"Basic {auth_header_value}",
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
    }

    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token
    }

    response = requests.post(QBO_TOKEN_URL, headers=headers, data=data)
    
    if response.status_code != 200:
        raise Exception(f"Failed to refresh tokens: {response.text}")
        
    token_data = response.json()
    save_tokens('quickbooks', token_data['access_token'], token_data['refresh_token'], realm_id, token_data.get('expires_in', 3600))
    return token_data['access_token']

def get_valid_qbo_tokens():
    """Get stored tokens, refreshing them if they are expired or expiring soon."""
    tokens = get_stored_tokens('quickbooks')
    if not tokens:
        return None
        
    expires_at = tokens.get('expires_at')
    # If expiring within 5 minutes, refresh
    if expires_at and datetime.now() + timedelta(minutes=5) >= expires_at:
        try:
            new_access_token = refresh_qbo_tokens(tokens['refresh_token'], tokens['realm_id'])
            tokens['access_token'] = new_access_token
        except Exception as e:
            print(f"Error refreshing QBO tokens: {e}")
            return None
            
    return tokens

def get_qbo_api_base_url():
    """Return Sandbox URL for development or production URL from env."""
    return os.environ.get("QBO_API_BASE_URL", "https://sandbox-quickbooks.api.intuit.com")

def fetch_qbo_accounts():
    """Fetch all accounts from the QuickBooks Chart of Accounts."""
    tokens = get_valid_qbo_tokens()
    if not tokens:
        raise Exception("QuickBooks not connected or tokens invalid.")
        
    realm_id = tokens['realm_id']
    access_token = tokens['access_token']
    base_url = get_qbo_api_base_url()
    
    # Query QBO for all active accounts
    query = "select * from Account where Active = true"
    url = f"{base_url}/v3/company/{realm_id}/query?query={requests.utils.quote(query)}"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json"
    }
    
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        raise Exception(f"Failed to fetch accounts from QuickBooks: {response.text}")
        
    data = response.json()
    return data.get('QueryResponse', {}).get('Account', [])

def sync_qbo_accounts_to_db():
    """Sync QBO accounts to local DB mapping."""
    qbo_accounts = fetch_qbo_accounts()
    
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # simple matching strategy: match by name or account number
        mapped_count: int = 0
        added_count: int = 0
        
        # We need a robust mapping depending on your POS accounting structure. 
        # For now, we find local accounts with the exact same name or number and link them.
        for qbo_acc in qbo_accounts:
            qbo_id = qbo_acc.get('Id')
            qbo_name = qbo_acc.get('Name')
            qbo_number = qbo_acc.get('AcctNum')
            qbo_type = qbo_acc.get('AccountType')
            qbo_subtype = qbo_acc.get('AccountSubType')
            
            # Check if we already have it mapped
            cursor.execute("SELECT account_id FROM accounting.accounts WHERE qbo_id = %s", (qbo_id,))
            if cursor.fetchone():
                continue # Already mapped
                
            # Try to match by number or name
            matched_id = None
            if qbo_number:
                cursor.execute("SELECT account_id FROM accounting.accounts WHERE account_number = %s AND qbo_id IS NULL", (qbo_number,))
                row = cursor.fetchone()
                if row:
                    matched_id = row['account_id']
            
            if not matched_id and qbo_name:
                cursor.execute("SELECT account_id FROM accounting.accounts WHERE name ILIKE %s AND qbo_id IS NULL", (qbo_name,))
                row = cursor.fetchone()
                if row:
                    matched_id = row['account_id']
                    
            if matched_id:
                # Update map
                cursor.execute("UPDATE accounting.accounts SET qbo_id = %s WHERE account_id = %s", (qbo_id, matched_id))
                mapped_count += 1
            else:
                # If no match is found, perhaps we create a new account in our DB? 
                # Depends on DB requirements. Skipping auto-create for now to be safe, 
                # or we could insert it if we have all required fields.
                # Here we just log it or skip.
                pass
                
        conn.commit()
        return {'success': True, 'mapped_count': mapped_count, 'added_count': added_count, 'message': f'Successfully mapped {mapped_count} accounts.'}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()
