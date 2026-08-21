# Autenticação de Dois Fatores (TOTP) — FORJA

> Ticket: UE-24 · Backend: `TotpService`, `TwoFactorController`, `AuthController`, `JwtService` · Frontend: `TwoFactorSettings.tsx`, `Auth.tsx`.

## Decisão técnica

- **TOTP RFC 6238** implementado em Java puro (HMAC-SHA1, 6 dígitos, passo 30 s,
  tolerância ±1 passo) — mesma filosofia sem dependências do `JwtService`.
  Compatível com Google/Microsoft Authenticator, Authy e 1Password.
- **Sem SMS**: riscos de interceptação/SIM swap e custo operacional.
- Validação sempre com o horário do **servidor**; o horário do cliente nunca é confiável.
- QR Code renderizado no frontend via pacote `qrcode` (única dependência nova).

## Fluxo de ativação

```
POST /api/me/2fa/setup      → { secret, otpauthUri }        (segredo pendente expira em 10 min)
POST /api/me/2fa/activate   → { code } → { recoveryCodes[8] }
GET  /api/me/2fa/status     → { enabled }
```

1. Usuário autenticado solicita setup → segredo pendente (10 min de validade);
2. Frontend exibe QR Code + chave manual (cópia apenas por clique explícito);
3. Ativação exige um código válido do app antes de habilitar;
4. Códigos de recuperação (8) são gerados e retornados **uma única vez**,
   persistidos apenas como hash BCrypt;
5. Evento de auditoria `security_event event=2fa_activated userId=…` nos logs.

## Fluxo de login

```
POST /api/auth/login        → credenciais ok + 2FA ativo?
                              ├─ não → { mfaRequired:false, token, … }
                              └─ sim → { mfaRequired:true, challengeToken }   (JWT typ="2fa", 5 min)
POST /api/auth/2fa/verify   → { challengeToken, code } → { mfaRequired:false, token, … }
```

- `challengeToken` é um JWT de tipo próprio (`typ:"2fa"`): **não autentica**
  endpoints normais (`JwtService.validate` rejeita tokens tipados);
- Aceita código TOTP (6 dígitos) ou um código de recuperação (`XXXX-XXXX`);
- Falhas respondem mensagem neutra "Código inválido." (sem detalhes internos)
  e registram `event=2fa_challenge_failed`;
- Código de recuperação usado é invalidado imediatamente
  (`event=recovery_code_used`).

## Desativação e regeneração (reautenticação forte)

```
POST /api/me/2fa/disable         { password, code }   → limpa segredo + códigos
POST /api/me/2fa/recovery-codes  { password, code }   → novo lote (invalida o anterior)
```

Ambas exigem **senha atual + código TOTP válido** e geram eventos de auditoria
(`2fa_disabled`, `2fa_recovery_codes_regenerated`).

## Proteções aplicadas

| Proteção | Implementação |
|---|---|
| Rate limiting no desafio | Regra `two-factor`: 5/IP a cada 10 min em `/api/auth/2fa/verify` |
| Segredo nunca reexposto | `setup` só para contas sem 2FA; após ativação o segredo não retorna |
| Setup pendente expira | 10 minutos (`totp_pending_expires_at`) |
| Recovery codes hasheados | BCrypt por código; texto claro existe só na resposta da geração |
| Uso único garantido | `used_at` marcado na transação do verify |
| Logs sanitizados | Nunca registrar segredo, QR, códigos TOTP ou recovery codes |
| HTTPS obrigatório em prod | Requisito de deploy (ver auditoria UE-17) |

## Testes

- `TotpServiceTest`: vetores oficiais RFC 6238 (SHA1), tolerância de janela,
  rejeição de formatos inválidos;
- `TwoFactorFlowIntegrationTest`: ativação completa, desafio no login,
  challengeToken rejeitado como acesso pleno, recovery code de uso único,
  regeneração com reautenticação forte, desativação e retorno ao login direto.
