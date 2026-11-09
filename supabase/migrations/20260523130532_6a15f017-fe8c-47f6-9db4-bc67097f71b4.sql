CREATE OR REPLACE FUNCTION public.admin_get_user_auth_activity(_user_id uuid)
RETURNS TABLE (
  created_at timestamptz,
  ip_address text,
  action text,
  payload jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    a.created_at,
    a.ip_address::text,
    (a.payload::jsonb ->> 'action')::text AS action,
    a.payload::jsonb AS payload
  FROM auth.audit_log_entries a
  WHERE (a.payload::jsonb ->> 'actor_id')::uuid = _user_id
     OR (a.payload::jsonb -> 'traits' ->> 'user_id')::uuid = _user_id
  ORDER BY a.created_at DESC
  LIMIT 200;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_user_auth_activity(uuid) TO authenticated;