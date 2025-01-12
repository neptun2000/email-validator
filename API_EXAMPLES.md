# Email Validation API Examples

## Base URL
Replace `{YOUR-REPLIT-URL}` with your actual Replit deployment URL.

## Single Email Validation

### cURL
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}' \
  https://{YOUR-REPLIT-URL}/api/validate-email
```

### Python
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

### JavaScript/TypeScript
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

## Bulk Email Validation

### cURL
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"emails":["test1@example.com","test2@example.com"]}' \
  https://{YOUR-REPLIT-URL}/api/validate-emails
```

### Python
```python
import requests

def validate_emails(emails, api_url):
    response = requests.post(
        f"{api_url}/api/validate-emails",
        json={"emails": emails}
    )
    response.raise_for_status()
    return response.json()

# Example usage
api_url = "https://{YOUR-REPLIT-URL}"
emails = ["test1@example.com", "test2@example.com"]
results = validate_emails(emails, api_url)
print(results)
```

### JavaScript/TypeScript
```typescript
async function validateEmails(emails: string[], apiUrl: string) {
  const response = await fetch(`${apiUrl}/api/validate-emails`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ emails }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Example usage
const apiUrl = "https://{YOUR-REPLIT-URL}";
const emails = ["test1@example.com", "test2@example.com"];
validateEmails(emails, apiUrl)
  .then(results => console.log(results))
  .catch(error => console.error('Error:', error));
```

## Response Format

### Single Email Validation Response
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

### Bulk Email Validation Response
```json
[
  {
    "email": "test1@example.com",
    "status": "valid",
    "subStatus": null,
    "freeEmail": "No",
    "didYouMean": "Unknown",
    "account": "test1",
    "domain": "example.com",
    "domainAgeDays": "Unknown",
    "smtpProvider": "mx1",
    "mxFound": "Yes",
    "mxRecord": "mx1.example.com",
    "dmarcPolicy": "reject",
    "firstName": "Test1",
    "lastName": "Unknown",
    "message": "Valid email address",
    "isValid": true
  },
  {
    "email": "test2@example.com",
    // Similar structure for second email
  }
]
```

## Rate Limiting
- Maximum 100 requests per hour per IP
- Maximum 100 emails per bulk validation request
- Rate limit headers included in responses:
  - `X-RateLimit-Limit`: Maximum requests per hour
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Unix timestamp for rate limit reset

## Error Handling
All errors return a JSON response with a message field:

```json
{
  "message": "Error description"
}
```

Common HTTP status codes:
- 200: Success
- 400: Bad Request (invalid input)
- 429: Too Many Requests (rate limit exceeded)
- 500: Internal Server Error
