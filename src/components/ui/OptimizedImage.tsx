import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function OptimizedImage({
  src,
  alt,
  fallback = '/assets/nexora-logo-bg.jpg',
  className,
  eager = false,
}: {
  src?: string;
  alt: string;
  fallback?: string;
  className?: string;
  eager?: boolean;
}) {
  const [currentSrc, setCurrentSrc] = useState(src || fallback);
  return (
    <img
      src={currentSrc || fallback}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setCurrentSrc(fallback)}
      className={cn('bg-[#0b0b0d] object-cover', className)}
    />
  );
}
