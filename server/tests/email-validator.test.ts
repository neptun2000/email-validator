import { validateEmail } from '../routes';

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

  test.each(validEmails)('should validate correct email: %s', async (email) => {
    const result = await validateEmail(email);
    expect(result.status).toBe('valid');
    expect(result.isValid).toBe(true);
    expect(result.mxFound).toBe('Yes');
  });

  test.each(invalidEmails)('should reject invalid email: %s', async (email) => {
    const result = await validateEmail(email);
    expect(result.isValid).toBe(false);
  });
});
