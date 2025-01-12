import type { Express } from "express";
import { createServer, type Server } from "http";
import dns from "dns";
import { promisify } from "util";
import { isDisposableEmail } from "../client/src/lib/validation";
import net from "net";

const resolveMx = promisify(dns.resolveMx);

interface ValidationResult {
  status: string;
  subStatus: string | null;
  freeEmail: string;
  didYouMean: string;
  account: string;
  domain: string;
  domainAgeDays: string;
  smtpProvider: string;
  mxFound: string;
  mxRecord: string | null;
  firstName: string;
  lastName: string;
  message: string;
  isValid: boolean;
}

function extractNameFromEmail(email: string): { firstName: string; lastName: string } {
  const [account] = email.split('@');
  const nameParts = account
    .replace(/[._]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());

  if (nameParts.length >= 2) {
    return {
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(' ')
    };
  }

  return {
    firstName: nameParts[0] || 'Unknown',
    lastName: 'Unknown'
  };
}

async function verifyMailbox(email: string, domain: string, mxRecord: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let responseBuffer = "";

    const cleanup = () => {
      socket.destroy();
    };

    const timeout = setTimeout(() => {
      console.log('Connection timeout');
      cleanup();
      resolve(false);
    }, 5000); // Reduced timeout to 5 seconds

    socket.on('data', (data) => {
      responseBuffer += data.toString();
      console.log('SMTP Response:', responseBuffer);

      // Check for error codes that indicate non-existent mailbox
      if (responseBuffer.includes('550') || // Mailbox unavailable
          responseBuffer.includes('551') || // User not local
          responseBuffer.includes('553') || // Mailbox name invalid
          responseBuffer.includes('501') || // Syntax error
          responseBuffer.includes('504') || // Command parameter not implemented
          responseBuffer.includes('511') || // Bad email address
          responseBuffer.includes('554')) { // Transaction failed
        console.log('Mailbox does not exist or is invalid');
        clearTimeout(timeout);
        cleanup();
        resolve(false);
      }

      if (responseBuffer.includes('220')) {
        socket.write(`HELO emailvalidator.com\r\n`);
      } else if (responseBuffer.includes('250') && !responseBuffer.includes('MAIL FROM')) {
        socket.write(`MAIL FROM:<verify@emailvalidator.com>\r\n`);
      } else if (responseBuffer.includes('250') && !responseBuffer.includes('RCPT TO')) {
        socket.write(`RCPT TO:<${email}>\r\n`);
      } else if (responseBuffer.includes('250') && responseBuffer.includes('RCPT TO')) {
        console.log('Mailbox exists');
        clearTimeout(timeout);
        socket.write('QUIT\r\n'); // Properly close the connection
        cleanup();
        resolve(true);
      }
    });

    socket.on('error', (err) => {
      console.error('Socket error:', err.message);
      clearTimeout(timeout);
      cleanup();
      resolve(false);
    });

    socket.on('close', () => {
      clearTimeout(timeout);
      cleanup();
    });

    try {
      console.log(`Connecting to ${mxRecord}:25`);
      socket.connect(25, mxRecord);
    } catch (err) {
      console.error('Connection error:', err);
      clearTimeout(timeout);
      cleanup();
      resolve(false);
    }
  });
}

