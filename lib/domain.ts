/**
 * Normalize user-entered domain to a canonical hostname (lowercase, no path).
 */
export function normalizePrimaryDomain(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "");
  const slash = s.indexOf("/");
  if (slash >= 0) s = s.slice(0, slash);
  const at = s.indexOf("@");
  if (at >= 0) s = s.slice(at + 1);
  s = s.replace(/:\d+$/, "");
  s = s.replace(/\.$/, "");
  if (!s) {
    throw new Error("Domain is required.");
  }
  if (s.length > 253) {
    throw new Error("Domain is too long.");
  }
  if (!/^[a-z0-9.-]+$/.test(s)) {
    throw new Error("Domain contains invalid characters.");
  }
  return s;
}
