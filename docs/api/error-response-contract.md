# Contrato de Resposta de Erro — API FORJA

> Ticket: UE-25 · Implementado em `GlobalExceptionHandler`, `ErrorResponse` e `SecurityConfig`.

Toda resposta de erro da API segue um único contrato JSON. O cliente nunca recebe
stack traces, SQL, caminhos internos, tokens ou variáveis de ambiente.

## Estrutura

```json
{
  "timestamp": "2026-08-21T00:00:00Z",
  "status": 400,
  "error": "VALIDATION_ERROR",
  "message": "Dados inválidos.",
  "fields": [
    { "field": "email", "message": "Informe um e-mail válido." }
  ],
  "traceId": "9f1c2a34-5b6d-4e7f-8a90-b1c2d3e4f5a6"
}
```

| Campo      | Tipo                  | Presença | Descrição |
|------------|-----------------------|----------|-----------|
| `timestamp`| string ISO-8601       | sempre   | Momento da geração do erro no servidor. |
| `status`   | int                   | sempre   | Código HTTP. |
| `error`    | string                | sempre   | Código estável e legível por máquina (ver tabela abaixo). |
| `message`  | string                | sempre   | Mensagem amigável em pt-BR, pronta para exibição. |
| `fields`   | lista de `{field, message}` | só em validação | Erros por campo de entrada. |
| `traceId`  | string                | sempre   | Identificador da requisição (ver [Rastreabilidade](#rastreadade-traceid)). |

## Códigos de erro

| Código             | HTTP | Quando ocorre |
|--------------------|------|---------------|
| `VALIDATION_ERROR` | 400  | Bean Validation rejeitou o payload (`fields` preenchido). |
| `BAD_REQUEST`      | 400  | Corpo ilegível, parâmetro ausente ou argumento inválido. |
| `UNAUTHORIZED`     | 401  | Ausência ou invalidade do JWT. |
| `FORBIDDEN`        | 403  | Autenticado, mas sem permissão para o recurso. |
| `NOT_FOUND`        | 404  | Recurso inexistente. |
| `INTERNAL_ERROR`   | 500  | Falha inesperada; detalhes ficam apenas no log do servidor, correlacionados pelo `traceId`. |
| `RATE_LIMITED`     | 429  | *Planejado (UE-26)* — limite de requisições excedido, com `Retry-After`. |

## Rastreabilidade (traceId)

- Cada requisição recebe um `traceId` (UUID) gerado pelo `TraceIdFilter`
  (`backend/src/main/java/com/forja/config/TraceIdFilter.java`).
- O cliente pode propagar seu próprio identificador enviando o header
  **`X-Trace-Id`** (aceito o formato `[A-Za-z0-9-]{8,64}`); identificadores
  inválidos são substituídos silenciosamente.
- Todo erro ecoa o header **`X-Trace-Id`** na resposta, com o mesmo valor do corpo.
- No frontend, `ApiError.traceId` é exibido como referência de suporte
  ("Ref: …") na tela de login, permitindo buscar o evento exato nos logs.

## Regras de não exposição

- Nunca retornar stack trace, SQL, nome de tabelas, caminhos de arquivo,
  classes internas, tokens ou segredos.
- Falhas inesperadas respondem sempre `"Erro interno inesperado."` com
  `INTERNAL_ERROR`; o diagnóstico fica no log do servidor via `traceId`.
- Corpos não-JSON (ex.: página de gateway/proxy) nunca são repassados ao usuário.

## Comportamentos conhecidos / planejados

- `POST /api/auth/register` com e-mail duplicado retorna hoje **HTTP 409 com
  corpo vazio** (padronização do corpo prevista em PR futura).
- `RATE_LIMITED` (429) será introduzido pela história UE-26.
