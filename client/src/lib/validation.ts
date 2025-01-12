export function isValidEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isDisposableEmail(domain: string): boolean {
  const disposableDomains = [
    'tempmail.com',
    'throwawaymail.com',
    'mailinator.com',
    'guerrillamail.com',
    'temp-mail.org',
    'fakeinbox.com',
  ];
  return disposableDomains.includes(domain.toLowerCase());
}
