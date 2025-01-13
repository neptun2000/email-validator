import dns from 'dns';
import { promisify } from 'util';
import { EmailVerifier } from './email-verifier.js';

const resolveMx = promisify(dns.resolveMx);

export async function validateEmailForWorker(email, clientIp) {
  try {
    const verificationResult = await EmailVerifier.verify(email, clientIp);
    console.log('Worker verification result:', verificationResult);

    // Format status with reason if available
    let status = verificationResult.valid ? "valid" : "invalid";
    if (verificationResult.reason) {
      status = `${status.toUpperCase()} (${verificationResult.reason})`;
    }

    const [account, domain] = email.split("@");
    const { firstName, lastName } = extractNameFromEmail(account);

    return {
      status,
      subStatus: verificationResult.reason || null,
      freeEmail: "No",
      didYouMean: "",
      account,
      domain,
      domainAgeDays: "Unknown",
      smtpProvider: verificationResult.mxRecord ? verificationResult.mxRecord.split('.')[0] : "Unknown",
      mxFound: verificationResult.mxRecord ? "Yes" : "No",
      mxRecord: verificationResult.mxRecord || null,
      dmarcPolicy: verificationResult.dmarcPolicy || null,
      firstName,
      lastName,
      message: verificationResult.reason || (verificationResult.valid ? "Valid email address" : "Invalid email address"),
      isValid: verificationResult.valid
    };
  } catch (error) {
    console.error("Email validation error in worker:", error);
    return {
      status: "ERROR (system_error)",
      subStatus: "system_error",
      freeEmail: "Unknown",
      didYouMean: "",
      account: "Unknown",
      domain: "Unknown",
      domainAgeDays: "Unknown",
      smtpProvider: "Unknown",
      mxFound: "No",
      mxRecord: null,
      dmarcPolicy: null,
      firstName: "Unknown",
      lastName: "Unknown",
      message: error instanceof Error ? error.message : "Failed to validate email",
      isValid: false
    };
  }
}

function extractNameFromEmail(account) {
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

// Handle worker messages if running as a worker
import { parentPort, workerData } from 'worker_threads';
if (parentPort) {
  (async () => {
    try {
      const { email, clientIp } = workerData;
      const result = await validateEmailForWorker(email, clientIp);
      parentPort.postMessage({ success: true, result });
    } catch (error) {
      console.error('Worker error:', error);
      parentPort.postMessage({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  })();
}