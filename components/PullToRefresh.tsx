import { useState, useRef, useCallback } from "react";
import { ArrowDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type PullToRefreshProps = {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
};

const THRESHOLD = 80;

const PullToRefresh = ({ onRefresh, children }: PullToRefreshProps) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, 120));
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      await onRefresh();
      setRefreshing(false);
    }
    setPullDistance(0);
  }, [pullDistance, refreshing, onRefresh]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      <div
        className={cn(
          "absolute left-0 right-0 flex items-center justify-center transition-opacity",
          pullDistance > 10 ? "opacity-100" : "opacity-0"
        )}
        style={{ top: -40, height: 40, transform: `translateY(${pullDistance}px)` }}
      >
        {refreshing ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <ArrowDown
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform",
              pullDistance >= THRESHOLD && "rotate-180 text-primary"
            )}
          />
        )}
      </div>
      <div
        style={{ transform: `translateY(${pullDistance}px)`, transition: pulling.current ? "none" : "transform 0.3s ease" }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
