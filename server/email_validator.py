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
        # Corporate domains list
        self.corporate_domains = {
            'amazon.com', 'microsoft.com', 'google.com', 'apple.com',
            'facebook.com', 'meta.com', 'netflix.com', 'oracle.com',
            'salesforce.com', 'ibm.com', 'intel.com', 'cisco.com',
            'adobe.com', 'vmware.com', 'sap.com'
        }

        # Common public email domains 
        self.public_email_domains = {
            'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
            'aol.com', 'icloud.com', 'protonmail.com', 'mail.com',
            'yandex.com', 'yandex.ru', 'zoho.com', 'live.com',
            'msn.com', 'me.com', 'inbox.com', 'gmx.com', 'gmx.net'
        }

    def is_corporate_domain(self, domain: str) -> bool:
        """Check if the email domain is a corporate domain"""
        domain = domain.lower()
        return domain in self.corporate_domains or domain.endswith('.edu') or domain.endswith('.gov')

    def is_public_email_domain(self, domain: str) -> bool:
        """Check if the email domain is a common public email provider"""
        return domain.lower() in self.public_email_domains

    def extract_name_from_email(self, account: str) -> Dict[str, str]:
        """Extract first and last name from email account part"""
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

    def check_mx_record(self, domain: str) -> Tuple[bool, Optional[str]]:
        """Check MX records for a domain"""
        try:
            resolver = dns.resolver.Resolver()
            resolver.timeout = 10
            resolver.lifetime = 10
            mx_records = resolver.resolve(domain, 'MX')

            if mx_records and len(mx_records) > 0:
                # Convert exchange to string and remove trailing dot
                mx_host = str(mx_records[0].exchange).rstrip('.')
                logger.info(f"Found MX record for {domain}: {mx_host}")
                return True, mx_host

            logger.warning(f"No MX records found for {domain}")
            return False, None
        except Exception as e:
            logger.error(f"MX record error for {domain}: {str(e)}")
            return False, None

    def check_dmarc_record(self, domain: str) -> bool:
        """Check if domain has DMARC record"""
        try:
            resolver = dns.resolver.Resolver()
            resolver.timeout = 10
            resolver.lifetime = 10
            dmarc_records = resolver.resolve(f'_dmarc.{domain}', 'TXT')

            has_dmarc = any('v=DMARC1' in str(record) for record in dmarc_records)
            logger.info(f"DMARC check for {domain}: {'Found' if has_dmarc else 'Not found'}")
            return has_dmarc
        except Exception as e:
            logger.error(f"DMARC check error for {domain}: {str(e)}")
            return False

    def verify_smtp(self, email: str, mx_record: Optional[str]) -> bool:
        """Verify email existence using SMTP check"""
        try:
            if not mx_record:
                logger.warning(f"Cannot perform SMTP verification for {email} - no MX record")
                return False

            domain = email.split('@')[1].lower()
            # For public email providers, consider them valid if they have MX records
            # as they usually block SMTP verification attempts
            if self.is_public_email_domain(domain):
                logger.info(f"Public email domain {domain} detected, skipping SMTP verification")
                return True

            # For corporate and other domains, attempt SMTP verification
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
            # For public email providers, consider valid even if SMTP check fails
            if self.is_public_email_domain(domain):
                logger.info(f"Considering {domain} valid despite SMTP failure as it's a public provider")
                return True
            return False

    def calculate_confidence(self,
                           format_valid: bool,
                           mx_exists: bool,
                           smtp_valid: bool,
                           is_known_domain: bool,
                           has_dmarc: bool,
                           is_public_email: bool) -> float:
        """Calculate confidence score based on multiple validation factors"""
        try:
            confidence = 0.0

            # Format validation (25%)
            if format_valid:
                confidence += 25.0

            # MX record check (25%)
            if mx_exists:
                confidence += 25.0

            # SMTP verification or public email provider (30%)
            if smtp_valid or (is_public_email and mx_exists):
                confidence += 30.0

            # Domain reputation (10%)
            if is_known_domain:
                confidence += 10.0

            # DMARC policy existence (10%)
            if has_dmarc:
                confidence += 10.0

            logger.info(f"Confidence calculation: {confidence}% "
                       f"(format:{format_valid}, mx:{mx_exists}, smtp:{smtp_valid}, "
                       f"known:{is_known_domain}, dmarc:{has_dmarc}, public:{is_public_email})")
            return round(confidence, 1)
        except Exception as e:
            logger.error(f"Error calculating confidence: {str(e)}")
            return 0.0

    def verify_email(self, email: str) -> Dict[str, Any]:
        """Main email verification method"""
        try:
            logger.info(f"Starting verification for email: {email}")

            # Initialize validation factors
            format_valid = bool(re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email))
            mx_exists = False
            smtp_valid = False
            has_dmarc = False
            mx_record = None
            confidence = 0.0

            # Basic format check
            if not format_valid:
                logger.warning(f"Invalid email format: {email}")
                return {
                    'email': email,
                    'status': "invalid",
                    'subStatus': "invalid_format",
                    'confidence': confidence,
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

            # Split email into parts
            local_part, domain = email.split('@')
            name_info = self.extract_name_from_email(local_part)

            # Check domain type
            is_public = self.is_public_email_domain(domain)
            is_corporate = self.is_corporate_domain(domain) if not is_public else False
            is_known_domain = is_public or is_corporate
            domain_type = "Public Email Provider" if is_public else ("Corporate" if is_corporate else "Other")

            # Check MX records and DMARC
            mx_exists, mx_record = self.check_mx_record(domain)
            if mx_exists:
                has_dmarc = self.check_dmarc_record(domain)
                smtp_valid = self.verify_smtp(email, mx_record)

            # Calculate confidence score based on all factors
            confidence = self.calculate_confidence(
                format_valid=format_valid,
                mx_exists=mx_exists,
                smtp_valid=smtp_valid,
                is_known_domain=is_known_domain,
                has_dmarc=has_dmarc,
                is_public_email=is_public
            )

            # For public email providers with valid MX records, consider them valid
            is_valid = mx_exists and (smtp_valid or (is_public and mx_exists))

            logger.info(f"Validation complete for {email}: valid={is_valid}, confidence={confidence}%")

            return {
                'email': email,
                'status': "valid" if is_valid else "invalid",
                'subStatus': domain_type.lower().replace(" ", "_"),
                'confidence': confidence,
                'freeEmail': "Yes" if is_public else "No",
                'didYouMean': "",
                'account': local_part,
                'domain': domain,
                'domainAgeDays': "Unknown",
                'smtpProvider': mx_record.split('.')[0] if mx_record else "Unknown",
                'mxFound': "Yes" if mx_exists else "No",
                'mxRecord': mx_record,
                'firstName': name_info['firstName'],
                'lastName': name_info['lastName'],
                'message': f"{'Valid' if is_valid else 'Invalid'} email address (Domain Type: {domain_type})",
                'isValid': is_valid
            }

        except Exception as e:
            logger.error(f"Error validating email {email}: {str(e)}")
            return {
                'email': email,
                'status': "error",
                'subStatus': "system_error",
                'confidence': 0.0,
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
                'message': f"System error: {str(e)}",
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
                'user@gmail.com',  # Public email provider
                'invalid.email',
                'employee@microsoft.com'  # Corporate domain
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
            'isValid': False,
            'confidence': 0.0
        }]))