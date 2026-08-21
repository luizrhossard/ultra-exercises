# Política de CORS — API FORJA

> Ticket: UE-26 · Configurada em `SecurityConfig.corsSource()`, aplicada a `/api/**`.

## Regras

- **Origens**: apenas as listadas em `forja.cors.origins` (separadas por vírgula),
  configuradas por ambiente. Sem wildcard `*` — origem desconhecida não recebe
  `Access-Control-Allow-Origin`.
- **Métodos**: `GET, POST, PUT, PATCH, DELETE, OPTIONS` (todos em uso).
- **Headers de requisição**: somente `Authorization` e `Content-Type`
  (antes era `*` — endurecido nesta história).
- **Credenciais**: não habilitadas (`allowCredentials=false`). Autenticação é
  via header `Authorization: Bearer <JWT>` no frontend; cookies de sessão não
  são usados (API stateless), logo CSRF não se aplica.
- **Cache de preflight**: `Access-Control-Max-Age: 3600`.

## Configuração por ambiente

```bash
# application.yml (default dev)
forja:
  cors:
    origins: http://localhost:5173,http://localhost:3000
```

Override por ambiente:

```bash
FORJA_CORS_ORIGINS=https://app.forja.example,https://staging.forja.example
```

Requisito operacional: a origem deve incluir o scheme exatamente
(`https://…`) e sem barra final.

## Testes

Em `SecurityHeadersAndRateLimitIntegrationTest`:

- preflight de origem permitida (`http://localhost:5173`) → 200 +
  `Access-Control-Allow-Origin` ecoado;
- preflight de origem desconhecida (`https://evil.example`) → resposta **sem**
  `Access-Control-Allow-Origin` (bloqueada pelo navegador).
