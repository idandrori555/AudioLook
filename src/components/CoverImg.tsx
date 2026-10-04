import React, { useState } from 'react';

interface CoverImgProps {
  src: string;
  alt: string;
  className?: string;
  iconClassName?: string;
}

// Inline SVG fallback for cover images.
export const FALLBACK_COVER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='%231d1e23'/%3E%3Ccircle cx='100' cy='100' r='44' fill='%23ffb86b' fill-opacity='0.25'/%3E%3Ccircle cx='100' cy='100' r='26' fill='%23ffb86b' fill-opacity='0.6'/%3E%3C/svg%3E";

// Cover art with a graceful fallback: if the remote thumbnail 404s offline,
// show an amber icon tile instead of the browser's broken-image glyph.
export default function CoverImg({ src, alt, className, iconClassName }: CoverImgProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        role="img"
        aria-label={alt}
        className={`bg-gradient-to-b from-[#2e2f36] to-[#1d1e23] text-[#ffb86b]/70 flex items-center justify-center ${className ?? ''}`}
      >
        <span className={`material-symbols-outlined ${iconClassName ?? 'text-[20px]'}`}>auto_stories</span>
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      draggable={false}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
