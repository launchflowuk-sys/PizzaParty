import Image from "next/image";

/** Every content photograph in the Modernist system goes through `.grayscale`
 *  (`filter: grayscale(1) contrast(1.08)`) - the images are stored in colour and
 *  desaturated here, so a tenant can switch to colour by dropping one class.
 *
 *  With no image yet, this falls back to the prototype's hatched placeholder with
 *  its monospace caption, so an un-photographed product still looks designed. */
export function Photo({
  src, alt, caption, ratio = "4/3", height, priority = false,
  sizes = "(max-width: 440px) calc(100vw - 64px), (max-width: 700px) calc(50vw - 40px), (max-width: 1000px) 33vw, 300px",
}: {
  src?: string;
  alt: string;
  caption: string;
  ratio?: string;
  height?: number;
  priority?: boolean;
  sizes?: string;
}) {
  const box: React.CSSProperties = height
    ? { height, minWidth: 0, overflow: "hidden", position: "relative" }
    : { aspectRatio: ratio, minWidth: 0, overflow: "hidden", position: "relative" };

  if (!src) {
    return (
      <div className="fp-photo" style={box}>
        <span>{caption}</span>
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
