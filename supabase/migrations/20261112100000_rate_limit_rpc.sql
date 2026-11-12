CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key text,
  p_window_start bigint,
  p_now bigint,
  p_limit integer,
  p_retention_ms bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  updated_count integer;
BEGIN
  DELETE FROM public.rate_limit
  WHERE window_start < p_now - p_retention_ms;

  INSERT INTO public.rate_limit (rate_key, count, window_start)
  VALUES (p_key, 1, p_window_start)
  ON CONFLICT (rate_key, window_start)
  DO UPDATE SET count = public.rate_limit.count + 1
  WHERE public.rate_limit.count < p_limit
  RETURNING count INTO updated_count;

  RETURN updated_count IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, bigint, bigint, integer, bigint)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, bigint, bigint, integer, bigint)
TO service_role;
