import dns.resolver
import aiosmtplib
from typing import Dict, Any, List, Optional
import re
import json
import sys
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EmailValidator:
    def __init__(self):
        self.corporate_domains = {
            'amazon.com', 'microsoft.com', 'google.com', 'apple.com',
            'facebook.com', 'meta.com', 'netflix.com', 'oracle.com',
            'salesforce.com', 'ibm.com', 'intel.com', 'cisco.com',
            'adobe.com', 'vmware.com', 'sap.com'
        }

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

    def verify_email(self, email: str) -> Dict[str, Any]:
        try:
            logger.info(f"Verifying email: {email}")
            if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
                return self._create_error_result(email, "Invalid email format")

            local_part, domain = email.split('@')

            # Check MX records
            try:
                mx_records = dns.resolver.resolve(domain, 'MX')
                mx_record = str(mx_records[0].exchange)
                mx_found = "Yes"
            except Exception as e:
                logger.error(f"MX record error for {domain}: {str(e)}")
                return self._create_error_result(email, "No valid MX records found")

            # Extract name information
            name_info = self.extract_name_from_email(local_part)

            # Check if it's a corporate domain
            is_corporate = domain.lower() in self.corporate_domains

            # For demo purposes, we'll consider corporate domains as valid
            if is_corporate:
                logger.info(f"Corporate domain detected: {domain}")
                return {
                    'email': email,
                    'status': 'valid',
                    'subStatus': 'corporate_domain',
                    'freeEmail': "No",
                    'didYouMean': "",
                    'account': local_part,
                    'domain': domain,
                    'domainAgeDays': "Unknown",
                    'smtpProvider': mx_record.split('.')[0],
                    'mxFound': mx_found,
                    'mxRecord': mx_record,
                    'firstName': name_info['firstName'],
                    'lastName': name_info['lastName'],
                    'message': "Valid corporate email address",
                    'isValid': True
                }

            # For non-corporate domains, perform basic validation
            logger.info(f"Regular domain validation: {domain}")
            return {
                'email': email,
                'status': 'valid',
                'subStatus': None,
                'freeEmail': "Yes",
                'didYouMean': "",
                'account': local_part,
                'domain': domain,
                'domainAgeDays': "Unknown",
                'smtpProvider': mx_record.split('.')[0],
                'mxFound': mx_found,
                'mxRecord': mx_record,
                'firstName': name_info['firstName'],
                'lastName': name_info['lastName'],
                'message': "Valid email address",
                'isValid': True
            }

        except Exception as e:
            logger.error(f"Error validating email {email}: {str(e)}")
            return self._create_error_result(email, str(e))

    def _create_error_result(self, email: str, error_message: str) -> Dict[str, Any]:
        try:
            account = email.split('@')[0] if '@' in email else email
            domain = email.split('@')[1] if '@' in email else "Unknown"
            name_info = self.extract_name_from_email(account)
        except Exception:
            account = "Unknown"
            domain = "Unknown"
            name_info = {'firstName': 'Unknown', 'lastName': 'Unknown'}

        return {
            'email': email,
            'status': "invalid",
            'subStatus': "validation_error",
            'freeEmail': "Unknown",
            'didYouMean': "",
            'account': account,
            'domain': domain,
            'domainAgeDays': "Unknown",
            'smtpProvider': "Unknown",
            'mxFound': "No",
            'mxRecord': None,
            'firstName': name_info['firstName'],
            'lastName': name_info['lastName'],
            'message': error_message,
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
            # Default test emails if no input provided
            emails = [
                "test@example.com",
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