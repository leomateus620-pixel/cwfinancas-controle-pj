
-- Round existing data to 2 decimal places
UPDATE public.transactions SET amount = round(amount::numeric, 2) WHERE amount != round(amount::numeric, 2);
UPDATE public.invoices SET value = round(value::numeric, 2) WHERE value != round(value::numeric, 2);
UPDATE public.balance_sheet_items SET amount = round(amount::numeric, 2) WHERE amount != round(amount::numeric, 2);

-- Alter column types to NUMERIC(14,2)
ALTER TABLE public.transactions ALTER COLUMN amount TYPE NUMERIC(14,2);
ALTER TABLE public.invoices ALTER COLUMN value TYPE NUMERIC(14,2);
ALTER TABLE public.balance_sheet_items ALTER COLUMN amount TYPE NUMERIC(14,2);

-- Create validation trigger to ensure 2 decimal places
CREATE OR REPLACE FUNCTION public.validate_amount_precision()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'transactions' THEN
    NEW.amount := round(NEW.amount, 2);
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    NEW.value := round(NEW.value, 2);
  ELSIF TG_TABLE_NAME = 'balance_sheet_items' THEN
    NEW.amount := round(NEW.amount, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_transactions_amount
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.validate_amount_precision();

CREATE TRIGGER validate_invoices_value
BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.validate_amount_precision();

CREATE TRIGGER validate_balance_sheet_amount
BEFORE INSERT OR UPDATE ON public.balance_sheet_items
FOR EACH ROW EXECUTE FUNCTION public.validate_amount_precision();
