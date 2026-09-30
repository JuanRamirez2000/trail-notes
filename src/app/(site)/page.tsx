import { Gallery } from "@/components/gallery/Gallery";
import { getHikeSummaries } from "@/lib/content";

export default function HomePage() {
  return <Gallery hikes={getHikeSummaries()} />;
}
