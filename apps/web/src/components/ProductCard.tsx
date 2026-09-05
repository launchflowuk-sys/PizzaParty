import Link from "next/link";
import Image from "next/image";
import { gbpShort } from "@/lib/money";
import { DietBadges } from "@/components/DietBadges";

type P = { slug: string; name: string; description: string; image: string; tags: string[]; soldOut: boolean; sizes: { price: number }[] };

export function ProductCard({ product, href, image }: { product: P; href: string; image: string }) {
  const min = Math.min(...product.sizes.map((s) => s.price));
  return (
    <Link href={href} className="lf-card flex gap-3 p-3 hover:shadow-md transition-shadow" aria-disabled={product.soldOut}>
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-tight">{product.name}</p>
        {product.description ? <p className="text-sm text-muted mt-1 line-clamp-2">{product.description}</p> : null}
        <p className="mt-2 text-sm font-semibold">
          {product.soldOut ? <span className="text-danger">Sold out</span> : <>{product.sizes.length > 1 ? "from " : ""}{gbpShort(min)}</>}
          <span className="ml-2"><DietBadges tags={product.tags} /></span>
        </p>
      </div>
      {image ? (
        <div className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-surface-2">
          <Image src={image} alt={product.name} fill sizes="96px" className="object-cover" loading="lazy" unoptimized={image.endsWith(".svg")} />
        </div>
      ) : null}
    </Link>
  );
}
