#!/usr/bin/env python3
"""
SMS Service: Email-to-SMS (FREE) with AWS SNS migration path
Supports multiple stores, each with their own provider configuration
"""

import smtplib
from email.mime.text import MIMEText
from typing import Optional, Dict, Any
import re
from database import get_connection

class EmailToAWSSMSService:
    """SMS service: Start with email (free), migrate to AWS SNS"""
    
    def __init__(self):
        pass
        
        # Carrier email-to-SMS gateways (US carriers)
        self.carrier_gateways = {
            'att': '@txt.att.net',
            'verizon': '@vtext.com',
            'tmobile': '@tmomail.net',
            'sprint': '@messaging.sprintpcs.com',
            'boost': '@sms.myboostmobile.com',
            'cricket': '@sms.cricketwireless.net',
            'uscellular': '@email.uscc.net',
            'virgin': '@vmobl.com',
            'metropcs': '@mymetropcs.com',
            'googlefi': '@msg.fi.google.com'
        }
    
    def get_store_sms_settings(self, store_id: int) -> Optional[Dict[str, Any]]:
        """Get SMS settings for a store"""
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM sms_settings 
            WHERE store_id = %s AND is_active = 1
        """, (store_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    def clean_phone_number(self, phone_number: str) -> str:
        """Clean phone number to digits only"""
        return ''.join(filter(str.isdigit, phone_number))
    
    def send_via_email(self, phone_number: str, message: str, settings: Dict) -> Dict[str, Any]:
        """Send SMS via email-to-SMS gateways (FREE)"""
        phone_clean = self.clean_phone_number(phone_number)
        
        if len(phone_clean) != 10:
            return {'success': False, 'error': 'US phone numbers must be 10 digits'}
        
        # Try all major carrier gateways
        gateways_to_try = [
            f'{phone_clean}{self.carrier_gateways["att"]}',
            f'{phone_clean}{self.carrier_gateways["verizon"]}',
            f'{phone_clean}{self.carrier_gateways["tmobile"]}',
            f'{phone_clean}{self.carrier_gateways["sprint"]}',
        ]
        
        smtp_server = settings.get('smtp_server', 'smtp.gmail.com')
        smtp_port = settings.get('smtp_port', 587)
        smtp_user = settings.get('smtp_user')
        smtp_password = settings.get('smtp_password')
        use_tls = settings.get('smtp_use_tls', 1)
        
        if not smtp_user or not smtp_password:
            return {'success': False, 'error': 'SMTP credentials not configured'}
        
        # Truncate message to 160 chars (SMS limit)
        message_short = message[:160] if len(message) > 160 else message
        
        last_error = None
        for email_address in gateways_to_try:
            try:
                msg = MIMEText(message_short)
                msg['From'] = smtp_user
                msg['To'] = email_address
                msg['Subject'] = ''  # Some carriers ignore subject
                
                server = smtplib.SMTP(smtp_server, smtp_port)
                if use_tls:
                    server.starttls()
                server.login(smtp_user, smtp_password)
                server.send_message(msg)
                server.quit()
                
                # If we get here, it worked (no exception)
                return {
                    'success': True,
                    'provider': 'email',
                    'gateway_used': email_address,
                    'note': 'Email-to-SMS sent (no delivery confirmation available)'
                }
                
            except smtplib.SMTPAuthenticationError as e:
                last_error = f'SMTP authentication failed: {str(e)}'
                break  # Don't try other gateways if auth fails
            except Exception as e:
                last_error = f'Gateway {email_address} failed: {str(e)}'
                continue  # Try next gateway
        
        return {
            'success': False,
            'error': last_error or 'All email gateways failed',
            'provider': 'email'
        }
    
    def send_via_aws_sns(self, phone_number: str, message: str, settings: Dict) -> Dict[str, Any]:
        """Send SMS via AWS SNS (~$0.00645/SMS - very cheap)"""
        try:
            import boto3
            from botocore.exceptions import ClientError
            
            sns = boto3.client(
                'sns',
                aws_access_key_id=settings['aws_access_key_id'],
                aws_secret_access_key=settings['aws_secret_access_key'],
                region_name=settings.get('aws_region', 'us-east-1')
            )
            
            # Format phone number for AWS (E.164 format)
            phone_clean = self.clean_phone_number(phone_number)
            if len(phone_clean) == 10:
                phone_e164 = f'+1{phone_clean}'  # US number
            elif phone_clean.startswith('1') and len(phone_clean) == 11:
                phone_e164 = f'+{phone_clean}'
            else:
                phone_e164 = f'+{phone_clean}'
            
            response = sns.publish(
                PhoneNumber=phone_e164,
                Message=message
            )
            
            return {
                'success': True,
                'provider': 'aws_sns',
                'provider_sid': response.get('MessageId'),
                'note': 'AWS SNS - delivery confirmation available'
            }
            
        except ImportError:
            return {'success': False, 'error': 'boto3 not installed. Run: pip install boto3', 'provider': 'aws_sns'}
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_msg = e.response['Error']['Message']
            return {'success': False, 'error': f'AWS Error ({error_code}): {error_msg}', 'provider': 'aws_sns'}
        except Exception as e:
            return {'success': False, 'error': str(e), 'provider': 'aws_sns'}
    
    def send_sms(self, store_id: int, phone_number: str, message: str,
                 customer_id: Optional[int] = None,
                 message_type: str = 'manual',
                 employee_id: Optional[int] = None) -> Dict[str, Any]:
        """Send SMS using store's configured provider"""
        
        # Get store settings
        settings = self.get_store_sms_settings(store_id)
        if not settings:
            return {'success': False, 'error': 'SMS not configured for this store'}
        
        # Check opt-out
        if self.is_opted_out(phone_number, store_id):
            return {'success': False, 'error': 'Phone number has opted out'}
        
        # Save to database first
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO sms_messages (
                store_id, customer_id, phone_number, message_text,
                direction, status, message_type, provider, created_by
            ) VALUES (%s, %s, %s, %s, 'outbound', 'pending', %s, %s, %s)
            RETURNING message_id
        """, (store_id, customer_id, phone_number, message, message_type, settings['sms_provider'], employee_id))
        message_id = cursor.fetchone()[0]
        conn.commit()
        
        # Send via configured provider
        provider = settings.get('sms_provider', 'email')
        result = None
        
        if provider == 'email':
            result = self.send_via_email(phone_number, message, settings)
        elif provider == 'aws_sns':
            if not settings.get('aws_access_key_id'):
                result = {'success': False, 'error': 'AWS credentials not configured'}
            else:
                result = self.send_via_aws_sns(phone_number, message, settings)
        else:
            result = {'success': False, 'error': f'Provider {provider} not implemented yet'}
        
        # Update message status
        if result.get('success'):
            cursor.execute("""
                UPDATE sms_messages SET
                    status = 'sent',
                    provider_sid = %s,
                    sent_at = CURRENT_TIMESTAMP
                WHERE message_id = %s
            """, (result.get('provider_sid') or result.get('gateway_used'), message_id))
        else:
            cursor.execute("""
                UPDATE sms_messages SET
                    status = 'failed',
                    error_message = %s
                WHERE message_id = %s
            """, (result.get('error'), message_id))
        
        conn.commit()
        conn.close()
        
        result['message_id'] = message_id
        return result
    
    def is_opted_out(self, phone_number: str, store_id: Optional[int] = None) -> bool:
        """Check if phone number has opted out"""
        conn = get_connection()
        cursor = conn.cursor()
        
        if store_id:
            cursor.execute("""
                SELECT opt_out_id FROM sms_opt_outs
                WHERE phone_number = %s AND (store_id = %s OR store_id IS NULL)
            """, (phone_number, store_id))
        else:
            cursor.execute("""
                SELECT opt_out_id FROM sms_opt_outs
                WHERE phone_number = %s
            """, (phone_number,))
        
        result = cursor.fetchone()
        conn.close()
        return result is not None
    
    def send_rewards_earned_message(self, store_id: int, customer_id: int,
                                   points_earned: int, total_points: int) -> Dict[str, Any]:
        """Send automated rewards earned message"""
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT customer_name, phone FROM customers WHERE customer_id = %s", (customer_id,))
        customer = cursor.fetchone()
        conn.close()
        
        if not customer or not customer['phone']:
            return {'success': False, 'error': 'Customer phone not found'}
        
        # Get template or use default
        template = self.get_rewards_template(store_id, 'rewards_earned')
        message = template.format(
            customer_name=customer['customer_name'] or 'Valued Customer',
            points_earned=points_earned,
            total_points=total_points
        )
        
        return self.send_sms(
            store_id=store_id,
            phone_number=customer['phone'],
            message=message,
            customer_id=customer_id,
            message_type='rewards_earned'
        )
    
    def get_rewards_template(self, store_id: int, template_type: str) -> str:
        """Get template for rewards messages"""
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT template_text FROM sms_templates
            WHERE store_id = %s AND category = 'rewards'
            AND template_name LIKE %s AND is_active = 1
            LIMIT 1
        """, (store_id, f'%{template_type}%'))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return row['template_text'] if isinstance(row, dict) else row[0]
        
        # Default templates
        defaults = {
            'rewards_earned': "Hi {customer_name}! You earned {points_earned} points! You now have {total_points} total points. Thanks for shopping with us!",
            'rewards_redeemed': "Hi {customer_name}! You redeemed {points_used} points for {reward_name}. You have {remaining_points} points remaining.",
            'birthday': "Happy Birthday {customer_name}! Enjoy {points_earned} bonus points on us! 🎉"
        }
        
        return defaults.get(template_type, "Hi {customer_name}! {message}")
    
    def migrate_to_aws(self, store_id: int, aws_access_key: str, aws_secret: str, region: str = 'us-east-1') -> Dict[str, Any]:
        """Helper to migrate store from email to AWS SNS"""
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE sms_settings SET
                sms_provider = 'aws_sns',
                aws_access_key_id = %s,
                aws_secret_access_key = %s,
                aws_region = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE store_id = %s
        """, (aws_access_key, aws_secret, region, store_id))
        conn.commit()
        conn.close()
        return {'success': True, 'message': f'Store {store_id} migrated to AWS SNS'}
