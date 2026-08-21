# Headers de Segurança HTTP — API FORJA

> Ticket: UE-26 · Configurados em `SecurityConfig` (Spring Security `headers()`).

## Headers ativos

| Header | Valor | Justificativa |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Impede MIME-sniffing de respostas. |
| `X-Frame-Options` | `DENY` | Bloqueia framing (clickjacking); reforçado por CSP `frame-ancestors 'none'`. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Vazamento mínimo de URL em navegação cruzada. |
| `Permissions-Policy` | `geolocation=(), camera=(), microphone=(), payment=(), usb=()` | API não usa nenhuma destas features; desliga explicitamente. |
| `Content-Security-Policy-Report-Only` | ver política abaixo | Validação sem quebrar swagger-ui (ver plano). |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | **Somente** com `forja.security.hsts-enabled=true` (produção atrás de HTTPS). Desativado em dev/http para evitar travamento de localhost. |

## CSP

Política inicial (modo **Report-Only**):

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data:; font-src 'self'; frame-ancestors 'none';
base-uri 'self'; form-action 'self'
```

Exceções documentadas:

- `'unsafe-inline'` em `style-src`: exigência do **swagger-ui** (injeta estilos
  inline). Única exceção; sem justificativa para `script-src`.
- Domínios externos: nenhum permitido hoje (API não consome CDN/analytics).

### Plano de ativação efetiva

1. Observar violações em staging/prod com a política Report-Only;
2. Ajustar diretivas conforme achados;
3. Trocar `reportOnly()` por modo efetivo (`Content-Security-Policy`);
4. Revalidar swagger-ui e o frontend servido pela API.

## Ocultação de tecnologia

- Spring Boot por padrão não emite `Server`, `X-Powered-By` ou
  `X-Application-Context`; nada adicionado nesta história expõe stack.
- Erros 500 nunca retornam classes, SQL ou caminhos (ver
  [contrato de erro](../api/error-response-contract.md)).

## Verificação

Coberto por `SecurityHeadersAndRateLimitIntegrationTest`:

- headers presentes em qualquer resposta (`/api/sports`);
- HSTS ausente quando desabilitado (http);
- CORS: origem configurada ecoada; origem desconhecida sem
  `Access-Control-Allow-Origin`;
- rate limit do login end-to-end (2×401 → 429 + `Retry-After`, IP isolado).
