import { cn } from "@/lib/cn";
import Image from "next/image";
import { photoUrl, type PhotoVariant } from "@/lib/storage";

type Props = {
  /** Missing key renders the contour-map placeholder (e.g. a hike with a GPX track but no photos yet). */
  photoKey?: string;
  alt: string;
  variant?: PhotoVariant;
  sizes?: string;
  priority?: boolean;
  className?: string;
};

/** Fills its (relatively positioned) parent. Falls back to design stripes behind the image. */
export function Photo({ photoKey, alt, variant = "full", sizes = "(min-width: 1024px) 760px, 100vw", priority, className }: Props) {
  if (!photoKey) return <div className={cn("bg-contour relative overflow-hidden", className)} role="img" aria-label={alt || undefined} />;
  return (
    <div className={cn("bg-stripes relative overflow-hidden", className)}>
      <Image src={photoUrl(photoKey, variant)} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}
