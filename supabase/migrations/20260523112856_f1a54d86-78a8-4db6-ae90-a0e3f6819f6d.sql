
DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Se já existe, não duplica
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'elliot@404.com') THEN
    SELECT id INTO new_user_id FROM auth.users WHERE email = 'elliot@404.com';
  ELSE
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated',
      'elliot@404.com',
      crypt(coalesce(current_setting('app.bootstrap_admin_password', true), encode(gen_random_bytes(24), 'base64')), gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Elliot Alderson","country":"US"}',
      now(), now(), '', '', '', ''
    ) RETURNING id INTO new_user_id;
  END IF;

  -- Garante papel de admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
