import { createClient } from "file:///C:/Users/Admin/Downloads/digital-bank-project/node_modules/@supabase/supabase-js/dist/index.mjs";

const rawUrl = process.env.TEST_SUPABASE_URL || process.env.SUPABASE_URL;
// Normalização defensiva: remove /rest/v1 e barras finais se fornecidos
const url = rawUrl ? rawUrl.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "") : "";
const anonKey = process.env.TEST_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const PRINCIPAL_PROJECT_REF = "sfyzdvyqnomjjypprzgm";

console.log("=== VERIFICAÇÃO DE ISOLAMENTO E CONECTIVIDADE DO STAGING ===");

if (!url || url.trim() === "") {
  console.log("STATUS: PENDENTE_CONFIGURACAO");
  console.log("MOTIVO: TEST_SUPABASE_URL está vazia no arquivo .env.test.");
  process.exit(0);
}

// Extrair o project ref da URL
const match = url.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i);
const stagingRef = match ? match[1] : null;

if (!stagingRef) {
  console.error("ERRO: Formato da URL inválido. Esperado https://<project-ref>.supabase.co");
  process.exit(1);
}

console.log("Project Ref detectado no Staging:", stagingRef);

// Verificação de isolamento crítico
if (stagingRef === PRINCIPAL_PROJECT_REF) {
  console.error("FATAL: O Project Ref configurado é IDÊNTICO ao banco principal de produção (" + PRINCIPAL_PROJECT_REF + ")!");
  console.error("Operação abortada imediatamente para proteger a integridade do banco de produção.");
  process.exit(1);
}

console.log("CONFIRMAÇÃO DE ISOLAMENTO: O Project Ref (" + stagingRef + ") difere do principal (" + PRINCIPAL_PROJECT_REF + ").");

if (!anonKey || anonKey.trim() === "") {
  console.log("STATUS: Chave pública não preenchida em .env.test.");
  process.exit(0);
}

async function testConnection() {
  try {
    const sb = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const start = Date.now();
    const { data, error } = await sb.from("profiles").select("id").limit(1);
    const latency = Date.now() - start;

    console.log("Conectividade HTTP / PostgREST: OK (latência: " + latency + "ms)");

    if (error) {
      if (error.code === "PGRST205" || error.code === "42P01" || error.message?.includes("does not exist") || error.message?.includes("schema cache")) {
        console.log("Status das Tabelas: BANCO NOVO / VAZIO (tabela 'profiles' ainda não existe no schema public).");
      } else {
        console.log("Resposta PostgREST:", error.code, error.message);
      }
    } else {
      console.log("Tabela profiles consultada com sucesso (linhas:", data?.length, ").");
    }

    // Inspeção OpenAPI (Read-Only) para listar tabelas e RPCs existentes
    try {
      const authHeaderKey = serviceKey || anonKey;
      const resp = await fetch(url + "/rest/v1/", {
        headers: {
          apikey: authHeaderKey,
          Authorization: "Bearer " + authHeaderKey
        }
      });
      if (resp.ok) {
        const spec = await resp.json();
        const tables = Object.keys(spec.definitions || {});
        const rpcs = Object.keys(spec.paths || {}).filter(p => p.startsWith("/rpc/"));
        console.log("Tabelas públicas encontradas no Staging:", tables.length === 0 ? "NENHUMA (0 tabelas)" : tables.join(", "));
        console.log("Funções RPC encontradas no Staging:", rpcs.length === 0 ? "NENHUMA" : rpcs.join(", "));
      }
    } catch (e) {
      console.log("Inspeção OpenAPI:", e.message);
    }

    if (serviceKey && serviceKey.trim().length > 10) {
      console.log("Service Role Key: CONFIGURADA (comprimento:", serviceKey.length, "caracteres).");
    } else {
      console.log("Service Role Key: PENDENTE ou não preenchida.");
    }
  } catch (err) {
    console.error("Erro ao testar conectividade:", err.message);
  }
}

testConnection();
