import { readFile } from "node:fs/promises";
import { join, normalize, extname } from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { clientDir } from "@launchflow/config";
import { env } from "@/lib/env";

const MIME: Record<string, string> = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon", ".gif": "image/gif" };

export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const rel = normalize(path.join("/"));
  if (rel.startsWith("..") || rel.includes("../")) return new NextResponse("Not found", { status: 404 });
  const file = join(clientDir(env.clientSlug), "assets", rel);
  try {
    const buf = await readFile(file);
    return new NextResponse(new Uint8Array(buf), { headers: { "content-type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream", "cache-control": "public, max-age=86400, stale-while-revalidate=604800" } });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
