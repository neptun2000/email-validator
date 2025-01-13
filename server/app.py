from typing import List, Optional
from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, validator
from email_validator import validate_email as validate_email_lib, EmailNotValidError
import dns.resolver
import asyncio
from pathlib import Path
import re

app = FastAPI(title="Email Validation Platform")

# Configure template and static directories
base_dir = Path(__file__).parent
templates_dir = base_dir / "templates"
static_dir = base_dir / "static"

# Ensure directories exist
templates_dir.mkdir(exist_ok=True)
static_dir.mkdir(exist_ok=True)

# Setup templates and static files
templates = Jinja2Templates(directory=str(templates_dir))
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class EmailRequest(BaseModel):
    email: str

class EmailsRequest(BaseModel):
    emails: List[str]

    @validator('emails')
    def validate_email_count(cls, v):
        if len(v) > 100:
            raise ValueError('Maximum 100 emails per request')
        return v

class ValidationResult(BaseModel):
    status: str
    subStatus: Optional[str] = None
    freeEmail: str
    didYouMean: str
    account: str
    domain: str
    domainAgeDays: str
    smtpProvider: str
    mxFound: str
    mxRecord: Optional[str]
    firstName: Optional[str]
    lastName: Optional[str]
    message: str
    isValid: bool
    confidence: float
    disposable: bool
    dmarcPolicy: Optional[str] = None

# Known email providers
FREE_EMAIL_PROVIDERS = {
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
    'aol.com', 'mail.com', 'protonmail.com', 'icloud.com', 'yandex.com',
    'zoho.com', 'gmx.com', 'msn.com'
}

DISPOSABLE_EMAIL_DOMAINS = {
    'tempmail.com', 'throwawaymail.com', 'mailinator.com', '10minutemail.com',
    'guerrillamail.com', 'sharklasers.com', 'getairmail.com', 'yopmail.com',
    'tempmail.net', 'temp-mail.org', 'fakeinbox.com', 'trash-mail.com'
}

# Validation functions
async def check_dmarc_policy(domain: str) -> Optional[str]:
    """Check DMARC policy for a domain"""
    try:
        dmarc_domain = f"_dmarc.{domain}"
        dmarc_records = dns.resolver.resolve(dmarc_domain, 'TXT')
        for record in dmarc_records:
            for string in record.strings:
                dmarc_record = string.decode('utf-8')
                if dmarc_record.startswith('v=DMARC1'):
                    match = re.search(r'p=(\w+)', dmarc_record)
                    if match:
                        return match.group(1)
        return None
    except Exception:
        return None

async def validate_single_email(email: str) -> ValidationResult:
    """Validate a single email address with comprehensive checks"""
    try:
        # First validate the email format
        validation = validate_email_lib(email, check_deliverability=False)
        email = validation.normalized
        domain = validation.domain.lower()
        account = validation.local_part

        # Check if it's a disposable email
        is_disposable = domain in DISPOSABLE_EMAIL_DOMAINS
        is_free_email = domain in FREE_EMAIL_PROVIDERS

        try:
            # Check MX records
            mx_records = dns.resolver.resolve(domain, 'MX')
            mx_record = str(mx_records[0].exchange) if mx_records else None
            has_mx = bool(mx_record)

            # Check DMARC policy
            dmarc_policy = await check_dmarc_policy(domain)

            # Calculate confidence score
            confidence = 80 if has_mx else 20
            if domain in FREE_EMAIL_PROVIDERS:
                confidence = 95  # Higher confidence for well-known providers
            if is_disposable:
                confidence = 10  # Very low confidence for disposable emails
            if dmarc_policy:
                confidence += 5  # Bonus for having DMARC policy

            # Determine status
            if is_disposable:
                status = "invalid"
                sub_status = "disposable_email"
                message = "Disposable email addresses are not allowed"
                is_valid = False
            elif not has_mx:
                status = "invalid"
                sub_status = "no_mx_record"
                message = "Domain has no valid MX records"
                is_valid = False
            else:
                status = "valid"
                sub_status = None
                is_valid = True
                message = "Valid free email provider" if is_free_email else "Valid corporate email"

            return ValidationResult(
                status=status,
                subStatus=sub_status,
                freeEmail="Yes" if is_free_email else "No",
                didYouMean="",
                account=account,
                domain=domain,
                domainAgeDays="Unknown",
                smtpProvider=mx_record.split('.')[0] if mx_record else "Unknown",
                mxFound="Yes" if has_mx else "No",
                mxRecord=mx_record,
                firstName=None,
                lastName=None,
                message=message,
                isValid=is_valid,
                confidence=confidence,
                disposable=is_disposable,
                dmarcPolicy=dmarc_policy
            )

        except dns.resolver.NXDOMAIN:
            return ValidationResult(
                status="invalid",
                subStatus="domain_not_found",
                freeEmail="No",
                didYouMean="",
                account=account,
                domain=domain,
                domainAgeDays="Unknown",
                smtpProvider="Unknown",
                mxFound="No",
                mxRecord=None,
                firstName=None,
                lastName=None,
                message="Domain does not exist",
                isValid=False,
                confidence=0,
                disposable=False,
                dmarcPolicy=None
            )

    except EmailNotValidError as e:
        domain = email.split('@')[1].lower() if '@' in email else "unknown"
        return ValidationResult(
            status="invalid",
            subStatus="format_error",
            freeEmail="Unknown",
            didYouMean="",
            account=email.split('@')[0] if '@' in email else email,
            domain=domain,
            domainAgeDays="Unknown",
            smtpProvider="Unknown",
            mxFound="Unknown",
            mxRecord=None,
            firstName=None,
            lastName=None,
            message=str(e),
            isValid=False,
            confidence=0,
            disposable=False,
            dmarcPolicy=None
        )

# Routes
@app.get("/")
async def home(request: Request):
    """Render the main page"""
    return templates.TemplateResponse("email_validator.html", {"request": request})

@app.post("/validate")
async def validate_email_form(request: Request, email: str = Form(...)):
    """Handle form submission and validate single email"""
    result = await validate_single_email(email)
    return templates.TemplateResponse("email_validator.html", {
        "request": request,
        "result": result,
        "email": email
    })

@app.post("/validate-bulk")
async def validate_bulk_emails_form(request: Request, emails: str = Form(...)):
    """Handle bulk email validation form submission"""
    # Split emails by newline or comma and clean them
    email_list = [email.strip() for email in emails.replace(',', '\n').split('\n') if email.strip()]

    # Limit to 100 emails
    email_list = email_list[:100]

    # Validate all emails
    tasks = [validate_single_email(email) for email in email_list]
    bulk_results = await asyncio.gather(*tasks)

    return templates.TemplateResponse("email_validator.html", {
        "request": request,
        "bulk_results": bulk_results,
        "emails": emails
    })

@app.post("/api/validate-email")
async def validate_email_api(request: EmailRequest) -> ValidationResult:
    """Validate a single email address via API"""
    return await validate_single_email(request.email)

@app.post("/api/validate-emails")
async def validate_multiple_emails(request: EmailsRequest) -> List[ValidationResult]:
    """Validate multiple email addresses (max 100 per request)"""
    tasks = [validate_single_email(email) for email in request.emails]
    return await asyncio.gather(*tasks)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)