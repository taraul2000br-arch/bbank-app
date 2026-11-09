-- 1) Allow users to read their own login events
CREATE POLICY "Users view own login events"
ON public.user_login_events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2) Hard block self-grant on user_roles (RESTRICTIVE applies on top of permissive admin policy)
CREATE POLICY "No self role insert"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated, anon
WITH CHECK (user_id <> auth.uid());

CREATE POLICY "No self role update"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated, anon
USING (user_id <> auth.uid())
WITH CHECK (user_id <> auth.uid());