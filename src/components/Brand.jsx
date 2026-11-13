import Link from "next/link";

export default function Brand({ href = "/", label = "Tracewell home" }) {
  return (
    <Link className="brand" href={href} aria-label={label}>
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>
      </span>
      <span>tracewell<span className="brand-dot">.</span></span>
    </Link>
  );
}
