// Helper to safely format text for CSV, handling commas and quotes
export const safeCsvText = (value: any): string => {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  // If the string contains a comma, double quote, or newline, enclose it in double quotes
  // and escape any existing double quotes by doubling them.
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Formats a numeric score for UI display, showing negative numbers with parentheses.
 * e.g., -23.50 becomes (23.50), 100.00 remains 100.00.
 */
export const formatScoreForDisplay = (score: number | undefined | null): string => {
  if (score === undefined || score === null || isNaN(score)) {
    return 'N/A';
  }
  const formatted = Math.abs(score).toFixed(2);
  return score < 0 ? `(${formatted})` : formatted;
};

/**
 * Formats a numeric score for CSV output.
 * - Positive numbers and zero are formatted as numeric strings (e.g., "100.00").
 * - Negative numbers are formatted as text with parentheses (e.g., `="(23.50)"`)
 *   to force spreadsheet programs to display the parentheses.
 * NOTE: This makes negative values non-numeric in spreadsheets, so formulas (SUM, AVG)
 * will only work on the positive values.
 */
export const formatScoreForCsv = (score: number | undefined | null): string => {
  if (score === undefined || score === null || isNaN(score)) {
    return 'N/A'; // Or an empty string, depending on desired behavior for non-numeric/null scores
  }

  if (score < 0) {
    const formatted = Math.abs(score).toFixed(2);
    const value = `(${formatted})`;
    // By wrapping the negative value in `="<value>"`, we create a simple Excel formula
    // that resolves to a string. This forces the display of parentheses.
    return `="${value}"`;
  }

  // Positive numbers and zero are returned as plain numeric strings.
  return score.toFixed(2);
};