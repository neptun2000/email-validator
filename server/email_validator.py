import dns.resolver
import aiosmtplib
from typing import Dict, Any, List, Optional
import re
import json
import sys
import logging
import socket
from smtplib import SMTP

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EmailValidator:
    def __init__(self):
        # Corporate domains list
        self.corporate_domains = {
            'amazon.com', 'microsoft.com', 'google.com', 'apple.com',
            'facebook.com', 'meta.com', 'netflix.com', 'oracle.com',
            'salesforce.com', 'ibm.com', 'intel.com', 'cisco.com',
            'adobe.com', 'vmware.com', 'sap.com'
        }

        # Common public email providers
        self.public_email_domains = {
            'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
            'aol.com', 'icloud.com', 'protonmail.com', 'mail.com',
            'yandex.com', 'yandex.ru', 'zoho.com', 'live.com'
        }

        # Common disposable email domains
        self.disposable_domains = {
            'temp-mail.org', 'tempmail.com', 'disposablemail.com', 
            'mailinator.com', 'guerrillamail.com', 'sharklasers.com',
            'throwawaymail.com', '10minutemail.com', 'tempinbox.com',
            'yopmail.com', 'tempr.email', 'temp-mail.io', 'fake-email.com'
        }

    def is_public_email_domain(self, domain: str) -> bool:
        """Check if the email domain is a common public email provider"""
        return domain.lower() in self.public_email_domains

    def is_corporate_domain(self, domain: str) -> bool:
        """Check if the email domain is a corporate domain"""
        return domain.lower() in self.corporate_domains

    def extract_name_from_email(self, account: str) -> Dict[str, str]:
        name_parts = re.sub(r'[._]', ' ', account).split()
        name_parts = [part.capitalize() for part in name_parts if part]

        if len(name_parts) >= 2:
            return {
                'firstName': name_parts[0],
                'lastName': ' '.join(name_parts[1:])
            }
        return {
            'firstName': name_parts[0] if name_parts else 'Unknown',
            'lastName': 'Unknown'
        }

    def verify_smtp(self, email: str, domain: str, mx_record: str) -> bool:
        """Verify email existence using SMTP check"""
        try:
            smtp = SMTP(timeout=10)
            smtp.set_debuglevel(0)

            smtp.connect(mx_record)
            smtp.helo('test.com')

            smtp_from = "test@test.com"
            code, _ = smtp.mail(smtp_from)
            if code != 250:
                return False

            code, _ = smtp.rcpt(email)
            smtp.quit()

            return code == 250

        except Exception as e:
            logger.error(f"SMTP verification failed for {email}: {str(e)}")
            return False

    def verify_email(self, email: str) -> Dict[str, Any]:
        try:
            logger.info(f"Verifying email: {email}")

            if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
                return {
                    'email': email,
                    'status': "invalid",
                    'subStatus': "invalid_format",
                    'freeEmail': "Unknown",
                    'didYouMean': "",
                    'account': "Unknown",
                    'domain': "Unknown",
                    'domainAgeDays': "Unknown",
                    'smtpProvider': "Unknown",
                    'mxFound': "No",
                    'mxRecord': None,
                    'firstName': "Unknown",
                    'lastName': "Unknown",
                    'message': "Invalid email format",
                    'isValid': False
                }

            local_part, domain = email.split('@')
            name_info = self.extract_name_from_email(local_part)

            # Determine domain type
            is_corporate = self.is_corporate_domain(domain)
            is_public = self.is_public_email_domain(domain)

            if is_corporate:
                domain_type = "Corporate"
            elif is_public:
                domain_type = "Public Email Provider"
            else:
                domain_type = "Other"

            # Check MX records
            try:
                mx_records = dns.resolver.resolve(domain, 'MX')
                mx_record = str(mx_records[0].exchange)
                mx_found = "Yes"
            except Exception as e:
                logger.error(f"MX record error for {domain}: {str(e)}")
                return {
                    'email': email,
                    'status': "invalid",
                    'subStatus': "no_mx_record",
                    'freeEmail': "Yes" if is_public else "No",
                    'didYouMean': "",
                    'account': local_part,
                    'domain': domain,
                    'domainAgeDays': "Unknown",
                    'smtpProvider': "Unknown",
                    'mxFound': "No",
                    'mxRecord': None,
                    'firstName': name_info['firstName'],
                    'lastName': name_info['lastName'],
                    'message': f"No valid MX records found (Domain Type: {domain_type})",
                    'isValid': False
                }

            # Verify email existence using SMTP
            email_exists = self.verify_smtp(email, domain, mx_record)

            if not email_exists:
                return {
                    'email': email,
                    'status': "invalid",
                    'subStatus': "nonexistent",
                    'freeEmail': "Yes" if is_public else "No",
                    'didYouMean': "",
                    'account': local_part,
                    'domain': domain,
                    'domainAgeDays': "Unknown",
                    'smtpProvider': mx_record.split('.')[0],
                    'mxFound': mx_found,
                    'mxRecord': mx_record,
                    'firstName': name_info['firstName'],
                    'lastName': name_info['lastName'],
                    'message': f"Email address does not exist (Domain Type: {domain_type})",
                    'isValid': False
                }

            return {
                'email': email,
                'status': "valid",
                'subStatus': domain_type.lower().replace(" ", "_"),
                'freeEmail': "Yes" if is_public else "No",
                'didYouMean': "",
                'account': local_part,
                'domain': domain,
                'domainAgeDays': "Unknown",
                'smtpProvider': mx_record.split('.')[0],
                'mxFound': mx_found,
                'mxRecord': mx_record,
                'firstName': name_info['firstName'],
                'lastName': name_info['lastName'],
                'message': f"Valid email address (Domain Type: {domain_type})",
                'isValid': True
            }

        except Exception as e:
            logger.error(f"Error validating email {email}: {str(e)}")
            return {
                'email': email,
                'status': "invalid",
                'subStatus': "validation_error",
                'freeEmail': "Unknown",
                'didYouMean': "",
                'account': local_part if 'local_part' in locals() else "Unknown",
                'domain': domain if 'domain' in locals() else "Unknown",
                'domainAgeDays': "Unknown",
                'smtpProvider': "Unknown",
                'mxFound': "No",
                'mxRecord': None,
                'firstName': "Unknown",
                'lastName': "Unknown",
                'message': str(e),
                'isValid': False
            }

    def validate_emails(self, emails: List[str]) -> List[Dict[str, Any]]:
        return [self.verify_email(email) for email in emails]

# Command-line interface for testing
if __name__ == "__main__":
    try:
        if len(sys.argv) > 1:
            emails = json.loads(sys.argv[1])
            logger.info(f"Processing {len(emails)} emails")
        else:
            emails = [
                "test@hotmail.com",
                "user@google.com",
                "invalid.email",
                "employee@microsoft.com"
            ]
            logger.info("Using default test emails")

        validator = EmailValidator()
        results = validator.validate_emails(emails)
        print(json.dumps(results))

    except Exception as e:
        logger.error(f"Main execution error: {str(e)}")
        print(json.dumps([{
            'email': 'error',
            'status': 'error',
            'message': f'Script execution failed: {str(e)}',
            'isValid': False
        }]))