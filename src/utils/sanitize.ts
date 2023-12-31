export function sanitizeRecords(records: Record<string, string | number | boolean | null>, indexes: Record<string, string>): Record<string, string | number | null >  {

  const result = {};
  Object.entries(records).forEach(([key, value]) => {
    if (!indexes[key]) return;
    result[key] = sanitizedValue(value);
  }
  );
  return result;
}

export function sanitizedValue(value: any): string | number | boolean | null {
  if (value === null) {
    return null;
  } else if (typeof value === 'string') {
    return quote(value, false);
  } else if (typeof value === 'number') {
    return value;
  } else if (typeof value === 'boolean') {
    return `${value}`;
  }
  else {
    return quote(JSON.stringify(value), false);
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
export function wrapStrings(value: any, left:string='\'', right:string='\''): any {
  if (typeof value === 'string') {
    return `${left}${value}${right}`;
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }  else {
    return `${left}${JSON.stringify(value)}${right}`;
  }
}