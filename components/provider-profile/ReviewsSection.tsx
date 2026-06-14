import { Card, CardContent } from "@/components/ui/card";
import StarRating from "@/components/services/StarRating";
import { useTranslation } from "react-i18next";

type Props = {
  reviews: any[];
};

const ReviewsSection = ({ reviews }: Props) => {
  const { t } = useTranslation();

  return (
    <>
      <h2 className="mb-4 mt-8 font-display text-xl font-semibold">{t("provider.reviews")}</h2>
      {reviews.length === 0 ? (
        <p className="text-muted-foreground">{t("provider.noReviews")}</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{(r as any).profiles?.full_name || t("provider.anonymous")}</p>
                    <StarRating rating={r.rating} showCount={false} />
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                {r.comment && <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
};

export default ReviewsSection;
