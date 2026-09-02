import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api, ApiError } from "../api";
import { useApp } from "../store";
import { SectionLabel } from "./ui";

/**
 * Configuração de 2FA (TOTP) [UE-24]: ativação com QR Code + chave manual,
 * códigos de recuperação exibidos uma única vez e desativação com
 * reautenticação forte.
 */
export default function TwoFactorSettings() {
  const { token, toast } = useApp();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [stage, setStage] = useState<"idle" | "qr" | "codes">("idle");
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmSaved, setConfirmSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [showRegen, setShowRegen] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.twoFactorStatus(token)
      .then((s) => setEnabled(s.enabled))
      .catch(() => setEnabled(false));
  }, [token]);

  if (enabled === null || !token) return null;

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await action(); }
    catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível concluir a operação.");
    }
    finally { setBusy(false); }
  };

  const startSetup = () => runAction(async () => {
    setSetup(await api.setupTwoFactor(token));
    setStage("qr");
  });

  const activate = () => runAction(async () => {
    const result = await api.activateTwoFactor(token, code.trim());
    setRecoveryCodes(result.recoveryCodes);
    setEnabled(true);
    setStage("codes");
    toast("2FA ativado", "#34d97b");
  });

  const confirmCodesSaved = () => {
    if (!confirmSaved) return;
    setStage("idle"); setSetup(null); setRecoveryCodes([]);
    setCode(""); setConfirmSaved(false);
  };

  const regenerate = () => runAction(async () => {
    const result = await api.regenerateRecoveryCodes(token, password, code.trim());
    setRecoveryCodes(result.recoveryCodes);
    setPassword(""); setCode(""); setShowRegen(false);
    setStage("codes"); setConfirmSaved(false);
  });

  const disable = () => runAction(async () => {
    await api.disableTwoFactor(token, password, code.trim());
    setEnabled(false); setPassword(""); setCode(""); setShowDisable(false);
    toast("2FA desativado");
  });

  const copySecret = async () => {
    if (!setup) return;
    try { await navigator.clipboard.writeText(setup.secret); toast("Chave copiada"); }
    catch { toast("Não foi possível copiar"); }
  };

  return (
    <section className="mt-7 rounded-2xl border border-ink-700 bg-ink-850 p-4" aria-label="Segurança da conta">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>Segurança · dois fatores</SectionLabel>
        {enabled !== null && (
          <span
            role="status"
            className="rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ background: enabled ? "rgba(52,217,123,.14)" : "#1f2a32", color: enabled ? "#34d97b" : "#61716a" }}
          >
            {enabled ? "Ativo" : "Inativo"}
          </span>
        )}
      </div>

      {/* ---- fluxo de ativação ---- */}
      {!enabled && stage === "idle" && (
        <>
          <p className="mt-2.5 text-[12px] leading-relaxed text-fog-dim">
            Adicione uma segunda camada de proteção: um código do seu aplicativo autenticador
            (Google Authenticator, Authy, 1Password…) além da senha.
          </p>
          <button
            onClick={startSetup}
            disabled={busy}
            className="mt-3 w-full rounded-xl bg-volt-400 py-3 font-display uppercase text-ink-950 disabled:opacity-60"
          >
            {busy ? "Preparando…" : "Ativar 2FA"}
          </button>
        </>
      )}

      {!enabled && stage === "qr" && setup && (
        <div className="mt-3">
          <ol className="list-inside list-decimal space-y-1 text-[12px] text-fog-dim">
            <li>Escaneie o QR Code no app autenticador.</li>
            <li>Sem câmera? Use a chave manual abaixo.</li>
            <li>Confirme com o código gerado pelo app.</li>
          </ol>
          <div className="mt-3 flex items-center justify-center rounded-xl bg-volt-400 p-3">
            <QRCodeSVG
              value={setup.otpauthUri}
              size={180}
              bgColor="#d4f53c"
              fgColor="#0c1216"
              aria-label={`QR Code de configuração do 2FA para Forja. Chave manual: ${setup.secret}`}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-ink-800 px-3 py-2">
            <code className="truncate font-mono text-[12px] tracking-wider text-fog" aria-label="Chave manual">{setup.secret}</code>
            <button type="button" onClick={copySecret} className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-volt-300">
              Copiar
            </button>
          </div>
          <label htmlFor="twofa-setup-code" className="mt-3 block text-[11px] font-bold uppercase tracking-[0.12em] text-fog-mute">Código do app</label>
          <input
            id="twofa-setup-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            className="mt-1 w-full rounded-xl border border-ink-700 bg-ink-800 px-3.5 py-3 text-center font-display text-xl tracking-[.35em] text-fog outline-none focus:border-volt-400"
          />
          <button
            onClick={activate}
            disabled={busy || code.length !== 6}
            className="mt-3 w-full rounded-xl bg-volt-400 py-3 font-display uppercase text-ink-950 disabled:opacity-60"
          >
            Confirmar ativação
          </button>
        </div>
      )}

      {/* ---- códigos de recuperação (exibição única) ---- */}
      {stage === "codes" && (
        <div className="mt-3" aria-live="polite">
          <p className="rounded-lg bg-[#ff5148]/15 p-2.5 text-[11px] leading-relaxed text-[#ff817b]">
            Guarde estes códigos em local seguro. Eles aparecem <strong>somente agora</strong> —
            cada um funciona uma única vez se você perder o acesso ao app autenticador.
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-1.5">
            {recoveryCodes.map((c) => (
              <li key={c}><code className="block rounded-md bg-ink-800 px-2 py-1.5 text-center font-mono text-[13px] tracking-wider text-fog">{c}</code></li>
            ))}
          </ul>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-[12px] text-fog-dim">
            <input type="checkbox" checked={confirmSaved} onChange={(e) => setConfirmSaved(e.target.checked)} className="mt-0.5 accent-lime-300" />
            Confirmo que salvei meus códigos de recuperação.
          </label>
          <button
            onClick={confirmCodesSaved}
            disabled={!confirmSaved}
            className="mt-3 w-full rounded-xl bg-volt-400 py-3 font-display uppercase text-ink-950 disabled:opacity-60"
          >
            Concluir
          </button>
        </div>
      )}

      {/* ---- conta protegida: regenerar / desativar ---- */}
      {enabled && stage === "idle" && (
        <div className="mt-3 space-y-2">
          {!showRegen && !showDisable && (
            <>
              <button
                onClick={() => setShowRegen(true)}
                className="w-full rounded-xl border border-ink-600 py-3 text-[12px] font-bold uppercase tracking-[0.12em] text-fog-dim transition-colors hover:border-volt-400 hover:text-volt-300"
              >
                Gerar novos códigos de recuperação
              </button>
              <button
                onClick={() => setShowDisable(true)}
                className="w-full rounded-xl border border-ink-600 py-3 text-[12px] font-bold uppercase tracking-[0.12em] text-fog-mute transition-colors hover:border-[#ff5148] hover:text-[#ff5148]"
              >
                Desativar 2FA
              </button>
            </>
          )}

          {(showRegen || showDisable) && (
            <form onSubmit={(e) => { e.preventDefault(); if (showDisable) { disable(); } else { regenerate(); } }} className="space-y-2">
              <p className="text-[11px] text-fog-dim">
                Ação sensível: confirme com sua senha atual e um código do app autenticador.
              </p>
              <label htmlFor="twofa-password" className="sr-only">Senha atual</label>
              <input
                id="twofa-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="Senha atual"
                className="w-full rounded-xl border border-ink-700 bg-ink-800 px-3.5 py-3 text-fog outline-none focus:border-volt-400"
              />
              <label htmlFor="twofa-confirm-code" className="sr-only">Código do app autenticador</label>
              <input
                id="twofa-confirm-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                required
                placeholder="000000"
                className="w-full rounded-xl border border-ink-700 bg-ink-800 px-3.5 py-3 text-center font-display text-xl tracking-[.35em] text-fog outline-none focus:border-volt-400"
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={busy || !password || code.length !== 6}
                  className={"flex-1 rounded-xl py-3 text-[12px] font-bold uppercase tracking-[0.12em] disabled:opacity-60 " + (showDisable ? "bg-[#ff5148] text-ink-950" : "bg-volt-400 text-ink-950")}
                >
                  {busy ? "Processando…" : showDisable ? "Desativar 2FA" : "Gerar novos códigos"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDisable(false); setShowRegen(false); setPassword(""); setCode(""); setError(""); }}
                  className="flex-1 rounded-xl border border-ink-600 py-3 text-[12px] font-bold uppercase tracking-[0.12em] text-fog-dim"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {error && <p role="alert" className="mt-3 rounded-lg bg-[#ff5148]/15 p-2.5 text-[12px] text-[#ff817b]">{error}</p>}
    </section>
  );
}
