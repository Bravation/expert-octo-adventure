CREATE TRIGGER on_customer_milestone_update
  AFTER UPDATE ON public.customer_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_customer_milestone();