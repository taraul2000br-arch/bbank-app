export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="pt">
  <head>
    <meta charset="utf-8" />
    <title>Não foi possível carregar esta página — B Bank</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        background: #f8fafc;
        color: #0f172a;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        margin: 0;
        padding: 1.5rem;
      }
      .card {
        max-width: 28rem;
        width: 100%;
        text-align: center;
        padding: 2.5rem 2rem;
        background: #ffffff;
        border-radius: 1.25rem;
        border: 1px solid #e2e8f0;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
      }
      .icon-circle {
        width: 3.5rem;
        height: 3.5rem;
        background: #fef3c7;
        color: #d97706;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 1.25rem;
      }
      h1 {
        font-size: 1.25rem;
        font-weight: 700;
        margin: 0 0 0.5rem;
        color: #0f172a;
      }
      p {
        color: #64748b;
        font-size: 0.875rem;
        line-height: 1.5;
        margin: 0 0 1.75rem;
      }
      .actions {
        display: flex;
        gap: 0.75rem;
        justify-content: center;
        flex-wrap: wrap;
      }
      button, a {
        padding: 0.625rem 1.25rem;
        border-radius: 9999px;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        text-decoration: none;
        transition: all 0.15s ease;
      }
      .primary {
        background: #0076b6;
        color: #ffffff;
        border: 1px solid #0076b6;
      }
      .primary:hover {
        background: #006096;
      }
      .secondary {
        background: #f1f5f9;
        color: #0f172a;
        border: 1px solid #cbd5e1;
      }
      .secondary:hover {
        background: #e2e8f0;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon-circle">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <h1>Não foi possível carregar esta página.</h1>
      <p>Encontramos um problema temporário. Tente novamente ou volte para sua conta.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Tentar novamente</button>
        <a class="secondary" href="/conta">Voltar para minha conta</a>
      </div>
    </div>
  </body>
</html>`;
}
