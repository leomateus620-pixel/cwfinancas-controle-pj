
-- 1) Add 'cliente' to app_role enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'cliente'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'cliente';
  END IF;
END $$;

-- 2) client_users table
CREATE TABLE IF NOT EXISTS public.client_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  display_name text,
  created_by uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "internal manage client users" ON public.client_users;
CREATE POLICY "internal manage client users"
  ON public.client_users
  FOR ALL
  TO authenticated
  USING (public.is_internal())
  WITH CHECK (public.is_internal());

DROP POLICY IF EXISTS "client read own row" ON public.client_users;
CREATE POLICY "client read own row"
  ON public.client_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_client_users_updated_at ON public.client_users;
CREATE TRIGGER trg_client_users_updated_at
  BEFORE UPDATE ON public.client_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Update handle_new_user to honor metadata.role = 'cliente'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  meta_role text;
BEGIN
  meta_role := NEW.raw_user_meta_data->>'role';

  INSERT INTO public.profiles (id, full_name, company_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name'),
    NEW.raw_user_meta_data->>'company_name'
  );

  IF meta_role = 'cliente' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cliente');
    INSERT INTO public.client_users (user_id, username, display_name, created_by)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
      NEW.raw_user_meta_data->>'display_name',
      NULLIF(NEW.raw_user_meta_data->>'created_by','')::uuid
    )
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$function$;
