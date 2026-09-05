/**
 * The "home of the 20 inch pizza" stamp.
 *
 * This is the shop's one genuinely unusual claim, so it earns more than a line
 * of body copy. Set around a circle it becomes a mark rather than a sentence -
 * it reads from across the room, it sits over the photograph without fighting
 * the headline for the same horizontal space, and the size itself lands in the
 * middle where the eye goes first.
 *
 * Server-rendered SVG with a CSS rotation: no JavaScript, no layout work, and
 * the whole thing composites on the GPU.
 */
export function HeroStamp({
  ring = "Home of the 20 inch",
  centre = '20"',
  under = "Fresh · Handmade",
}: {
  ring?: string;
  centre?: string;
  under?: string;
}) {
  // One pass round the circle. The path at r=74 is roughly 465 units long, so
  // a single short phrase clears its own tail with room to spare.
  const around = `${ring.toUpperCase()}   ·   `;

  return (
    <div className="fp-stamp" aria-hidden="true">
      <svg viewBox="0 0 200 200" className="fp-stamp-ink">
        <defs>
          <path
            id="fp-stamp-path"
            d="M 100,100 m -74,0 a 74,74 0 1,1 148,0 a 74,74 0 1,1 -148,0"
            fill="none"
          />
          {/* A real rubber stamp never prints evenly. Turbulence knocks holes
              through the ink and roughens every edge, which is what makes it
              read as stamped rather than drawn. Static, so it costs one paint. */}
          <filter id="fp-stamp-worn" x="-12%" y="-12%" width="124%" height="124%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" seed="7" result="grain" />
            <feColorMatrix in="grain" type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.05" result="holes" />
            <feComposite in="SourceGraphic" in2="holes" operator="in" result="eaten" />
            <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="3" result="warp" />
            <feDisplacementMap in="eaten" in2="warp" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>

        <g filter="url(#fp-stamp-worn)">
          <circle cx="100" cy="100" r="92" className="fp-stamp-edge" />
          <circle cx="100" cy="100" r="70" className="fp-stamp-edge fp-stamp-edge-thin" />
          <text className="fp-stamp-text">
            <textPath href="#fp-stamp-path" startOffset="1%">{around}</textPath>
          </text>
          <text x="100" y="112" textAnchor="middle" className="fp-stamp-size">{centre}</text>
          <text x="100" y="132" textAnchor="middle" className="fp-stamp-under">{under.toUpperCase()}</text>
        </g>
      </svg>
    </div>
  );
}
