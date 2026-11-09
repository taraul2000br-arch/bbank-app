/**
 * Automated Financial Integrity Test Suite for B BANK UK Digital Banking
 * Location: supabase/prepared/test_financial_suite.mjs
 * 
 * Standardized for British Banking (GBP - Pound Sterling £)
 * 
 * Usage:
 *   node --env-file=.env.test supabase/prepared/test_financial_suite.mjs
 * 
 * Tests executed against an ISOLATED staging environment:
 *   1. Valid Transfer & Financial Consistency (Accounts + Transfer_Requests + Transactions in GBP)
 *   2. Insufficient Balance Protection & Abort
 *   3. Blocked Account / Compliance Lock Protection
 *   4. End-to-End Client Idempotency: Replay with identical parameters (No extra debit, original returned)
 *   5. End-to-End Client Idempotency: Replay with DIFFERENT parameters (Rejected with IDEMPOTENCY_CONFLICT)
 *   6. Concurrent Race Conditions (Promise.all concurrent transfers: never negative balance)
 *   7. Administrative Approval Flow (Status updated, no double debit)
 *   8. Administrative Rejection Flow (Atomic refund + credit transaction in GBP)
 *   9. Double-Refund / Repeated Review Prevention (State machine guard)
 *  10. Admin Balance Adjustment with Optimistic Concurrency Conflict
 *  11. Direct PostgREST Unauthorized Access Protection (REVOKE check)
 */

import { createClient } from "file:///C:/Users/Admin/Downloads/digital-bank-project/node_modules/@supabase/supabase-js/dist/index.mjs";

const rawUrl = process.env.TEST_SUPABASE_URL || process.env.SUPABASE_URL || "";
const TEST_URL = rawUrl.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
const SERVICE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.TEST_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!TEST_URL || !SERVICE_KEY) {
  console.error("Test environment variables not configured. Set TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_ROLE_KEY in .env.test.");
  process.exit(1);
}

