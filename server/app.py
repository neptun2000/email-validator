from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from email_validator import validate_email as validate_email_lib, EmailNotValidError
import dns.resolver
import asyncio

app = FastAPI()

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

class ValidationResult(BaseModel):
    status: str
    message: str
    domain: str
    mx_record: Optional[str]
    is_valid: bool
    confidence: float
    provider: str

# Common email providers - expanded list
FREE_EMAIL_PROVIDERS = {
    'gmail.com',
    'yahoo.com',
    'hotmail.com',  # Added to fix the detection
    'outlook.com',
    'live.com',
    'aol.com',
    'mail.com',
    'protonmail.com',
    'icloud.com',
    'yandex.com',
    'zoho.com',
    'gmx.com',
    'msn.com'  # Additional Microsoft domain
}

async def validate_single_email(email: str) -> ValidationResult:
    try:
        # First validate the email format using email-validator library
        validation = validate_email_lib(email, check_deliverability=False)
        email = validation.normalized
        domain = validation.domain.lower()  # Normalize domain for comparison

        # Determine email provider type
        provider = "Free Email Provider" if domain in FREE_EMAIL_PROVIDERS else "Corporate/Custom Domain"

        try:
            # Check MX records
            mx_records = dns.resolver.resolve(domain, 'MX')
            mx_record = str(mx_records[0].exchange) if mx_records else None
            has_mx = bool(mx_record)

            # Calculate confidence based on various factors
            confidence = 80 if has_mx else 20

            # Adjust confidence for known providers
            if domain in FREE_EMAIL_PROVIDERS:
                confidence = 95  # Higher confidence for well-known providers

            return ValidationResult(
                status="valid",
                message="Valid email address",
                domain=domain,
                mx_record=mx_record,
                is_valid=True,
                confidence=confidence,
                provider=provider
            )

        except dns.resolver.NXDOMAIN:
            return ValidationResult(
                status="invalid",
                message="Domain does not exist",
                domain=domain,
                mx_record=None,
                is_valid=False,
                confidence=0,
                provider=provider
            )
        except dns.resolver.NoAnswer:
            return ValidationResult(
                status="invalid",
                message="Domain does not have MX records",
                domain=domain,
                mx_record=None,
                is_valid=False,
                confidence=0,
                provider=provider
            )

    except EmailNotValidError as e:
        domain = email.split('@')[1].lower() if '@' in email else "unknown"
        provider = "Free Email Provider" if domain in FREE_EMAIL_PROVIDERS else "Unknown"
        return ValidationResult(
            status="invalid",
            message=str(e),
            domain=domain,
            mx_record=None,
            is_valid=False,
            confidence=0,
            provider=provider
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/validate-email")
async def validate_email(request: EmailRequest) -> ValidationResult:
    """
    Validate a single email address
    """
    return await validate_single_email(request.email)

@app.post("/api/validate-emails")
async def validate_multiple_emails(request: EmailsRequest) -> List[ValidationResult]:
    """
    Validate multiple email addresses (max 100 per request)
    """
    if len(request.emails) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 emails allowed per request")

    tasks = [validate_single_email(email) for email in request.emails]
    return await asyncio.gather(*tasks)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)