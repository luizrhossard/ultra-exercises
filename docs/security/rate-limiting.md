# Rate Limiting — API FORJA

> Ticket: UE-26 · Implementado em `RateLimitFilter`, `SlidingWindowRateLimiter` e `RequestSizeLimitFilter`.

## Modelo

Janela deslizante **em memória** (`ConcurrentHashMap<chave, Deque<momentos>>`),
avaliada por requisição antes de atingir o controller. Resposta de bloqueio
padronizada:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 42
Content-Type: application/json

{ "error": "RATE_LIMITED", "message": "Muitas requisições. Aguarde 42 segundos...", "...": "..." }
```

Acionamentos são registrados como evento `rate_limited` (WARN) nos logs
estruturados, com rota e janela — **sem** armazenar o valor da chave (IP/e-mail).

## Chaves por classe de endpoint

| Classe | Chave | Limite inicial |
|---|---|---|
| `POST /api/auth/login` | `login:<ip>` | 5 por IP a cada 15 min |
| `POST /api/auth/register` | `register:<ip>` | 5 por IP por hora |
| Leitura pública (`GET /api/sports`, `/api/exercises`) | `pub:<ip>` | 30 por IP por minuto |
| API autenticada (demais rotas com JWT válido) | `user:<e-mail>` | 100 por usuário por minuto |
| Rotas protegidas sem JWT válido | `anon:<ip>` | 30 por IP por minuto |

Rationale dos limites iniciais: valores conservadores do épico, validáveis em
produção; ajuste fino via propriedades sem mudança de código.

## Configuração (`application.yml`)

```yaml
forja:
  rate-limit:
    enabled: true
    login:        { limit: 5,   window-seconds: 900 }
    register:     { limit: 5,   window-seconds: 3600 }
    public-read:  { limit: 30,  window-seconds: 60 }
    authenticated: { limit: 100, window-seconds: 60 }
    max-payload-bytes: 1048576   # 413 acima disso (RequestSizeLimitFilter)
```

Override por ambiente via binding relaxado, ex.: `FORJA_RATELIMIT_LOGIN_LIMIT=3`.

## Limitação conhecida e plano de evolução

**A instância única atual permite limite em memória.** Em múltiplas instâncias,
contadores locais não compartilham estado (limite efetivo = N × limite).
Caminho de upgrade definido:

1. Trocar `SlidingWindowRateLimiter` por implementação com armazenamento
   compartilhado (Redis ou tabela Postgres), mantendo a mesma interface
   `tryAcquire(key, limit, windowSeconds)`;
2. Nenhuma alteração esperada em `RateLimitFilter` nem no contrato 429.

Mitigações atuais contra abuso da memória do limitador: teto defensivo de
100.000 chaves com varredura de buckets ociosos (>1h).

## Proteções complementares nesta história

- **Limite de payload**: corpos > `max-payload-bytes` (1 MiB padrão) recebem
  `413 PAYLOAD_TOO_LARGE`. Corpos chunked (sem tamanho declarado) não são
  medidos por este filtro — limitação documentada.
- **Enumeração de usuários**: login responde mensagem única
  ("Credenciais inválidas.") para usuário inexistente ou senha errada.
- **Métodos HTTP**: somente os necessários são aceitos pelo CORS; rotas não
  mapeadas caem no 401/404/405 padrão do Spring.
