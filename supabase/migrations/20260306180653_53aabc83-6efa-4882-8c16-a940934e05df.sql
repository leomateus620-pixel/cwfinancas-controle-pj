-- Update validate_amount_precision to also handle bank_balances
CREATE OR REPLACE FUNCTION public.validate_amount_precision()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'transactions' THEN
    NEW.amount := round(NEW.amount, 2);
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    NEW.value := round(NEW.value, 2);
  ELSIF TG_TABLE_NAME = 'balance_sheet_items' THEN
    NEW.amount := round(NEW.amount, 2);
  ELSIF TG_TABLE_NAME = 'bank_balances' THEN
    NEW.opening_balance := round(NEW.opening_balance, 2);
    NEW.closing_balance := round(NEW.closing_balance, 2);
  END IF;
  RETURN NEW;
END;
$function$;

-- Add trigger on bank_balances table
CREATE TRIGGER validate_bank_balance_precision
  BEFORE INSERT OR UPDATE ON public.bank_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_amount_precision();