async function validateEmail(email: string): Promise<ValidationResult> {
  console.log(`Validating email: ${email}`);

  try {
    const [account, domain] = email.split("@");

    if (!domain || !account) {
      console.log('Invalid email format: no domain or account found');
      return {
        status: "invalid",
        subStatus: "format_error",
        freeEmail: "Unknown",
        didYouMean: "Unknown",
        account,
        domain: domain || "Unknown",
        domainAgeDays: "Unknown",
        smtpProvider: "Unknown",
        mxFound: "No",
        mxRecord: null,
        firstName: "Unknown",
        lastName: "Unknown",
        message: "Invalid email format",
        isValid: false
      };
    }

    const { firstName, lastName } = extractNameFromEmail(email);

    const result: ValidationResult = {
      status: "checking",
      subStatus: null,
      freeEmail: "No",
      didYouMean: "Unknown",
      account,
      domain,
      domainAgeDays: "Unknown",
      smtpProvider: "Unknown",
      mxFound: "No",
      mxRecord: null,
      firstName,
      lastName,
      message: "",
      isValid: false
    };

    if (isDisposableEmail(domain)) {
      console.log('Disposable email detected:', domain);
      result.status = "invalid";
      result.subStatus = "disposable";
      result.message = "Disposable email addresses are not allowed";
      return result;
    }

    try {
      console.log('Checking MX records for domain:', domain);
      const mxRecords = await resolveMx(domain);

      if (!mxRecords || mxRecords.length === 0) {
        console.log('No MX records found for domain:', domain);
        result.status = "invalid";
        result.subStatus = "no_mx_record";
        result.message = "Domain does not have valid mail servers";
        return result;
      }

      const primaryMx = mxRecords.sort((a, b) => a.priority - b.priority)[0];
      result.mxFound = "Yes";
      result.mxRecord = primaryMx.exchange;
      result.smtpProvider = primaryMx.exchange.split('.')[0];

      // Verify if the mailbox exists
      console.log('Verifying mailbox existence...');
      const mailboxExists = await verifyMailbox(email, domain, primaryMx.exchange);

      if (!mailboxExists) {
        console.log('Mailbox verification failed');
        result.status = "invalid";
        result.subStatus = "mailbox_not_found";
        result.message = "Email address does not exist";
        result.isValid = false;
        return result;
      }

      result.status = "valid";
      result.message = "Email address exists and is valid";
      result.isValid = true;

      console.log('Valid email address found:', email);
      return result;

    } catch (dnsError) {
      console.error('DNS error:', dnsError);
      result.status = "invalid";
      result.subStatus = "dns_error";
      result.message = "Domain appears to be invalid";
      return result;
    }
  } catch (error) {
    console.error("Email validation error:", error);
    return {
      status: "error",
      subStatus: "system_error",
      freeEmail: "Unknown",
      didYouMean: "Unknown",
      account: "Unknown",
      domain: "Unknown",
      domainAgeDays: "Unknown",
      smtpProvider: "Unknown",
      mxFound: "No",
      mxRecord: null,
      firstName: "Unknown",
      lastName: "Unknown",
      message: "Failed to validate email",
      isValid: false
    };
  }
}

export function registerRoutes(app: Express): Server {
  app.post("/api/validate-email", async (req, res) => {
    console.log('Received single validation request:', req.body);

    try {
      const { email } = req.body;

      if (!email || typeof email !== "string") {
        console.log('Invalid request: missing or invalid email');
        return res.status(400).send("Email is required");
      }

      const result = await validateEmail(email);
      console.log('Validation result:', result);

      return res.json(result);
    } catch (error) {
      console.error("Email validation error:", error);
      res.status(500).send("Internal server error during validation");
    }
  });

  app.post("/api/validate-emails", async (req, res) => {
    console.log('Received bulk validation request:', req.body);

    try {
      const { emails } = req.body;

      if (!Array.isArray(emails)) {
        console.log('Invalid request: emails must be an array');
        return res.status(400).send("Emails must be provided as an array");
      }

      if (emails.length > 100) {
        console.log('Invalid request: too many emails');
        return res.status(400).send("Maximum 100 emails allowed per request");
      }

      // Process emails in parallel with a concurrency limit
      const validationPromises = emails.map(async (email) => {
        try {
          const result = await validateEmail(email);
          return { ...result, email };
        } catch (error) {
          console.error(`Error validating email ${email}:`, error);
          return {
            email,
            status: "error",
            subStatus: "system_error",
            freeEmail: "Unknown",
            didYouMean: "Unknown",
            account: "Unknown",
            domain: "Unknown",
            domainAgeDays: "Unknown",
            smtpProvider: "Unknown",
            mxFound: "No",
            mxRecord: null,
            firstName: "Unknown",
            lastName: "Unknown",
            message: "Failed to validate email",
            isValid: false
          };
        }
      });

      const results = await Promise.all(validationPromises);
      console.log(`Completed bulk validation for ${emails.length} emails`);

      return res.json(results);
    } catch (error) {
      console.error("Bulk validation error:", error);
      res.status(500).send("Internal server error during bulk validation");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}