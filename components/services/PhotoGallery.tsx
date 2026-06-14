import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

type PhotoGalleryProps = {
  photos: string[];
  captions?: string[];
  alts?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialIndex?: number;
};

const PhotoGallery = ({ photos, captions, alts, open, onOpenChange, initialIndex = 0 }: PhotoGalleryProps) => {
  const [current, setCurrent] = useState(initialIndex);

  const prev = () => setCurrent((c) => (c === 0 ? photos.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === photos.length - 1 ? 0 : c + 1));

  if (!photos.length) return null;

  const currentCaption = captions?.[current];
  const currentAlt = alts?.[current] || currentCaption || `Photo ${current + 1}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl border-none bg-black/95 p-0 shadow-2xl [&>button]:hidden">
        {/* Close */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 z-20 rounded-full bg-background/20 p-2 text-white backdrop-blur-sm transition-colors hover:bg-background/40"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Main image */}
        <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-lg">
          <img
            src={photos[current]}
            alt={currentAlt}
            className="max-h-full max-w-full object-contain"
          />

          {/* Nav arrows */}
          {photos.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/20 text-white backdrop-blur-sm hover:bg-background/40 hover:text-white"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/20 text-white backdrop-blur-sm hover:bg-background/40 hover:text-white"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </>
          )}

          {/* Counter + Caption overlay */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
            {photos.length > 1 && (
              <div className="rounded-full bg-background/30 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                {current + 1} / {photos.length}
              </div>
            )}
            {currentCaption && (
              <div className="max-w-md rounded-lg bg-black/60 px-4 py-2 text-center text-xs font-medium text-white backdrop-blur-sm">
                {currentCaption}
              </div>
            )}
          </div>
        </div>

        {/* Thumbnails */}
        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-4">
            {photos.map((photo, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={alts?.[i] || captions?.[i] || `View photo ${i + 1}`}
                className={cn(
                  "h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-all",
                  i === current
                    ? "border-primary ring-1 ring-primary"
                    : "border-transparent opacity-60 hover:opacity-100"
                )}
              >
                <img src={photo} alt={alts?.[i] || captions?.[i] || ""} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PhotoGallery;
