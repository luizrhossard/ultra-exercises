# Auditoria de Segurança — UE-17

## Data e ambiente

- **Data**: 21/08/2026
- **Ambiente de execução**: Windows 11 local · OpenJDK Temurin 25.0.3 (target Java 21) · Maven 3.9.16 · Node.js/npm (Vite 6) · PostgreSQL 16 via docker-compose (`db` :5433, `db-test` :5434)
- **Branch auditada**: `docs/UE-17-security-audit-report` (acumulando UE-25 → UE-26 → UE-24)

## Escopo analisado

| Camada | Componentes |
|---|---|
| Backend | Spring Boot 3.3.5 — segurança (JWT/BCrypt), filtros (traceId, request log, payload, rate limit), controllers de auth e 2FA, migrações Flyway V1–V3 |
| Frontend | React 18 + Vite — camada de API (`api.ts`), store de sessão, telas Auth/Perfil, ErrorBoundary |
| Infra/config | `application.yml`, `application-test.yml`, `.env.example`, `.gitignore`, docker-compose |

## Ferramentas executadas

| Ferramenta | Resultado |
|---|---|
| `mvn test` (unitários + integração contra Postgres real) | **78 testes, 0 falhas** ✅ |
| `npm test` (Vitest + Testing Library) | **49 testes, 0 falhas** ✅ |
| `npm run lint` / `npm run typecheck` / `npm run build` | sem erros ✅ |
| `npm audit` | **0 vulnerabilidades** ✅ |
| Varredura manual de segredos versionados (`git grep`) | nenhum segredo real encontrado ✅ |

> Auditoria de CVEs do lado Maven: plugin OWASP dependency-check **não configurado** no projeto
> (execução exigiria download da base NVD). Registrado como pendência de pipeline abaixo.
> Dependências Maven são gerenciadas pelo parent Spring Boot 3.3.5 (linha 3.3.x atual em 08/2026).

## Vulnerabilidades encontradas

| Severidade | Área | Descrição | Status | Mitigação |
|---|---|---|---|---|
| Média | Configuração | `backend/target/` versionado no git (117 artefatos de build, incl. relatórios de teste) | **Corrigida** [UE-17] | Removidos do índice; `.gitignore` com `backend/target/`, arquivos Eclipse e `.env` |
| Média | CORS | `allowedHeaders("*")` permitia qualquer header em preflights | **Corrigida** [UE-26] | Lista explícita: `Authorization`, `Content-Type` |
| Baixa | Observabilidade | traceId presente apenas em erros 500; impossível correlacionar 4xx | **Corrigida** [UE-25] | `TraceIdFilter` propaga para toda resposta/log; header `X-Trace-Id` ecoado |
| Baixa | Frontend | Texto bruto de respostas não-JSON (gateways) era exibido ao usuário | **Corrigida** [UE-25] | Mensagens genéricas por status; corpo bruto nunca renderizado |
| Informativa | API | `POST /auth/register` duplicado retorna 409 com corpo vazio (fora do contrato) | Aceita | Frontend trata; padronização planejada em PR futura |
| Informativa | Rate limit | Limiter em memória: múltiplas instâncias multiplicariam limites efetivos | Aceita | Instância única hoje; interface pronta para backend Redis (`docs/security/rate-limiting.md`) |
| Informativa | Headers | CSP ativa apenas em modo Report-Only | Aceita | Plano de validação→ativação documentado (`docs/security/http-security-headers.md`) |
| Informativa | Rede | `X-Forwarded-For` confiável para chavear rate limit | Aceita | Válido somente atrás de proxy reverso confiável; documentado como requisito de deploy |
| Informativa | Sessões | Sem revogação imediata de JWTs ativos em logout/desativação de 2FA | Aceita | Tokens stateless expiram em 12 h; denylist recomendada como evolução |

## Controles validados

- **2FA (TOTP)** — RFC 6238 com vetores oficiais; challenge token tipado que não autentica endpoints normais; recovery codes hasheados (BCrypt) e de uso único transacional; setup pendente expira em 10 min; rate limit dedicado 5/IP/10 min. *(TotpServiceTest, TwoFactorFlowIntegrationTest)*
- **Rate limiting** — janela deslizante por classe de endpoint (login 5/IP/15min, registro 5/IP/h, público 30/IP/min, autenticada 100/user/min); 429 padronizado + `Retry-After`; cap de payload 413. *(RateLimitFilterTest, SecurityHeadersAndRateLimitIntegrationTest)*
- **Headers HTTP** — nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS condicional a HTTPS. *(idem, integração)*
- **CORS** — origens por env, headers/métodos explícitos, sem credenciais; origem desconhecida não recebe ACAO. *(integração)*
- **Tratamento global de erros** — contrato único `{timestamp,status,error,message,fields?,traceId}`; nunca stack/SQL/internals; mensagens neutras em auth (anti-enumeração). *(ErrorContractIntegrationTest)*
- **Logging estruturado** — JSON no perfil prod (Jackson), níveis por evento, privacidade: sem senhas/tokens/códigos 2FA/payloads; eventos `security_event` para 2FA e `rate_limited`. *(JsonLogLayoutTest)*
- **Autorização** — rotas privadas exigem JWT; ownership verificado no serviço (usuário só vê próprios recursos — coberto por IDOR tests pré-existentes em `AuthAndSecurityIntegrationTest`).
- **Validação de entrada** — Bean Validation nos DTOs; limite de payload no filtro.

## Evidências de testes

```bash
# Backend (com db-test saudável)
mvn clean test   → Tests run: 78, Failures: 0, Errors: 0  BUILD SUCCESS

# Frontend
npm run lint     → 0 erros
npm run typecheck→ 0 erros
npm test         → Test Files 7 passed · Tests 49 passed
npm run build    → built in ~1.7s
npm audit        → found 0 vulnerabilities
```

## Pendências aceitas

1. Padronizar corpo 409 do registro (baixo impacto, tratado no cliente).
2. Backend compartilhado de rate limiting (Redis) quando houver multi-instância.
3. CSP efetiva após período de observação Report-Only.
4. OWASP dependency-check (ou equivalente) integrado ao pipeline CI para o Maven.
5. Denylist/revogação de JWT para logout e desativação de 2FA (hoje: expiração natural ≤12 h).

## Plano de acompanhamento

- Revisar limites de rate limit com dados reais após 30 dias em produção (eventos `rate_limited` nos logs JSON).
- Monitorar violações CSP Report-Only e ativar política efetiva.
- Atualizar dependências menores mensalmente; rodar `npm audit` e dependency-check a cada PR de dependência.
- Revisitar este checklist na próxima auditoria semestral ou após mudanças de auth.
