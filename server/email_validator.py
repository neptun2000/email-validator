import asyncio
import dns.resolver
import aiosmtplib
from typing import Dict, Any, List, Optional
import re
import json

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

    async def verify_email(self, email: str) -> Dict[str, Any]:
        try:
            if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
                return self._create_error_result(email, "Invalid email format")

            local_part, domain = email.split('@')
            
            # Check MX records
            try:
                mx_records = dns.resolver.resolve(domain, 'MX')
                mx_record = str(mx_records[0].exchange)
                mx_found = "Yes"
            except Exception:
                return self._create_error_result(email, "No valid MX records found")

            # Extract name information
            name_info = self.extract_name_from_email(local_part)
            
            # Check if it's a corporate domain
            is_corporate = domain.lower() in self.corporate_domains
            
            # For demo purposes, we'll consider corporate domains as valid
            if is_corporate:
                return {
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
            return {
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
            return self._create_error_result(email, str(e))

    def _create_error_result(self, email: str, error_message: str) -> Dict[str, Any]:
        account = email.split('@')[0] if '@' in email else email
        name_info = self.extract_name_from_email(account)
        
        return {
            'status': "invalid",
            'subStatus': "validation_error",
            'freeEmail': "Unknown",
            'didYouMean': "",
            'account': account,
            'domain': email.split('@')[1] if '@' in email else "Unknown",
            'domainAgeDays': "Unknown",
            'smtpProvider': "Unknown",
            'mxFound': "No",
            'mxRecord': None,
            'firstName': name_info['firstName'],
            'lastName': name_info['lastName'],
            'message': error_message,
            'isValid': False
        }

    async def validate_emails(self, emails: List[str]) -> List[Dict[str, Any]]:
        tasks = [self.verify_email(email) for email in emails]
        return await asyncio.gather(*tasks)

# Command-line interface for testing
if __name__ == "__main__":
    async def main():
        validator = EmailValidator()
        test_emails = [
            "test@example.com",
            "user@google.com",
            "invalid.email",
            "employee@microsoft.com"
        ]
        results = await validator.validate_emails(test_emails)
        print(json.dumps(results, indent=2))

    asyncio.run(main())
