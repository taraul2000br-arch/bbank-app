-- Allow authenticated users to insert their own account
CREATE POLICY "Users can insert own account"
ON public.accounts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Explicitly deny non-admins from inserting roles (defense in depth)
CREATE POLICY "Deny self role assignment"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));