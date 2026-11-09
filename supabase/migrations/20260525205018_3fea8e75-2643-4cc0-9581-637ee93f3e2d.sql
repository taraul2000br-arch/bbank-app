GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_admin_see(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_level(uuid) TO authenticated, anon;