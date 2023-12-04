export function sanitizeRecords(records: Record<string, string | number | boolean>, indexes: Record<string, string>): Record<string, string | number>  {

  const result = {};
  Object.entries(records).forEach(([key, value]) => {
    if (!indexes[key]) return;
    result[key] = sanitizedValue(value);
  }
  );
  return result;
}

export function sanitizedValue(value: any): string | number | boolean {
  if (typeof value === 'string') {
    return quote(value, true);
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  } else {
    return quote(JSON.stringify(value), true);
  }
}
export function quote(str: string, wrapInQuote: boolean = true): string {
  // Escape special characters
  if (!str) return  wrapInQuote ? '\'\'' : '';

  const escapedStr = `${str}`
    .replace(/\\/g, '\\\\') // Escape backslashes
    .replace(/"/g, '\\"') // Escape double quotes
    .replace(/'/g, '\\\'') // Escape single quotes
    .replace(/\n/g, '\\n') // Escape newlines
    .replace(/\r/g, '\\r') // Escape carriage returns
    .replace(/\t/g, '\\t'); // Escape tabs

  // Return the quoted string
  return wrapInQuote ? `'${escapedStr}'` : escapedStr;
}