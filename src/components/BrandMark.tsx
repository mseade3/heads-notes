import Link from "next/link";

type BrandMarkProps = {
  href?: string;
  compact?: boolean;
};

export function BrandMark({ href = "/", compact = false }: BrandMarkProps) {
  const content = (
    <div className={compact ? "inline-flex items-center gap-2" : "inline-flex flex-col items-center"}>
      <div className={compact ? "inline-flex items-center gap-2" : "inline-flex items-center gap-2"}>
        <span className="brand-crown" aria-hidden="true">
          <svg viewBox="0 0 60 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M4 34L10 8L24 21L30 5L36 21L50 8L56 34H4Z"
              fill="#D4AF37"
              stroke="#F2D57B"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M6 34H54" stroke="#9A7A25" strokeWidth="2" />
          </svg>
        </span>
        <span className={`brand-title ${compact ? "text-xl" : "text-4xl"}`}>H.E.A.D.S</span>
      </div>
      <span className={`brand-subtitle ${compact ? "text-[10px]" : "text-xs"}`}>-EST 1998-</span>
    </div>
  );

  return (
    <Link href={href} className="inline-flex items-center text-current">
      {content}
    </Link>
  );
}
