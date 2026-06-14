import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { formatCurrency, parseCurrencyInput, sanitizePrice } from "@/lib/currency";
import { ArrowLeft, Paperclip, X, FileText, Calendar, DollarSign, PaperclipIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const QUOTE_MIN = 20;
const QUOTE_MAX = 200_000;

const validateQuotePrice = (val: string): string | undefined => {
  const cleaned = parseCurrencyInput(val);
  if (!cleaned || cleaned === ".") return "Price must be a valid number";
  const num = parseFloat(cleaned);
  if (isNaN(num)) return "Price must be a valid number";
  if (num < QUOTE_MIN) return `Minimum quote is $${QUOTE_MIN}`;
  if (num > QUOTE_MAX) return `Maximum quote is $${QUOTE_MAX.toLocaleString()}`;
  const decimals = cleaned.split(".")[1]?.length ?? 0;
  if (decimals > 2) return "Price cannot have more than 2 decimal places";
  return undefined;
};

const quoteSchema = z.object({
  price: z
    .number({ invalid_type_error: "Price must be a number" })
    .min(QUOTE_MIN, `Minimum quote is $${QUOTE_MIN}`)
    .max(QUOTE_MAX, `Maximum quote is $${QUOTE_MAX.toLocaleString()}`),
  preferredDate: z.string().optional(),
  description: z
    .string()
    .trim()
    .min(10, "Please describe your request (at least 10 characters)")
    .max(1000, "Description must be less than 1000 characters"),
});

type FormErrors = Partial<Record<keyof z.infer<typeof quoteSchema>, string>>;

type ServiceRow = {
  id: string;
  title: string;
  description: string;
  price: number;
  provider_id: string;
  profiles?: { full_name: string } | null;
};

const RequestQuote = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [service, setService] = useState<ServiceRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [price, setPrice] = useState<string>("");
  const [priceFocused, setPriceFocused] = useState(false);
  const [useListedPrice, setUseListedPrice] = useState(true);
  const [preferredDate, setPreferredDate] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    const remaining = MAX_FILES - files.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_FILES} files allowed`);
      return;
    }
    const valid = picked.slice(0, remaining).filter((f) => {
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name} is larger than 10MB`);
        return false;
      }
      return true;
    });
    setFiles([...files, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (): Promise<string[]> => {
    if (!files.length || !user) return [];
    const urls: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("quote-attachments")
        .upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("quote-attachments").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  };






  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = parseCurrencyInput(e.target.value);
    setPrice(cleaned);
    const err = validateQuotePrice(cleaned);
    setErrors((prev) => ({ ...prev, price: err }));
  };

  const handlePriceBlur = () => {
    setPriceFocused(false);
    // Normalize stored value on blur (e.g. "1200." -> "1200", ".5" -> "0.5").
    const cleaned = parseCurrencyInput(price);
    if (cleaned !== price) {
      setPrice(cleaned);
      setErrors((prev) => ({ ...prev, price: validateQuotePrice(cleaned) }));
    }
  };


  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (profile && profile.role !== "customer") {
      toast.error("Only customers can request quotes");
      navigate("/services");
    }
  }, [user, profile, navigate]);

  useEffect(() => {
    const load = async () => {
      if (!serviceId) return;
      const { data, error } = await supabase
        .from("services")
        .select("id, title, description, price, provider_id, profiles:provider_id(full_name)")
        .eq("id", serviceId)
        .maybeSingle();
      if (error || !data) {
        toast.error("Service not found");
        navigate("/services");
        return;
      }
      const svc = data as unknown as ServiceRow;
      setService(svc);
      if (useListedPrice) setPrice(String(svc.price ?? ""));
      const prefill = [
        `I'm interested in: ${svc.title}`,
        `Listed price: ${formatCurrency(String(svc.price))}`,
        "",
        `Service description: ${svc.description || "N/A"}`,
        "",
        "Please provide a quote with details about my specific requirements:",
      ].join("\n");
      setDescription(prefill);
      setLoading(false);
    };
    load();
  }, [serviceId, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service || !profile) return;

    const parsed = quoteSchema.safeParse({
      price: sanitizePrice(price),
      preferredDate: preferredDate || undefined,
      description,
    });
    if (!parsed.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormErrors;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    const fullDescription = parsed.data.preferredDate
      ? `Preferred date: ${parsed.data.preferredDate}\n\n${parsed.data.description}`
      : parsed.data.description;

    setSubmitting(true);
    let attachmentUrls: string[] = [];
    try {
      attachmentUrls = await uploadAttachments();
    } catch (err: any) {
      setSubmitting(false);
      toast.error(`Attachment upload failed: ${err.message}`);
      return;
    }

    const { error } = await supabase.from("custom_quotes").insert({
      service_id: service.id,
      provider_id: service.provider_id,
      customer_id: profile.id,
      custom_price: parsed.data.price,
      description: fullDescription,
      attachment_urls: attachmentUrls,
    });
    setSubmitting(false);

    if (error) {
      // Server-side validation errors come back as "field: message"
      const match = error.message.match(/^(price|description):\s*(.+)$/);
      if (match) {
        const field = match[1] as keyof FormErrors;
        setErrors({ [field]: match[2] } as FormErrors);
        toast.error(match[2]);
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Quote request sent! The provider will respond shortly.");
    navigate("/my-requests");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Request a Quote</CardTitle>
            <CardDescription>
              {service?.title}
              {service?.profiles?.full_name ? ` · by ${service.profiles.full_name}` : ""}
              {" · Listed at "}
              {formatCurrency(String(service?.price ?? 0))}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="price">
                  {useListedPrice ? "Listed price (USD)" : "Your proposed price (USD)"} *
                </Label>
                <Input
                  id="price"
                  type="text"
                  inputMode="decimal"
                  min={QUOTE_MIN}
                  max={QUOTE_MAX}
                  step={0.01}
                  value={priceFocused ? price : formatCurrency(price)}
                  onChange={handlePriceChange}
                  onFocus={() => setPriceFocused(true)}
                  onBlur={handlePriceBlur}
                  placeholder="e.g. $150.00"
                  aria-invalid={!!errors.price}
                  disabled={useListedPrice}
                  required
                />
                {errors.price ? (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <span className="inline-block w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-xs text-center leading-4">!</span>
                    {errors.price}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Min ${QUOTE_MIN} · Max ${QUOTE_MAX.toLocaleString()} · Provider can adjust after review · Up to 2 decimals</p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="useListedPrice"
                    checked={useListedPrice}
                    onCheckedChange={(checked) => {
                      setUseListedPrice(Boolean(checked));
                      if (checked && service) {
                        setPrice(String(service.price ?? ""));
                        setErrors((prev) => ({ ...prev, price: undefined }));
                      }
                    }}
                  />
                  <Label htmlFor="useListedPrice" className="text-sm font-normal cursor-pointer">
                    Use listed price
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferredDate">Preferred date (optional)</Label>
                <Input
                  id="preferredDate"
                  type="date"
                  value={preferredDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setPreferredDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Describe your request *</Label>
                <Textarea
                  id="description"
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Share details about the job: scope, location, materials, timing, etc."
                  maxLength={1000}
                  aria-invalid={!!errors.description}
                  required
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  {errors.description ? (
                    <span className="text-destructive">{errors.description}</span>
                  ) : (
                    <span>Min 10 characters</span>
                  )}
                  <span>{description.length}/1000</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Attachments (optional)</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.doc,.docx,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {files.length > 0 && (
                  <ul className="space-y-1">
                    {files.map((f, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                      >
                        <span className="truncate">
                          {f.name}{" "}
                          <span className="text-xs text-muted-foreground">
                            ({(f.size / 1024).toFixed(0)} KB)
                          </span>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => removeFile(i)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {files.length < MAX_FILES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-20 w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-muted-foreground/30 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    <Paperclip className="h-4 w-4" />
                    Add file ({files.length}/{MAX_FILES}) — images, PDF, DOC, up to 10MB
                  </button>
                )}
              </div>

              {/* Live Preview Panel */}
              <div className="rounded-xl border bg-muted/40 p-5 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  Request Summary
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <DollarSign className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {useListedPrice ? "Listed price" : "Proposed price"}
                      </p>
                      <p className="text-sm font-medium">
                        {price ? formatCurrency(price) : <span className="text-muted-foreground italic">Not set</span>}
                      </p>
                    </div>
                  </div>

                  {preferredDate && (
                    <div className="flex items-start gap-3">
                      <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Preferred date</p>
                        <p className="text-sm font-medium">{new Date(preferredDate + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="w-full">
                      <p className="text-xs text-muted-foreground">Description</p>
                      <p className="text-sm font-medium whitespace-pre-wrap line-clamp-4">
                        {description.trim() || <span className="text-muted-foreground italic">No description yet</span>}
                      </p>
                      {description.length > 300 && (
                        <p className="text-xs text-muted-foreground mt-1">{description.length} characters</p>
                      )}
                    </div>
                  </div>

                  {files.length > 0 && (
                    <div className="flex items-start gap-3">
                      <PaperclipIcon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Attachments</p>
                        <p className="text-sm font-medium">{files.length} file{files.length !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Sending…" : "Send Request"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Need to see other services?{" "}
          <Link to="/services" className="underline">
            Browse services
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RequestQuote;