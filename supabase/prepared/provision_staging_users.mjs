import { createClient } from '@supabase/supabase-js';

const REQUIRED_STAGING_REF = 'rbhczirsgprmynpiudmi';
const FORBIDDEN_PROD_REF = 'sfyzdvyqnomjjypprzgm';

function cleanUrl(raw) {
  if (!raw) return '';
  let u = raw.trim();
  u = u.replace(/\/rest\/v1\/?$/i, '');
  u = u.replace(/\/+$/, '');
  return u;
}

function extractRef(url) {
  try {
    const parsed = new URL(url);
    const hostParts = parsed.hostname.split('.');
    return hostParts[0];
  } catch {
    return '';
  }
}

const supabaseUrl = cleanUrl(process.env.TEST_SUPABASE_URL || process.env.SUPABASE_URL);
const serviceRoleKey = (process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERRO: TEST_SUPABASE_URL ou TEST_SUPABASE_SERVICE_ROLE_KEY ausentes.');
  process.exit(1);
}

const detectedRef = extractRef(supabaseUrl);
if (detectedRef === FORBIDDEN_PROD_REF) {
  console.error('SEGURANÇA: Tentativa de conectar ao banco de PRODUÇÃO bloqueada!');
  process.exit(1);
}

if (detectedRef !== REQUIRED_STAGING_REF) {
  console.error(`ERRO: Project Ref ${detectedRef} não corresponde ao staging autorizado (${REQUIRED_STAGING_REF}).`);
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_USERS = [
  {
    email: 'admin.sim@bbank.com',
    password: 'Password123!',
    fullName: 'Bank Admin Officer',
    role: 'admin',
    balance: 50000.00,
    referralCode: 'BBANK2026',
    isBlocked: false,
    transferLocked: false,
  },
  {
    email: 'john.sim@bbank.com',
    password: 'Password123!',
    fullName: 'John Simulation Doe',
    role: 'user',
    balance: 1500.00,
    referralCode: 'JOHNSIM2026',
    isBlocked: false,
    transferLocked: false,
  },
  {
    email: 'blocked.sim@bbank.com',
    password: 'Password123!',
    fullName: 'Blocked Compliance Client',
    role: 'user',
    balance: 500.00,
    referralCode: 'BLOCKED2026',
    isBlocked: true,
    transferLocked: true,
  },
];

async function main() {
  console.log('=== PROVISIONAMENTO SEGURO DE USUÁRIOS DE TESTE (STAGING) ===');
  console.log(`Target: ${detectedRef} (${supabaseUrl})`);

  // 1. Check if public.accounts table exists
  const { data: testAccounts, error: checkErr } = await supabaseAdmin
    .from('accounts')
    .select('id')
    .limit(1);

  if (checkErr && checkErr.code === '42P01') {
    console.error('\nATENÇÃO: O schema bancário ainda não foi instalado no bankfuncional.');
    console.error('Execute o script ALL_IN_ONE_STAGING_SETUP.sql no SQL Editor do Supabase antes de provisionar usuários.');
    process.exit(1);
  }

  // 2. Fetch existing auth users to avoid duplicates
  const { data: authList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) {
    console.error('Erro ao listar usuários auth:', listErr.message);
    process.exit(1);
  }

  const existingAuthUsers = authList.users || [];

  for (const u of TEST_USERS) {
    console.log(`\nProcessando: ${u.email} (${u.role})...`);
    let authUser = existingAuthUsers.find(
      (eu) => eu.email && eu.email.toLowerCase() === u.email.toLowerCase()
    );

    if (!authUser) {
      console.log(`  -> Criando via supabaseAdmin.auth.admin.createUser()...`);
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: {
          full_name: u.fullName,
          country: 'GB',
          referral_code: u.referralCode,
        },
      });

      if (createErr) {
        console.error(`  ERRO ao criar ${u.email}:`, createErr.message);
        continue;
      }
      authUser = created.user;
      console.log(`  -> Criado com ID: ${authUser.id}`);
    } else {
      console.log(`  -> Usuário já existe no Auth (ID: ${authUser.id}). Atualizando senha...`);
      await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        password: u.password,
        email_confirm: true,
      });
    }

    const userId = authUser.id;

    // 3. Upsert Profile
    const { error: profErr } = await supabaseAdmin.from('profiles').upsert(
      {
        user_id: userId,
        full_name: u.fullName,
        country: 'GB',
        referral_code: u.referralCode,
        account_blocked: u.isBlocked,
        transfer_locked: u.transferLocked,
        kyc_status: 'approved',
      },
      { onConflict: 'user_id' }
    );
    if (profErr) console.warn('  Aviso profile:', profErr.message);

    // 4. Upsert Role
    const { error: roleErr } = await supabaseAdmin.from('user_roles').upsert(
      {
        user_id: userId,
        role: u.role,
      },
      { onConflict: 'user_id,role' }
    );
    if (roleErr) console.warn('  Aviso role:', roleErr.message);

    // 5. Ensure Account with GBP balance
    const { data: existingAcc } = await supabaseAdmin
      .from('accounts')
      .select('id, balance')
      .eq('user_id', userId)
      .maybeSingle();

    let accountId;
    if (existingAcc) {
      accountId = existingAcc.id;
      console.log(`  -> Conta existente (ID: ${accountId}), atualizando saldo para £ ${u.balance.toFixed(2)} GBP...`);
      await supabaseAdmin
        .from('accounts')
        .update({
          balance: u.balance,
          currency: 'GBP',
          status: u.isBlocked ? 'bloqueado' : 'ativo',
          is_blocked: u.isBlocked,
          transfer_locked: u.transferLocked,
        })
        .eq('id', accountId);
    } else {
      const generatedAccNum = '20-00-01 ' + Math.floor(10000000 + Math.random() * 90000000);
      console.log(`  -> Criando nova conta ${generatedAccNum} com saldo £ ${u.balance.toFixed(2)} GBP...`);
      const { data: newAcc, error: accErr } = await supabaseAdmin
        .from('accounts')
        .insert({
          user_id: userId,
          account_number: generatedAccNum,
          balance: u.balance,
          currency: 'GBP',
          status: u.isBlocked ? 'bloqueado' : 'ativo',
          is_blocked: u.isBlocked,
          transfer_locked: u.transferLocked,
        })
        .select('id')
        .single();
      if (accErr) {
        console.warn('  Aviso account:', accErr.message);
      } else {
        accountId = newAcc.id;
      }
    }

    // 6. Ensure initial credit transaction in audit log
    if (accountId && u.balance > 0) {
      const { count } = await supabaseAdmin
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (!count || count === 0) {
        await supabaseAdmin.from('transactions').insert({
          user_id: userId,
          account_id: accountId,
          type: 'entrada',
          amount: u.balance,
          description: 'Initial Simulation Deposit (B BANK UK Staging)',
        });
        console.log(`  -> Transação de crédito inicial registrada.`);
      }
    }

    console.log(`  -> Concluído com sucesso!`);
  }

  console.log('\n======================================================');
  console.log('TODOS OS USUÁRIOS DE TESTE FORAM PROVISIONADOS COM SUCESSO!');
  console.log('Credenciais para login na interface:');
  console.log('------------------------------------------------------');
  console.log('1. ADMINISTRADOR:');
  console.log('   Email:    admin.sim@bbank.com');
  console.log('   Senha:    Password123!');
  console.log('   Role:     admin (Master)');
  console.log('   Referral: BBANK2026');
  console.log('------------------------------------------------------');
  console.log('2. CLIENTE ATIVO (SALDO £ 1,500.00 GBP):');
  console.log('   Email:    john.sim@bbank.com');
  console.log('   Senha:    Password123!');
  console.log('   Conta:    GBP Ativa');
  console.log('   Referral: JOHNSIM2026');
  console.log('------------------------------------------------------');
  console.log('3. CLIENTE BLOQUEADO (COMPLIANCE):');
  console.log('   Email:    blocked.sim@bbank.com');
  console.log('   Senha:    Password123!');
  console.log('   Conta:    Bloqueada');
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('Falha na execução:', err);
  process.exit(1);
});