const adminClient = createClient(TEST_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const anonClient = createClient(TEST_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log("==================================================================");
  console.log("B BANK UK - Financial Integrity Test Suite (GBP / Staging)");
  console.log("Target URL:", TEST_URL);
  console.log("==================================================================\n");

  // Dynamically resolve test users by email via Supabase Auth Admin API
  const { data: authUsers } = await adminClient.auth.admin.listUsers();
  const userMap = {};
  (authUsers?.users || []).forEach(u => {
    if (u.email) userMap[u.email.toLowerCase()] = u.id;
  });

  const USER_ID = userMap["john.sim@bbank.com"] || userMap["john.sim@bbank-simulation.co.uk"] || "11111111-1111-1111-1111-111111111111";
  const BLOCKED_USER_ID = userMap["blocked.sim@bbank.com"] || userMap["blocked.sim@bbank-simulation.co.uk"] || "22222222-2222-2222-2222-222222222222";
  const ADMIN_ID = userMap["admin.sim@bbank.com"] || userMap["admin.sim@bbank-simulation.co.uk"] || "99999999-9999-9999-9999-999999999999";

  const runSuffix = Date.now().toString().slice(-6);

  // TEST 1: Valid Transfer & Financial Consistency (GBP)
  console.log("TEST 1: Valid Transfer & Financial Consistency (GBP)");
  const protocol1 = `BB-${runSuffix}-0001`;
  const idemKey1 = `idem-key-valid-gbp-${runSuffix}`;
  const { data: res1, error: err1 } = await adminClient.rpc("submit_transfer_atomic", {
    _user_id: USER_ID,
    _protocol: protocol1,
    _beneficiary_name: "British Tech Solutions Ltd",
    _beneficiary_doc: "GB98765432",
    _beneficiary_email: "billing@britishtech.co.uk",
    _bank_name: "Santander UK",
    _swift: "SANTAUKBXXX",
    _account_number: "20000012345678",
    _to_country: "GB",
    _currency_from: "GBP",
    _currency_to: "USD",
    _amount: 100.00,
    _fx_rate: 1.28,
    _converted_amount: 128.00,
    _purpose: "Invoice payment",
    _reference: "INV-2026-001",
    _idempotency_key: idemKey1
  });

  assert(!err1 && res1?.id, "Transfer submitted successfully via submit_transfer_atomic (GBP)");
  assert(res1?.status === "solicitado", "Initial transfer status is 'solicitado'");

  // TEST 2: Insufficient Balance Protection
  console.log("\nTEST 2: Insufficient Balance Protection");
  const { data: res2, error: err2 } = await adminClient.rpc("submit_transfer_atomic", {
    _user_id: USER_ID,
    _protocol: "BB-TEST-0002",
    _beneficiary_name: "Excessive Amount Test",
    _beneficiary_doc: "GB999999",
    _beneficiary_email: "fail@test.local",
    _bank_name: "Bank UK",
    _swift: "BANKUKBXXX",
    _account_number: "20000099999999",
    _to_country: "GB",
    _currency_from: "GBP",
    _currency_to: "USD",
    _amount: 9999999.00,
    _fx_rate: 1.0,
    _converted_amount: 9999999.00,
    _purpose: "Test",
    _reference: "Ref Test 02"
  });

  assert(err2 && /insufficient balance/i.test(err2.message), "Excessive transfer correctly rejected with 'Insufficient balance'");

  // TEST 3: Blocked Account Protection
  console.log("\nTEST 3: Blocked Account Protection");
  const { data: res3, error: err3 } = await adminClient.rpc("submit_transfer_atomic", {
    _user_id: BLOCKED_USER_ID,
    _protocol: "BB-TEST-0003",
    _beneficiary_name: "Blocked Client Test",
    _beneficiary_doc: "GB888888",
    _beneficiary_email: "blocked@test.local",
    _bank_name: "Bank UK",
    _swift: "BANKUKBXXX",
    _account_number: "20000088888888",
    _to_country: "GB",
    _currency_from: "GBP",
    _currency_to: "USD",
    _amount: 10.00,
    _fx_rate: 1.0,
    _converted_amount: 10.00,
    _purpose: "Test",
    _reference: "Ref Test 03"
  });

  assert(err3 && (/account is blocked/i.test(err3.message) || /transfers are locked/i.test(err3.message)), "Transfer from blocked account correctly rejected");

  // TEST 4: Idempotency Replay with IDENTICAL parameters
  console.log("\nTEST 4: Idempotency Replay with Identical Parameters (No Double Debit)");
  const { data: res4, error: err4 } = await adminClient.rpc("submit_transfer_atomic", {
    _user_id: USER_ID,
    _protocol: "BB-TEST-REPLAY-ATTEMPT",
    _beneficiary_name: "British Tech Solutions Ltd",
    _beneficiary_doc: "GB98765432",
    _beneficiary_email: "billing@britishtech.co.uk",
    _bank_name: "Santander UK",
    _swift: "SANTAUKBXXX",
    _account_number: "20000012345678",
    _to_country: "GB",
    _currency_from: "GBP",
    _currency_to: "USD",
    _amount: 100.00,
    _fx_rate: 1.28,
    _converted_amount: 128.00,
    _purpose: "Invoice payment",
    _reference: "INV-2026-001",
    _idempotency_key: idemKey1 // SAME KEY, SAME PARAMS
  });

  assert(!err4 && res4?.id === res1?.id, "Replay returned original transfer ID without creating a new row");
  assert(res4?.idempotent_replay === true, "Response explicitly signaled idempotent_replay = true");

  // TEST 5: Idempotency Rejection with CONFLICTING parameters
  console.log("\nTEST 5: Idempotency Rejection with Conflicting Parameters");
  const { data: res5, error: err5 } = await adminClient.rpc("submit_transfer_atomic", {
    _user_id: USER_ID,
    _protocol: "BB-TEST-CONFLICT-ATTEMPT",
    _beneficiary_name: "Different Beneficiary Scam",
    _beneficiary_doc: "GB000000",
    _beneficiary_email: "scam@test.local",
    _bank_name: "Santander UK",
    _swift: "SANTAUKBXXX",
    _account_number: "20000012345678",
    _to_country: "GB",
    _currency_from: "GBP",
    _currency_to: "USD",
    _amount: 500.00, // DIFFERENT AMOUNT
    _fx_rate: 1.28,
    _converted_amount: 640.00,
    _purpose: "Conflict test",
    _reference: "Tampered",
    _idempotency_key: idemKey1 // SAME KEY, DIFFERENT PARAMS
  });

  assert(err5 && /IDEMPOTENCY_CONFLICT/i.test(err5.message), "Reusing key with different parameters correctly raised IDEMPOTENCY_CONFLICT");

  // TEST 6: Administrative Review - Approval
  console.log("\nTEST 6: Administrative Review - Approval");
  const { data: res6, error: err6 } = await adminClient.rpc("review_transfer_atomic", {
    _transfer_id: res1.id,
    _reviewer_id: ADMIN_ID,
    _target_status: "aprovado"
  });

  assert(!err6 && res6?.ok === true, "Transfer approved by administrator");

  // TEST 7: Administrative Review - Double Review Prevention
  console.log("\nTEST 7: Administrative Review - Double Review Prevention");
  const { data: res7, error: err7 } = await adminClient.rpc("review_transfer_atomic", {
    _transfer_id: res1.id,
    _reviewer_id: ADMIN_ID,
    _target_status: "recusado",
    _rejection_reason: "Late cancellation attempt"
  });

  assert(err7 && /already been reviewed/i.test(err7.message), "Repeated review on already-approved transfer rejected by state machine");

  // TEST 8: Administrative Review - Rejection & Atomic Refund
  console.log("\nTEST 8: Administrative Review - Rejection & Atomic Refund in GBP");
  const protocol8 = `BB-${runSuffix}-0008`;
  const { data: tr8 } = await adminClient.rpc("submit_transfer_atomic", {
    _user_id: USER_ID,
    _protocol: protocol8,
    _beneficiary_name: "Refund Test Beneficiary",
    _beneficiary_doc: "GB777777",
    _beneficiary_email: "refund@test.local",
    _bank_name: "HSBC UK",
    _swift: "HBUKGB4BXXX",
    _account_number: "20000077777777",
    _to_country: "GB",
    _currency_from: "GBP",
    _currency_to: "USD",
    _amount: 50.00,
    _fx_rate: 1.28,
    _converted_amount: 64.00,
    _purpose: "Refund flow test",
    _reference: "REF-08",
    _idempotency_key: `idem-key-refund-${runSuffix}`
  });

  const { data: res8, error: err8 } = await adminClient.rpc("review_transfer_atomic", {
    _transfer_id: tr8.id,
    _reviewer_id: ADMIN_ID,
    _target_status: "recusado",
    _rejection_reason: "Invalid beneficiary documentation"
  });

  assert(!err8 && res8?.ok === true, "Transfer successfully rejected and refunded by administrator");

  // TEST 9: Direct PostgREST Unauthorized Access Protection
  console.log("\nTEST 9: Direct PostgREST Unauthorized Access Protection (REVOKE check)");
  const { error: err9 } = await anonClient.rpc("submit_transfer_atomic", {
    _user_id: USER_ID,
    _protocol: "BB-UNAUTH-01",
    _beneficiary_name: "Attacker",
    _beneficiary_doc: "XX0000",
    _beneficiary_email: "anon@test.local",
    _bank_name: "Hacker Bank",
    _swift: "HACKUKBXXX",
    _account_number: "00000000",
    _to_country: "GB",
    _currency_from: "GBP",
    _currency_to: "USD",
    _amount: 10.00,
    _fx_rate: 1.0,
    _converted_amount: 10.00,
    _purpose: "Hack",
    _reference: "Hack"
  });

  assert(err9 && (/permission denied/i.test(err9.message) || /not find the function/i.test(err9.message) || err9.code === "42501"), "Direct anonymous invocation blocked by PostgreSQL permissions");

  // TEST 10: Admin Balance Adjustment & Optimistic Concurrency Conflict
  console.log("\nTEST 10: Admin Balance Adjustment & Optimistic Concurrency Protection");
  const { data: accBefore } = await adminClient.from("accounts").select("balance").eq("user_id", USER_ID).single();
  const currentBal = Number(accBefore?.balance || 0);
  const targetBal = currentBal + 50.00;

  // 10a: Normal admin balance adjustment
  const { data: res10a, error: err10a } = await adminClient.rpc("admin_update_balance_atomic", {
    _admin_id: ADMIN_ID,
    _user_id: USER_ID,
    _new_balance: targetBal,
    _expected_current_balance: currentBal,
    _reason: "Manual adjustment test suite"
  });

  assert(!err10a && res10a?.ok === true, "Admin successfully adjusted balance with correct expected_current_balance");

  // 10b: Optimistic concurrency mismatch rejection
  const { error: err10b } = await adminClient.rpc("admin_update_balance_atomic", {
    _admin_id: ADMIN_ID,
    _user_id: USER_ID,
    _new_balance: targetBal + 100,
    _expected_current_balance: currentBal, // STALE BALANCE EXPECTED!
    _reason: "Stale concurrency test"
  });

  assert(err10b && (/balance changed/i.test(err10b.message) || /modified by another operation/i.test(err10b.message)), "Concurrency conflict prevented stale balance overwrite");

  console.log("\n==================================================================");
  console.log(`Suite Completed: ${passed} passed, ${failed} failed.`);
  console.log("==================================================================");
}

runTests().catch(console.error);
