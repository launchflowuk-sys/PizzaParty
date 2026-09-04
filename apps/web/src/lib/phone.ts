/** UK-first E.164 normalisation. Accepts 07..., +447..., 447..., 0044... */
export function toE164(raw: string): string | null {
  let s = raw.replace(/[^\d+]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("0")) s = "+44" + s.slice(1);
  if (/^44\d{10}$/.test(s)) s = "+" + s;
  if (/^7\d{9}$/.test(s)) s = "+44" + s;
  if (!/^\+\d{10,15}$/.test(s)) return null;
  return s;
}

export function prettyPhone(e164: string): string {
  if (e164.startsWith("+44") && e164.length === 13) return `0${e164.slice(3, 7)} ${e164.slice(7)}`;
  return e164;
}
