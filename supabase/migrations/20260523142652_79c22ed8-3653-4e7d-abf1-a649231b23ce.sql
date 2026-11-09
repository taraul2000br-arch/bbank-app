-- Accounts are created exclusively by the handle_new_user() SECURITY DEFINER trigger.
-- No client path should insert or delete account rows.

DROP POLICY IF EXISTS "Users can insert own account" ON public.accounts;

-- Restrictive deny policies (apply to all roles, including authenticated)
CREATE POLICY "No client inserts on accounts"
ON public.accounts
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (false);

CREATE POLICY "No client deletes on accounts"
ON public.accounts
AS RESTRICTIVE
FOR DELETE
TO public
USING (false);