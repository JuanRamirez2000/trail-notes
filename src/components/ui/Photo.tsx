import { cn } from "@/lib/cn";
import Image from "next/image";
import { photoUrl, type PhotoVariant } from "@/lib/storage";

type Props = {
  photoKey: string;
  alt: string;
  variant?: PhotoVariant;
  sizes?: string;
  priority?: boolean;
  className?: string;
};

/** Fills its (relatively positioned) parent. Falls back to design stripes behind the image. */
export function Photo({ photoKey, alt, variant = "full", sizes = "(min-width: 1024px) 760px, 100vw", priority, className }: Props) {
  return (
    <div className={cn("bg-stripes relative overflow-hidden", className)}>
      <Image src={photoUrl(photoKey, variant)} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}
