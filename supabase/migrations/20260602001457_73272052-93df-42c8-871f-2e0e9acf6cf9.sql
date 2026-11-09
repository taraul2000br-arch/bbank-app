-- Refund the $200 that was previously debited on submit (now pending-only)
-- and remove the matching "saida" transaction for the test user.
UPDATE public.accounts
SET balance = balance + 200
WHERE user_id = 'f12008fa-2f6d-49e8-9497-467bca614801';

DELETE FROM public.transactions
WHERE user_id = 'f12008fa-2f6d-49e8-9497-467bca614801'
  AND type = 'saida'
  AND amount = 200
  AND description LIKE 'International transfer to Maria Alves Pereira%under analysis%';