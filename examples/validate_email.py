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
    # Replace with your actual Replit URL
    API_URL = "https://your-replit-url.replit.dev"

    try:
        # Validate single email
        result = validate_email("test@example.com", API_URL)
        print("\nSingle email validation result:")
        print(result)
    except requests.exceptions.RequestException as e:
        print(f"Error validating single email: {e}")

    try:
        # Validate multiple emails
        emails = [
            "test1@example.com",
            "test2@example.com",
            "invalid.email@"
        ]
        results = validate_emails(emails, API_URL)
        print("\nMultiple email validation results:")
        for result in results:
            print(f"\nEmail: {result['email']}")
            print(f"Valid: {result['isValid']}")
            print(f"Message: {result['message']}")
    except requests.exceptions.RequestException as e:
        print(f"Error validating multiple emails: {e}")