import { Star } from "lucide-react";

type StarRatingProps = {
  rating: number;
  totalReviews?: number;
  size?: "sm" | "md";
  showCount?: boolean;
};

const StarRating = ({ rating, totalReviews = 0, size = "sm", showCount = true }: StarRatingProps) => {
  const starSize = size === "sm" ? "h-3.5 w-3.5" : "h-4.5 w-4.5";

  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${starSize} ${
              star <= Math.round(rating)
                ? "fill-warning text-warning"
                : "fill-muted text-muted"
            }`}
          />
        ))}
      </div>
      {showCount && (
        <span className="text-xs text-muted-foreground">
          ({totalReviews})
        </span>
      )}
    </div>
  );
};

export default StarRating;
