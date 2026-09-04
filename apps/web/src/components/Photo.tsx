import Image from "next/image";

/** Every content photograph in the Modernist system goes through `.grayscale`
 *  (`filter: grayscale(1) contrast(1.08)`) - the images are stored in colour and
 *  desaturated here, so a tenant can switch to colour by dropping one class.
 *
 *  With no image yet it draws a monogram tile instead of an empty frame. The
 *  hatched placeholder the prototype used reads as a broken image once a menu
 *  is half photographed - which is the normal state for a shop still sending
 *  its pictures over - so an un-photographed item gets something deliberate
 *  rather than something missing. Pass `monogram` to set the letters; it
 *  otherwise takes the initials out of `alt`. */
export function Photo({
  src, alt, caption, monogram, ratio = "4/3", height, priority = false,
  sizes = "(max-width: 440px) calc(100vw - 64px), (max-width: 700px) calc(50vw - 40px), (max-width: 1000px) 33vw, 300px",
}: {
  src?: string;
  alt: string;
  caption: string;
  monogram?: string;
  ratio?: string;
  height?: number;
  priority?: boolean;
  sizes?: string;
}) {
  const box: React.CSSProperties = height
    ? { height, minWidth: 0, overflow: "hidden", position: "relative" }
    : { aspectRatio: ratio, minWidth: 0, overflow: "hidden", position: "relative" };

  if (!src) {
    // Two initials from the name - "Meat Feast" becomes MF, "Hawaiian" HA.
    const words = alt.trim().split(/\s+/).filter(Boolean);
    const letters = (monogram
      ?? (words.length > 1
        ? `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`
        : (words[0] ?? "").slice(0, 2))
    ).toUpperCase();

    return (
      <div className="fp-photo" style={box}>
        <span className="fp-photo-mono" aria-hidden="true">{letters}</span>
        <span className="fp-photo-cap">{caption}</span>
      </div>
    );
  }

  return (
    <div className="grayscale" style={{ ...box, background: "var(--color-surface)" }}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        style={{ objectFit: "cover" }}
        unoptimized={src.endsWith(".svg")}
      />
    </div>
  );
}
