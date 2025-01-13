import dns.resolver
from typing import Dict, Any, List, Optional, Tuple
import re
import json
import sys
import logging
from smtplib import SMTP

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EmailValidator:
    def __init__(self):
        # Common public email domains 
        self.public_email_domains = {
            'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
            'aol.com', 'icloud.com', 'protonmail.com', 'mail.com',
            'yandex.com', 'yandex.ru', 'zoho.com', 'live.com',
            'msn.com', 'me.com', 'inbox.com', 'gmx.com', 'gmx.net'
        }

    def is_public_email_domain(self, domain: str) -> bool:
        """Check if the email domain is a common public email provider"""
        return domain.lower() in self.public_email_domains

    def check_mx_record(self, domain: str) -> Tuple[bool, Optional[str]]:
        """Check MX records for a domain"""
        try:
            resolver = dns.resolver.Resolver()
            resolver.timeout = 10
            resolver.lifetime = 10
            mx_records = resolver.resolve(domain, 'MX')

            if mx_records and len(mx_records) > 0:
                mx_host = str(mx_records[0].exchange).rstrip('.')
                logger.info(f"Found MX record for {domain}: {mx_host}")
                return True, mx_host

            logger.warning(f"No MX records found for {domain}")
            return False, None
        except Exception as e:
            logger.error(f"MX record error for {domain}: {str(e)}")
            return False, None

    def verify_smtp(self, email: str, mx_record: Optional[str]) -> bool:
        """Verify email existence using SMTP check"""
        try:
            if not mx_record:
                logger.warning(f"Cannot perform SMTP verification for {email} - no MX record")
                return False

            domain = email.split('@')[1].lower()
            # For public email providers, consider them valid if they have MX records
            if self.is_public_email_domain(domain):
                logger.info(f"Public email domain {domain} detected, skipping SMTP verification")
                return True

            # For other domains, attempt SMTP verification
            logger.info(f"Attempting SMTP verification for {email} using {mx_record}")

            with SMTP(timeout=10) as smtp:
                smtp.connect(mx_record, 25)
                smtp.helo('test.com')
                smtp.mail('test@test.com')
                code, _ = smtp.rcpt(email)
                smtp.quit()

                is_valid = code == 250
                logger.info(f"SMTP verification result for {email}: {is_valid} (code: {code})")
                return is_valid
        except Exception as e:
            logger.error(f"SMTP verification failed for {email}: {str(e)}")
            return False

    def verify_email(self, email: str) -> Dict[str, Any]:
        """Main email verification method"""
        try:
            logger.info(f"Starting verification for email: {email}")

            # Initialize validation factors
            format_valid = bool(re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email))
            mx_exists = False
            smtp_valid = False
            mx_record = None

            # Basic format check
            if not format_valid:
                logger.warning(f"Invalid email format: {email}")
                return {
                    'email': email,
                    'status': "INVALID (format)",
                    'message': "Invalid email format",
                    'isValid': False
                }

            # Split email into parts
            local_part, domain = email.split('@')

            # Check domain type
            is_public = self.is_public_email_domain(domain)

            # Check MX records
            mx_exists, mx_record = self.check_mx_record(domain)
            if mx_exists:
                smtp_valid = self.verify_smtp(email, mx_record)

            # Determine validity
            is_valid = mx_exists and (smtp_valid or (is_public and mx_exists))

            status = "VALID" if is_valid else "INVALID"
            if not mx_exists:
                status += " (no_mx_record)"
            elif not smtp_valid and not is_public:
                status += " (smtp_check_failed)"

            return {
                'email': email,
                'status': status,
                'message': f"{'Valid' if is_valid else 'Invalid'} email address",
                'domain': domain,
                'mxRecord': mx_record,
                'isValid': is_valid
            }

        except Exception as e:
            logger.error(f"Error validating email {email}: {str(e)}")
            return {
                'email': email,
                'status': "ERROR",
                'message': f"System error: {str(e)}",
                'domain': email.split('@')[1] if '@' in email else "Unknown",
                'mxRecord': None,
                'isValid': False
            }

    def validate_emails(self, emails: List[str]) -> List[Dict[str, Any]]:
        """Validate a list of email addresses"""
        return [self.verify_email(email) for email in emails]

if __name__ == "__main__":
    try:
        if len(sys.argv) > 1:
            emails = json.loads(sys.argv[1])
            logger.info(f"Processing {len(emails)} emails")
        else:
            emails = [
                'test@example.com',
                'user@gmail.com',
                'invalid.email',
                'employee@microsoft.com'
            ]
            logger.info("Using default test emails")

        validator = EmailValidator()
        results = validator.validate_emails(emails)
        print(json.dumps(results))

    except Exception as e:
        logger.error(f"Main execution error: {str(e)}")
        print(json.dumps([{
            'email': 'error',
            'status': 'ERROR',
            'message': f'Script execution failed: {str(e)}',
            'isValid': False
        }]))