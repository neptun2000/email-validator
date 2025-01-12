# Email Validation API Documentation

## Base URL
`https://your-replit-url.replit.dev/api`

## Features
- Email format validation
- SMTP server verification
- MX record checking
- DMARC policy verification
- Disposable email detection
- Rate limiting and abuse prevention
- Detailed validation reports
- Bulk validation support

## Rate Limiting
The API implements rate limiting to ensure fair usage:
- 100 requests per hour per IP address
- Rate limit headers are included in all responses:
  - `X-RateLimit-Limit`: Maximum requests per hour (100)
  - `X-RateLimit-Remaining`: Remaining requests for the current hour
  - `X-RateLimit-Reset`: Unix timestamp when the rate limit resets

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
  "dmarcPolicy": "reject",
  "firstName": "Example",
  "lastName": "Unknown",
  "message": "Valid email address",
  "isValid": true
}
```

The `dmarcPolicy` field indicates the domain's DMARC policy:
- `reject`: Emails failing DMARC should be rejected
- `quarantine`: Emails failing DMARC should be quarantined
- `none`: No specific action required for DMARC failures
- `null`: No DMARC record found

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
  "hourlyMetrics": [
    {
      "timestamp": 1673520000000,
      "validations": 50,
      "successRate": 95.5,
      "averageTime": 245
    }
  ],
  "dailyMetrics": [
    {
      "timestamp": 1673433600000,
      "validations": 1000,
      "successRate": 96.2,
      "averageTime": 248
    }
  ]
}
```

## Code Examples

### Python
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

### Node.js
```javascript
const axios = require('axios');

async function validateEmail(email, apiUrl = 'https://your-replit-url.replit.dev') {
  try {
    const response = await axios.post(`${apiUrl}/api/validate-email`, {
      email
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`${error.response.status}: ${error.response.data.message}`);
    }
    throw error;
  }
}

async function validateEmails(emails, apiUrl = 'https://your-replit-url.replit.dev') {
  try {
    const response = await axios.post(`${apiUrl}/api/validate-emails`, {
      emails
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`${error.response.status}: ${error.response.data.message}`);
    }
    throw error;
  }
}

async function getMetrics(apiUrl = 'https://your-replit-url.replit.dev') {
  try {
    const response = await axios.get(`${apiUrl}/api/metrics`);
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`${error.response.status}: ${error.response.data.message}`);
    }
    throw error;
  }
}
```

### cURL
```bash
# Validate single email
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}' \
  https://your-replit-url.replit.dev/api/validate-email

# Validate multiple emails
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"emails":["test1@example.com","test2@example.com"]}' \
  https://your-replit-url.replit.dev/api/validate-emails

# Get metrics
curl https://your-replit-url.replit.dev/api/metrics
```

## Error Responses

The API uses standard HTTP status codes and provides detailed error messages:

### Status Codes
- 200: Success
- 400: Bad Request (invalid input)
- 429: Too Many Requests (rate limit exceeded)
- 500: Internal Server Error

### Error Response Format
```json
{
  "message": "Error description"
}
```

### Common Error Examples

#### Invalid Email Format (400)
```json
{
  "message": "Email is required and must be a string"
}
```

#### Rate Limit Exceeded (429)
```json
{
  "message": "Rate limit exceeded. Please try again later."
}
```

#### Too Many Emails in Bulk Request (400)
```json
{
  "message": "Maximum 100 emails allowed per request"
}
```

#### Server Error (500)
```json
{
  "message": "Internal server error during validation"
}
```

## Best Practices
1. Always handle rate limits by checking response headers
2. Implement exponential backoff for retries
3. Keep bulk validation requests under 100 emails
4. Check for and handle all error responses
5. Use HTTPS for secure communication