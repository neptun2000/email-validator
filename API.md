# Email Validation API Documentation

## Base URL
`https://your-replit-url.replit.dev/api`

## Endpoints

### Validate Single Email
`POST /api/validate-email`

Validates a single email address for deliverability and existence.

#### Request Body
```json
{
  "email": "example@domain.com"
}
```

#### Response
```json
{
  "status": "valid",
  "subStatus": null,
  "freeEmail": "No",
  "didYouMean": "Unknown",
  "account": "example",
  "domain": "domain.com",
  "domainAgeDays": "Unknown",
  "smtpProvider": "mx1",
  "mxFound": "Yes",
  "mxRecord": "mx1.domain.com",
  "firstName": "Example",
  "lastName": "Unknown",
  "message": "Valid email address",
  "isValid": true
}
```

### Validate Multiple Emails
`POST /api/validate-emails`

Validates multiple email addresses in bulk (maximum 100 emails per request).

#### Request Body
```json
{
  "emails": ["example1@domain.com", "example2@domain.com"]
}
```

#### Response
```json
[
  {
    "email": "example1@domain.com",
    "status": "valid",
    "subStatus": null,
    "freeEmail": "No",
    "didYouMean": "Unknown",
    "account": "example1",
    "domain": "domain.com",
    "domainAgeDays": "Unknown",
    "smtpProvider": "mx1",
    "mxFound": "Yes",
    "mxRecord": "mx1.domain.com",
    "firstName": "Example1",
    "lastName": "Unknown",
    "message": "Valid email address",
    "isValid": true
  },
  {
    "email": "example2@domain.com",
    // ... similar structure for second email
  }
]
```

### Get Validation Statistics
`GET /api/metrics`

Returns validation statistics and performance metrics.

#### Response
```json
{
  "totalValidations": 100,
  "successfulValidations": 95,
  "failedValidations": 5,
  "averageValidationTime": 250,
  "hourlyMetrics": [...],
  "dailyMetrics": [...]
}
```

## Python Client Example

Here's how to use the API with Python requests:

```python
import requests

def validate_email(email, api_url="https://your-replit-url.replit.dev"):
    """
    Validate a single email address.
    
    Args:
        email (str): Email address to validate
        api_url (str): Base URL of the validation API
        
    Returns:
        dict: Validation result
    """
    response = requests.post(
        f"{api_url}/api/validate-email",
        json={"email": email}
    )
    response.raise_for_status()
    return response.json()

def validate_emails(emails, api_url="https://your-replit-url.replit.dev"):
    """
    Validate multiple email addresses (max 100 per request).
    
    Args:
        emails (list): List of email addresses to validate
        api_url (str): Base URL of the validation API
        
    Returns:
        list: List of validation results
    """
    response = requests.post(
        f"{api_url}/api/validate-emails",
        json={"emails": emails}
    )
    response.raise_for_status()
    return response.json()

def get_metrics(api_url="https://your-replit-url.replit.dev"):
    """
    Get validation statistics and metrics.
    
    Args:
        api_url (str): Base URL of the validation API
        
    Returns:
        dict: Validation metrics
    """
    response = requests.get(f"{api_url}/api/metrics")
    response.raise_for_status()
    return response.json()

# Example usage:
if __name__ == "__main__":
    # Validate single email
    result = validate_email("test@example.com")
    print("Single email validation:", result)
    
    # Validate multiple emails
    results = validate_emails(["test1@example.com", "test2@example.com"])
    print("Bulk validation:", results)
    
    # Get metrics
    metrics = get_metrics()
    print("Validation metrics:", metrics)
```

## Error Responses

The API uses standard HTTP status codes:

- 200: Success
- 400: Bad Request (invalid input)
- 429: Too Many Requests (rate limit exceeded)
- 500: Internal Server Error

Error responses include a message field explaining the error:

```json
{
  "message": "Error description"
}
```
