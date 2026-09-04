import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: false });

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string;
}

/** Extract "### Question\nAnswer" pairs for FAQPage JSON-LD. */
export function extractFaqs(md: string): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = [];
  const re = /^###\s+(.+)\n+([\s\S]*?)(?=^###\s|^##\s|(?![\s\S]))/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    const q = m[1]!.trim();
    const a = m[2]!.trim().replace(/\n+/g, " ");
    if (q && a) out.push({ q, a });
  }
  return out;
}
