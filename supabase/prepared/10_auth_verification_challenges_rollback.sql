-- ==============================================================================
-- 10_AUTH_VERIFICATION_CHALLENGES_ROLLBACK.SQL
-- Target Project: bankfuncional (rbhczirsgprmynpiudmi)
-- Status: PREPARED FOR CONTINGENCY ROLLBACK
-- DO NOT EXECUTE AUTOMATICALLY
-- ==============================================================================
-- Safely drops all objects created by 10_auth_verification_challenges.sql
-- Restores database to exact previous state with zero impact on users or finances.
-- ==============================================================================

DROP FUNCTION IF EXISTS public.purge_expired_auth_challenges();
DROP FUNCTION IF EXISTS public.verify_sort_code_attempt(UUID, TEXT);
DROP FUNCTION IF EXISTS public.create_verification_challenge(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.extract_account_sort_code(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.normalize_sort_code(TEXT);

DROP TABLE IF EXISTS public.auth_verification_challenges CASCADE;
