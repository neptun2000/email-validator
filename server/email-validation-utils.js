const dns = require('dns');
const { promisify } = require('util');
const resolveMx = promisify(dns.resolveMx);

async function validateEmailForWorker(email, clientIp) {
  try {
    const [account, domain] = email.split("@");

    if (!domain || !account) {
      return {
        status: "invalid",
        subStatus: "format_error",
        freeEmail: "Unknown",
        didYouMean: "",
        account: account || "",
        domain: domain || "",
        domainAgeDays: "Unknown",
        smtpProvider: "Unknown",
        mxFound: "No",
        mxRecord: null,
        dmarcPolicy: null,
        firstName: "Unknown",
        lastName: "Unknown",
        message: "Invalid email format",
        isValid: false
      };
    }

    // Check MX records
    try {
      const mxRecords = await resolveMx(domain);
      const primaryMx = mxRecords[0]?.exchange;

      return {
        status: "valid",
        subStatus: null,
        freeEmail: "No",
        didYouMean: "",
        account,
        domain,
        domainAgeDays: "Unknown",
        smtpProvider: primaryMx ? primaryMx.split('.')[0] : "Unknown",
        mxFound: primaryMx ? "Yes" : "No",
        mxRecord: primaryMx || null,
        dmarcPolicy: null,
        firstName: account,
        lastName: "Unknown",
        message: "Valid email address",
        isValid: true
      };
    } catch (error) {
      return {
        status: "invalid",
        subStatus: "dns_error",
        freeEmail: "Unknown",
        didYouMean: "",
        account,
        domain,
        domainAgeDays: "Unknown",
        smtpProvider: "Unknown",
        mxFound: "No",
        mxRecord: null,
        dmarcPolicy: null,
        firstName: "Unknown",
        lastName: "Unknown",
        message: "Invalid domain or DNS error",
        isValid: false
      };
    }
  } catch (error) {
    console.error("Email validation error:", error);
    return {
      status: "error",
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

module.exports = { validateEmailForWorker };
