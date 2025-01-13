from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from email_validator import validate_email as validate_email_lib, EmailNotValidError
import dns.resolver
import asyncio
import re

app = FastAPI(title="Email Validation Platform")

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

    class Config:
        max_length = 100

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
    message: str
    isValid: bool
    confidence: float

# Known email providers
FREE_EMAIL_PROVIDERS = {
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
    'aol.com', 'mail.com', 'protonmail.com', 'icloud.com'
}

async def validate_single_email(email: str) -> ValidationResult:
    """Validate a single email address with comprehensive checks"""
    try:
        # First validate the email format
        validation = validate_email_lib(email, check_deliverability=False)
        email = validation.normalized
        domain = validation.domain
        account = validation.local_part

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
            if not has_mx:
                status = "invalid"
                sub_status = "no_mx_record"
                message = "Domain has no valid MX records"
                is_valid = False
            else:
                status = "valid"
                sub_status = None
                is_valid = True
                message = "Valid free email provider" if domain in FREE_EMAIL_PROVIDERS else "Valid corporate email"

            return ValidationResult(
                status=status,
                subStatus=sub_status,
                freeEmail="Yes" if domain in FREE_EMAIL_PROVIDERS else "No",
                didYouMean="",
                account=account,
                domain=domain,
                domainAgeDays="Unknown",
                smtpProvider=mx_record.split('.')[0] if mx_record else "Unknown",
                mxFound="Yes" if has_mx else "No",
                mxRecord=mx_record,
                message=message,
                isValid=is_valid,
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
                message="Domain does not exist",
                isValid=False,
                confidence=0
            )

    except EmailNotValidError as e:
        domain = email.split('@')[1] if '@' in email else "unknown"
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
            message=str(e),
            isValid=False,
            confidence=0
        )

@app.post("/api/validate-email")
async def validate_email(request: EmailRequest) -> ValidationResult:
    """Validate a single email address"""
    return await validate_single_email(request.email)

@app.post("/api/validate-emails")
async def validate_multiple_emails(request: EmailsRequest) -> List[ValidationResult]:
    """Validate multiple email addresses (max 100 per request)"""
    if len(request.emails) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 emails per request")

    tasks = [validate_single_email(email) for email in request.emails]
    return await asyncio.gather(*tasks)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)