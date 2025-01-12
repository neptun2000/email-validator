import { validateEmail } from '../routes';
import { EmailVerifier } from '../email-verifier';

describe('Email Validator', () => {
  const validEmails = [
    'michael.naumov@teva.co.il',
    'test@gmail.com',
    'user@company.com'
  ];

  const invalidEmails = [
    'notanemail',
    'test@invalid',
    'user@disposable.temp-mail.org'
  ];

  const corporateEmails = [
    'employee@amazon.com',
    'user@microsoft.com',
    'staff@apple.com'
  ];

  // Mock the rate limiter check
  beforeAll(() => {
    jest.spyOn(EmailVerifier, 'checkRateLimit').mockResolvedValue(true);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test.each(validEmails)('should validate correct email: %s', async (email) => {
    const result = await validateEmail(email, '127.0.0.1');
    expect(result.status).toBe('valid');
    expect(result.isValid).toBe(true);
    expect(result.mxFound).toBe('Yes');
  });

  test.each(invalidEmails)('should reject invalid email: %s', async (email) => {
    const result = await validateEmail(email, '127.0.0.1');
    expect(result.isValid).toBe(false);
    expect(result.status).toBe('invalid');
  });

  test.each(corporateEmails)('should handle corporate email correctly: %s', async (email) => {
    const result = await validateEmail(email, '127.0.0.1');
    expect(['valid', 'catch-all']).toContain(result.status);
    expect(result.isValid).toBe(true);
    expect(result.mxFound).toBe('Yes');
  });

  test('should handle rate limiting', async () => {
    jest.spyOn(EmailVerifier, 'checkRateLimit').mockResolvedValueOnce(false);
    const result = await validateEmail('test@example.com', '127.0.0.1');
    expect(result.status).toBe('error');
    expect(result.subStatus).toBe('system_error');
    expect(result.isValid).toBe(false);
  });

  test('should detect disposable email addresses', async () => {
    const result = await validateEmail('user@temp-mail.org', '127.0.0.1');
    expect(result.status).toBe('invalid');
    expect(result.subStatus).toBe('disposable');
    expect(result.isValid).toBe(false);
  });
});