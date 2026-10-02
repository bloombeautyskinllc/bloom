// RFC 4180 CSV with a guard against spreadsheet formula injection (=, +, -, @ at the start of a cell)
export function toCsv(header: string[], rows: (string | number | boolean | null | undefined)[][]) {
  const cell = (value: string | number | boolean | null | undefined) => {
    let s = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
