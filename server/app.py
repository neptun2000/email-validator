from typing import List, Optional
from fastapi import FastAPI, Request, Form
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, validator
from email_validator import validate_email as validate_email_lib, EmailNotValidError
import dns.resolver
import asyncio
from pathlib import Path

app = FastAPI(title="Email Validation Platform")
templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# Updated free email providers list
FREE_EMAIL_PROVIDERS = {
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'live.com',
    'aol.com',
    'mail.com',
    'protonmail.com',
    'icloud.com',
    'yandex.com',
    'zoho.com',
    'gmx.com',
    'msn.com'
}

async def validate_single_email(email: str) -> ValidationResult:
    try:
        # First validate the email format
        validation = validate_email_lib(email, check_deliverability=False)
        email = validation.normalized
        domain = validation.domain.lower()
        account = validation.local_part

        # Determine email provider type
        is_free_email = domain in FREE_EMAIL_PROVIDERS

        try:
            # Check MX records
            mx_records = dns.resolver.resolve(domain, 'MX')
            mx_record = str(mx_records[0].exchange) if mx_records else None
            has_mx = bool(mx_record)

            # Calculate confidence score
            confidence = 80 if has_mx else 20
            if domain in FREE_EMAIL_PROVIDERS:
                confidence = 95  # Higher confidence for well-known providers

            # Determine status
            status = "valid" if has_mx else "invalid"
            sub_status = None if has_mx else "no_mx_record"

            # Prepare validation message
            message = "Valid email address"
            if not has_mx:
                message = "Domain has no valid MX records"
            elif is_free_email:
                message = "Valid free email provider"
            else:
                message = "Valid corporate email"

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
                isValid=has_mx,
                confidence=confidence
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
                confidence=0
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
            confidence=0
        )

# Web UI routes
@app.get("/")
async def home(request: Request):
    return templates.TemplateResponse("email_validator.html", {"request": request})

@app.post("/validate")
async def validate_email_form(request: Request, email: str = Form(...)):
    result = await validate_single_email(email)
    return templates.TemplateResponse("email_validator.html", {
        "request": request,
        "result": result,
        "email": email
    })

# API routes
@app.post("/api/validate-email", response_model=ValidationResult)
async def validate_email_api(request: EmailRequest) -> ValidationResult:
    """
    Validate a single email address via API
    """
    return await validate_single_email(request.email)

@app.post("/api/validate-emails", response_model=List[ValidationResult])
async def validate_multiple_emails(request: EmailsRequest) -> List[ValidationResult]:
    """
    Validate multiple email addresses (max 100 per request)
    """
    tasks = [validate_single_email(email) for email in request.emails]
    return await asyncio.gather(*tasks)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)