# Logging Estruturado e Tratamento de Erros — FORJA

> Ticket: UE-25 · Observabilidade da API e do frontend.

## Visão geral

```
Requisição ──► TraceIdFilter ──► RequestLoggingFilter ──► JwtAuthFilter ──► Controller
                    │                    │
                    │ MDC: traceId       │ MDC: http_method/path/status/duration_ms
                    ▼                    ▼
              Log (JSON em prod / legível em dev) com traceId correlacionado
```

Componentes:

| Componente | Arquivo | Papel |
|---|---|---|
| `TraceIdFilter` | `backend/src/main/java/com/forja/config/TraceIdFilter.java` | Gera/propaga o `traceId` (header `X-Trace-Id`), coloca no MDC e limpa ao final. |
| `RequestLoggingFilter` | `backend/src/main/java/com/forja/config/RequestLoggingFilter.java` | Um evento por requisição: método, path, status e duração. Nunca registra headers, query strings ou payloads. |
| `JsonLogLayout` | `backend/src/main/java/com/forja/common/logging/JsonLogLayout.java` | Layout Logback que emite JSON (Jackson, sem dependências novas). |
| `logback-spring.xml` | `backend/src/main/resources/logback-spring.xml` | Perfil `!prod`: console legível. Perfil `prod`: uma linha JSON por evento. |
| `GlobalExceptionHandler` | `backend/src/main/java/com/forja/common/exception/GlobalExceptionHandler.java` | Contrato único de erro com `traceId` (ver [Contrato de erro](../api/error-response-contract.md)). |

## Formato dos logs (perfil prod)

```json
{
  "timestamp": "2026-08-21T12:00:00.123Z",
  "level": "INFO",
  "service": "forja-api",
  "environment": "prod",
  "logger": "http",
  "thread": "http-nio-8085-exec-1",
  "traceId": "9f1c2a34-5b6d-4e7f-8a90-b1c2d3e4f5a6",
  "http_method": "POST",
  "http_path": "/api/routines/generate",
  "http_status": "201",
  "duration_ms": "124",
  "message": "POST /api/routines/generate -> 201 (124 ms)"
}
```

Em erros inesperados é acrescido `"stackTrace"` — apenas no log do servidor,
nunca na resposta HTTP.

## Níveis de log

| Evento | Nível | Stack trace |
|---|---|---|
| Requisição concluída (`event=http_request`) | INFO | não |
| Validação rejeitada (400) | DEBUG | não |
| Autenticação recusada (401) / recurso ausente (404) | INFO | não |
| Erro interno (500) | ERROR | sim (somente log) |

Desenvolvimento pode ser mais detalhado via binding relaxado do Spring:

```bash
LOGGING_LEVEL_COM_FORJA=DEBUG   # equivale a logging.level.com.forja
SPRING_PROFILES_ACTIVE=dev      # console legível; use prod para JSON
```

## Privacidade de logs

Nunca registrar (regra vigente para código novo):

- Senhas, tokens de autenticação, cookies de sessão;
- Códigos 2FA ou códigos de recuperação;
- Segredos de ambiente e chaves de API;
- Payloads completos sem sanitização;
- Dados pessoais além do estritamente necessário.

Quando precisar identificar um usuário nos logs, usar o **e-mail como sujeito
do JWT apenas em eventos de segurança relevantes** ou o ID interno; os filtros
de logging registram somente metadados de rota.

## Monitoramento

**Hoje:** os eventos estruturados em stdout são a fonte de monitoramento.
Métricas deriváveis por consulta/agregação dos logs JSON:

- Quantidade de erros por rota (`http_path` + `http_status`);
- Latência por endpoint (`duration_ms`);
- Volume de 4xx/5xx;
- Tentativas excessivas de login (401 repetidos em `/api/auth/login`).

**Ponto de integração futuro:** adicionar `spring-boot-starter-actuator`
(Micrometer) consumindo os mesmos filtros para expor métricas Prometheus ou
exportar OTel — a estrutura de eventos já fornece as dimensões necessárias.
Não implementado nesta história para evitar nova superfície de endpoints sem
necessidade imediata.

## Tratamento de erros no frontend

Implementado em `src/api.ts` (classe `ApiError`) e `src/components/ErrorBoundary.tsx`:

| Estado | Detecção | Feedback ao usuário |
|---|---|---|
| Erro de rede | `fetch` rejeita (`TypeError`) | "Não foi possível conectar ao servidor…" |
| Timeout | AbortController (15 s) | "A conexão demorou demais…" |
| Sessão expirada | `ApiError.status === 401` em `/me` | Logout automático; novo login |
| Validação | `code === VALIDATION_ERROR` | Mensagem do servidor/campo |
| Erro interno | status ≥ 500 | Mensagem genérica (detalhes nunca expostos) |
| Quebra de render | ErrorBoundary global | Tela amigável com "Tentar novamente" |

Política de retry: **apenas GET idempotente**, uma tentativa extra após ~400 ms,
diante de falha de rede, timeout ou 502/503/504. Operações de escrita nunca são
repetidas automaticamente.

Correlação cliente↔servidor: `ApiError.traceId` (do corpo do erro) é exibido
como "Ref: …" na tela de login para abertura de suporte.
