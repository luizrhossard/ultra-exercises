# Recuperação de Conta — FORJA

> Ticket: UE-24 · Plano operacional para usuários que perderam o segundo fator.

## Cenários cobertos pelo produto

### 1. Perdi o app autenticador, mas tenho meus códigos de recuperação

Na tela de verificação 2FA (após login/senha), use **"Usar código de
recuperação"** e informe um dos códigos no formato `XXXX-XXXX` apresentados na
ativação. Cada código funciona uma única vez.

### 2. Perdi o app E os códigos de recuperação

Não existe contorno automático — é isso que torna o 2FA eficaz. Caminho de
suporte:

1. Usuário aciona o suporte (e-mail cadastrado na conta);
2. Suporte aplica o checklist abaixo antes de qualquer ação;
3. A desativação assistida é feita por um operador com acesso administrativo ao
   banco: limpa as colunas `totp_secret`, `totp_enabled`,
   `totp_pending_secret`, `totp_pending_expires_at` do usuário em `app_user`
   e remove as linhas de `recovery_code` daquele `user_id`;
4. Evento fica registrado nos logs de acesso ao banco; recomenda-se registrar o
   atendimento em ticket com os documentos coletados;
5. Usuário entra com senha normalmente e reativa o 2FA.

### Checklist de verificação de identidade (suporte)

- [ ] Solicitação originada do e-mail cadastrado na conta;
- [ ] Confirmação de dados da conta (nome, esportes configurados no onboarding,
      data aproximada de criação/últimos treinos registrados);
- [ ] Espera mínima de 24 h entre a solicitação e a desativação assistida
      (janela para o dono legítimo cancelar);
- [ ] Registro do atendimento (ticket) com evidências.

## O que NUNCA fazer

- Desativar 2FA sem verificação de identidade documentada;
- Compartilhar ou reexibir códigos de recuperação antigos (só existem como hash);
- Informar ao solicitante se determinado e-mail possui 2FA ativo antes de
  concluir a verificação de identidade (evita enumeração).

## Perguntas frequentes

**O código TOTP não funciona ("Código inválido.")**
Verifique se o relógio do celular está correto (modo automático). O servidor
tolera ±30 s de diferença.

**Posso usar o mesmo código duas vezes?**
Códigos TOTP podem ser reutilizados dentro da janela de 30 s; códigos de
recuperação são estritamente de uso único.

**A regeneração apaga os códigos antigos?**
Sim. Gerar um novo lote invalida imediatamente todos os anteriores.
