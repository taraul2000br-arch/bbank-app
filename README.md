# BBank - Fullstack Application

Aplicação bancária e financeira desenvolvida com **TanStack Start**, **React**, **TypeScript**, **Nitro** e **Supabase**.

## 🚀 Como Executar Localmente

### Pré-requisitos
- Node.js 20+
- npm ou pnpm

### Instalação
```bash
npm install
```

### Configurar Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env` e preencha com as credenciais do seu projeto Supabase:
```bash
cp .env.example .env
```

### Desenvolvimento
```bash
npm run dev
```

### Build e Inicialização em Produção
```bash
npm run build
npm start
```
O servidor Node iniciará ouvindo na porta definida pela variável `PORT` (padrão: 3000).

---

## 🌐 Deploy no Render

Esta aplicação está configurada para deploy como **Web Service** no [Render](https://render.com).

### Configurações do Serviço:
- **Environment:** Node
- **Build Command:** `npm install && npm run build`
- **Start Command:** `node .output/server/index.mjs`
- **Node Version:** 20+

### Variáveis de Ambiente Necessárias no Render:
- `NODE_VERSION` = `20`
- `AUTH_SECRET` = Segredo aleatório (32+ caracteres)
- `VITE_SUPABASE_URL` = URL do projeto Supabase
- `SUPABASE_URL` = URL do projeto Supabase
- `VITE_SUPABASE_PUBLISHABLE_KEY` = Chave pública/anon do Supabase
- `SUPABASE_PUBLISHABLE_KEY` = Chave pública/anon do Supabase
- `SUPABASE_SERVICE_ROLE_KEY` = Chave de serviço secreta do Supabase (armazenada de forma segura nas variáveis de ambiente do servidor)
