# Email Validation API

A comprehensive email validation platform providing robust verification of email addresses through advanced technical checks and authentication protocols.

## Features

- Email format validation
- SMTP server verification 
- MX record checking
- DMARC policy verification
- Disposable email detection
- Rate limiting and abuse prevention
- Detailed validation reports
- Bulk validation support (up to 100 emails)
- Real-time metrics and statistics

## Tech Stack

- React + TypeScript frontend
- Node.js backend
- Worker-based parallel processing
- Advanced DNS and DMARC policy checking
- Secure REST API with rate limiting

## API Documentation

### Base URL
Replace `{YOUR-REPLIT-URL}` with your deployment URL.

### Endpoints

#### 1. Validate Single Email
`POST /api/validate-email`

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}' \
  https://{YOUR-REPLIT-URL}/api/validate-email
```

#### 2. Validate Multiple Emails
`POST /api/validate-emails`

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"emails":["test1@example.com","test2@example.com"]}' \
  https://{YOUR-REPLIT-URL}/api/validate-emails
```

#### 3. Get Validation Statistics
`GET /api/metrics`

```bash
curl https://{YOUR-REPLIT-URL}/api/metrics
```

### Code Examples

#### Python
```python
import requests

def validate_email(email, api_url):
    response = requests.post(
        f"{api_url}/api/validate-email",
        json={"email": email}
    )
    response.raise_for_status()
    return response.json()

# Example usage
api_url = "https://{YOUR-REPLIT-URL}"
result = validate_email("test@example.com", api_url)
print(result)
```

#### JavaScript/TypeScript
```typescript
async function validateEmail(email: string, apiUrl: string) {
  const response = await fetch(`${apiUrl}/api/validate-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Example usage
const apiUrl = "https://{YOUR-REPLIT-URL}";
validateEmail("test@example.com", apiUrl)
  .then(result => console.log(result))
  .catch(error => console.error('Error:', error));
```

### Response Format

#### Success Response
```json
{
  "status": "valid",
  "subStatus": null,
  "freeEmail": "No",
  "didYouMean": "Unknown",
  "account": "test",
  "domain": "example.com",
  "domainAgeDays": "Unknown",
  "smtpProvider": "mx1",
  "mxFound": "Yes",
  "mxRecord": "mx1.example.com",
  "dmarcPolicy": "reject",
  "firstName": "Test",
  "lastName": "Unknown",
  "message": "Valid email address",
  "isValid": true
}
```

#### Error Response
```json
{
  "message": "Error description"
}
```

### Rate Limiting
- 100 requests per hour per IP address
- Maximum 100 emails per bulk validation request
- Rate limit headers included in responses:
  - `X-RateLimit-Limit`: Maximum requests per hour
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Unix timestamp for reset

## Installation & Development

1. Clone the repository:
```bash
git clone https://github.com/yourusername/email-validation-api.git
cd email-validation-api
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

## License

MIT License - feel free to use this project for your own purposes.
