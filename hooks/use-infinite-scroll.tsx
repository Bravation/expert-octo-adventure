import { useEffect, useRef, useState } from "react";

interface UseInfiniteScrollOptions {
  threshold?: number;
  rootMargin?: string;
}

export function useInfiniteScroll(
  callback: () => void,
  options: UseInfiniteScrollOptions = {}
) {
  const { threshold = 0.5, rootMargin = "0px" } = options;
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!targetElement) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          callback();
        }
      },
      { threshold, rootMargin }
    );

    observerRef.current.observe(targetElement);

    return () => {
      if (observerRef.current && targetElement) {
        observerRef.current.unobserve(targetElement);
      }
    };
  }, [targetElement, callback, threshold, rootMargin]);

  return setTargetElement;
}
