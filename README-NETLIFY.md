# GUIA DE IMPLANTAÇÃO NO NETLIFY — PROJETO BANCO DIGITAL / CAMILA RICCI

Este guia contém as instruções passo a passo para publicação do projeto no Netlify com suporte completo a **Server-Side Rendering (SSR)**, **Server Functions do TanStack Start**, **Autenticação Supabase**, e o **Chat Camila Ricci em tempo real**.

---

## 1. Drag & Drop (Netlify Drop) vs. Deploy por Git / CLI

### ⚠️ O ZIP pode ser enviado via Netlify Drag & Drop?
**NÃO RECOMENDADO para execução completa.**
- O **Netlify Drop** (arrastar pasta/ZIP no navegador) é um recurso projetado **exclusivamente para sites puramente estáticos** (arquivos HTML/CSS/JS simples).
- Esta aplicação foi construída com **TanStack Start**, que depende de execução de servidor (SSR) e **Server Functions** (`createServerFn`) para operações críticas (autenticação segura, envio de mensagens com Service Role, geração de URLs assinadas no Storage, validações de segurança e auditoria confidencial).
- Se enviado via Drag & Drop estático, as rotas SSR e as Server Functions (`/_server/*`) retornarão erro 404/500, impossibilitando o funcionamento do chat Camila Ricci e dos fluxos protegidos.

### ✅ Métodos Recomendados para Publicação

#### Método A: Conexão com Repositório Git (Recomendado)
1. Extraia o conteúdo deste pacote ZIP e faça push para um repositório Git (GitHub, GitLab ou Bitbucket).
2. Acesse o painel do [Netlify](https://app.netlify.com) e clique em **"Add new site" > "Import an existing project"**.
3. Selecione seu repositório Git.
4. O Netlify detectará automaticamente o arquivo `netlify.toml` já configurado na raiz do projeto.
5. Configure as Variáveis de Ambiente (veja seção 3 abaixo).
6. Clique em **"Deploy site"**. O Netlify executará a compilação no ambiente de nuvem, gerará os assets estáticos em `dist` e registrará as funções do servidor em `.netlify/functions-internal/server`.

#### Método B: Publicação via Netlify CLI (Sem vincular Git)
Se preferir publicar diretamente do terminal da sua máquina:
1. Extraia o pacote ZIP em uma pasta.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Instale o Netlify CLI globalmente (ou use npx):
   ```bash
   npm install -g netlify-cli
   ```
4. Autentique-se no Netlify:
   ```bash
   netlify login
   ```
5. Vincule o site existente ou crie um novo:
   ```bash
   netlify init
   ```
6. Realize o build e o deploy em produção:
   ```bash
   npm run build
   netlify deploy --prod
   ```

---

## 2. Configurações de Build

O arquivo `netlify.toml` incluído na raiz do projeto já contém todos os parâmetros necessários:

| Parâmetro | Valor Configurado | Descrição |
| :--- | :--- | :--- |
| **Build Command** | `npm run build` | Compila o client Vite e o servidor Nitro |
| **Publish Directory** | `dist` | Diretório de assets estáticos públicos |
| **Functions Directory** | `.netlify/functions-internal` | Funções de servidor compiladas pelo Nitro |
| **Node Version** | `20` | Versão LTS recomendada do Node.js |
| **Redirects** | `/* -> /.netlify/functions/server (200)` | Roteamento dinâmico para SSR e Server Functions |

---

## 3. Variáveis de Ambiente no Netlify

No painel do Netlify, navegue até:
**Site configuration > Environment variables > Add a variable**

Adicione as variáveis abaixo (utilize os valores do seu projeto Supabase de homologação `rbhczirsgprmynpiudmi`):

| Nome da Variável | Escopo | Descrição |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Build & Runtime | URL do projeto Supabase (`https://<project-id>.supabase.co`) |
| `SUPABASE_URL` | Build & Runtime | Cópia idêntica da URL do Supabase para o backend |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Build & Runtime | Chave pública / Anon Key (acessível pelo navegador) |
| `SUPABASE_PUBLISHABLE_KEY` | Build & Runtime | Cópia idêntica da Publishable Key para o backend |
| `SUPABASE_SERVICE_ROLE_KEY` | Runtime (Server) | **Chave confidencial Service Role** — usada exclusivamente nas Server Functions para auditoria, chat e storage |
| `NODE_VERSION` | Build | `20` |

> 🔒 **Atenção:** A chave `SUPABASE_SERVICE_ROLE_KEY` **nunca** é exposta ao navegador. Ela é consumida apenas pelo processo de servidor Nitro do Netlify.

---

## 4. Plano de Testes Pós-Deploy

Após o deploy ser concluído pelo Netlify, realize as seguintes validações:

### 4.1. Verificação Visual e Institucional
- Abra a URL fornecida pelo Netlify (`https://<seu-site>.netlify.app`).
- Verifique se os estilos Tailwind, fontes e ícones carregam com status HTTP 200.
- No rodapé da página, confirme a exibição do aviso de transparência e demonstração tecnológica, garantindo conformidade sem alegação de afiliação bancária real não autorizada.

### 4.2. Teste de Login do Cliente
- Acesse a tela de login (`/login` ou clique em Entrar na página inicial).
- Faça login com uma conta de cliente de teste.
- Verifique se a sessão é persistida e o redirecionamento para o dashboard do cliente ocorre sem erros.

### 4.3. Teste do Chat de Suporte Camila Ricci
- Estando logado como cliente, acesse `/support` (ou abra a janela flutuante de chat).
- Envie uma mensagem de teste (ex: "Olá Camila, preciso de suporte com minha conta").
- Confirme que a mensagem aparece na tela imediatamente.
- Teste o envio de um anexo (imagem PNG/JPG ou PDF até 10MB).
- Verifique no console de rede do navegador (F12 > Network) que as requisições para `/_server/` retornam **HTTP 200** (sem erro 404 nem CORS).

### 4.4. Teste de Supervisão do Administrador
- Acesse o portal administrativo (`/admin`) com a conta de ADM responsável.
- Localize a conversa aberta pelo cliente.
- Responda como ADM — a resposta deve aparecer para o cliente identificada como **Camila Ricci**.
- Caso realize teste com ADM Master, confirme que a resposta também é identificada como **Camila Ricci** e que o UUID do Master permanece protegido na auditoria confidencial.
