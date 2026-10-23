import dns from 'dns';

// Known disposable email domains
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "tempmail.com", "10minutemail.com",
  "throwawaymail.com", "yopmail.com", "sharklasers.com", "dispostable.com",
  "trashmail.com", "getairmail.com", "fakeinbox.com", "maildrop.cc",
  "inboxkitten.com", "generator.email", "mohmal.com", "mytemp.email",
  "burnermail.io", "crazymailing.com", "dropmail.me", "nada.ltd"
]);

// Known free consumer webmail domains
const FREE_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com",
  "aol.com", "proton.me", "protonmail.com", "zoho.com", "mail.com",
  "gmx.com", "yandex.com", "fastmail.com", "tutanota.com"
]);

// Known role-based account prefixes
const ROLE_PREFIXES = new Set([
  "admin", "administrator", "info", "support", "sales", "billing",
  "contact", "help", "security", "jobs", "careers", "marketing",
  "postmaster", "hostmaster", "abuse", "webmaster", "press", "inquiries"
]);

// Common domain typos
const TYPO_MAP = {
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "hotmial.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outlock.com": "outlook.com",
  "iclou.com": "icloud.com",
  "prton.me": "proton.me"
};

/**
 * Fast MAP protocol & email schema validator
 */
export async function validateEmail(emailInput, options = {}) {
  const startTime = Date.now();
  const email = (emailInput || "").trim().toLowerCase();

  const result = {
    email,
    validSyntax: false,
    deliverable: false,
    score: 0,
    risk: "UNDELIVERABLE",
    parts: { local: "", domain: "", tld: "" },
    checks: {
      rfcFormat: false,
      isDisposable: false,
      isRoleAccount: false,
      isFreeProvider: false,
      hasMxRecords: false,
      mxHosts: [],
      typoSuggestion: null
    },
    latencyMs: 0
  };

  if (!email || typeof email !== 'string') {
    result.latencyMs = Date.now() - startTime;
    return result;
  }

  // RFC 5322 regex check
  const rfc5322Regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!rfc5322Regex.test(email)) {
    result.latencyMs = Date.now() - startTime;
    return result;
  }

  const atIndex = email.lastIndexOf('@');
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  // Check length constraints
  if (email.length > 254 || local.length > 64 || domain.length > 255) {
    result.latencyMs = Date.now() - startTime;
    return result;
  }

  // Check no consecutive dots
  if (local.includes('..') || domain.includes('..')) {
    result.latencyMs = Date.now() - startTime;
    return result;
  }

  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2) {
    result.latencyMs = Date.now() - startTime;
    return result;
  }

  result.parts = { local, domain, tld };
  result.validSyntax = true;
  result.checks.rfcFormat = true;

  // Typo suggestion check
  if (TYPO_MAP[domain]) {
    result.checks.typoSuggestion = `${local}@${TYPO_MAP[domain]}`;
  }

  // Disposable domain check
  result.checks.isDisposable = DISPOSABLE_DOMAINS.has(domain);

  // Role account check
  result.checks.isRoleAccount = ROLE_PREFIXES.has(local);

  // Free provider check
  result.checks.isFreeProvider = FREE_DOMAINS.has(domain);

  // DNS MX Record lookup (MAP Protocol check)
  const shouldCheckMx = options.checkMx !== false;
  if (shouldCheckMx && !result.checks.isDisposable) {
    try {
      // Timeout promise for DNS lookup (max 3000ms)
      const mxPromise = dns.promises.resolveMx(domain);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("DNS MX lookup timed out")), 3000)
      );

      const mxRecords = await Promise.race([mxPromise, timeoutPromise]);
      if (mxRecords && mxRecords.length > 0) {
        // Filter out null MX (RFC 7505)
        const validMx = mxRecords.filter(r => r.exchange && r.exchange !== '.');
        if (validMx.length > 0) {
          result.checks.hasMxRecords = true;
          result.checks.mxHosts = validMx
            .sort((a, b) => a.priority - b.priority)
            .map(r => ({ host: r.exchange, priority: r.priority }));
        }
      }
    } catch (err) {
      result.checks.hasMxRecords = false;
    }
  }

  // Calculate deliverability score (0-100)
  let score = 0;
  if (result.validSyntax) score += 30;
  if (result.checks.hasMxRecords) score += 40;
  if (!result.checks.isDisposable) score += 20;
  if (!result.checks.isRoleAccount) score += 10;
  if (result.checks.typoSuggestion) score -= 40;

  result.score = Math.max(0, Math.min(100, score));

  if (result.checks.isDisposable) {
    result.risk = "HIGH_RISK";
    result.deliverable = false;
  } else if (result.checks.hasMxRecords && !result.checks.typoSuggestion) {
    result.risk = "LOW";
    result.deliverable = true;
  } else if (result.validSyntax) {
    result.risk = "MEDIUM";
    result.deliverable = result.score >= 50;
  } else {
    result.risk = "UNDELIVERABLE";
    result.deliverable = false;
  }

  result.latencyMs = Date.now() - startTime;
  return result;
}
