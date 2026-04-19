// Minimal CSV helpers. RFC 4180: quote fields containing commas, quotes, or newlines.
// Double quotes inside a field are escaped by doubling them.

function escape(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(header: string[], rows: Array<Array<unknown>>): string {
  const lines: string[] = [header.map(escape).join(',')];
  for (const row of rows) lines.push(row.map(escape).join(','));
  // Trailing CRLF for compatibility with Excel on Windows.
  return lines.join('\r\n') + '\r\n';
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadFile(filename: string, contents: string, mime = 'text/csv;charset=utf-8') {
  // Prefix CSV with BOM so Excel auto-detects UTF-8 (preserves åäö).
  const bom = mime.startsWith('text/csv') ? '\uFEFF' : '';
  downloadBlob(filename, new Blob([bom + contents], { type: mime }));
}
