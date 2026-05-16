/**
 * PII Filter — redacts sensitive data before sending to Claude API.
 * Regulation numbers and statutory instrument references are preserved.
 */
export function filterPII(text: string): string {
  return text
    .replace(/\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b/gi, '[EMAIL]')
    .replace(/\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, '[CARD]')
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7,}\b/g, '[IBAN]')
    .replace(/\b(\+\d{1,3}[\s\-]?)?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}\b/g, '[PHONE]')
    .replace(/\b(ID|DNI|SSN|NIE|PESEL|Passport)[:\-\s]*\d{6,12}\b/gi, '[ID_NUMBER]');
}
