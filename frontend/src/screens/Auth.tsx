import { useState } from "react";
import { motion } from "framer-motion";
import { Logo } from "../components/Logo";
import { ApiError } from "../api";
import { useApp } from "../store";

export default function Auth() {
  const { authenticate, verifyChallenge, cancelChallenge, pendingChallenge } = useApp();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [errorRef, setErrorRef] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ---- Desafio 2FA [UE-24] ----
  const [code, setCode] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);

  if (pendingChallenge) {
    return <TwoFactorChallenge
      code={code} setCode={setCode}
      recoveryMode={recoveryMode} setRecoveryMode={setRecoveryMode}
      error={error} setError={setError}
      busy={busy}
      onSubmit={async () => {
        setBusy(true); setError(""); setErrorRef(null);
        try { await verifyChallenge(code.trim()); }
        catch (err) {
          if (err instanceof ApiError) { setError(err.message); setErrorRef(err.traceId ?? null); }
          else { setError("Não foi possível concluir a entrada."); setErrorRef(null); }
        }
        finally { setBusy(false); }
      }}
      onCancel={() => { cancelChallenge(); setError(""); setErrorRef(null); setCode(""); setRecoveryMode(false); }}
    />;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(""); setErrorRef(null);
    try { await authenticate(mode, email.trim(), password, name.trim()); }
    catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setErrorRef(err.traceId ?? null);
      } else {
        setError("Não foi possível entrar.");
        setErrorRef(null);
      }
    }
    finally { setBusy(false); }
  };

  return <div className="mx-auto flex min-h-dvh w-full max-w-[430px] items-center px-5">
    <motion.form initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit} className="w-full rounded-2xl border border-ink-700 bg-ink-850 p-6">
      <div className="flex items-center gap-3"><Logo size={52} /></div>
      <h1 className="mt-8 font-display text-2xl uppercase text-fog">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
      <p className="mt-1 text-[12px] text-fog-dim">Seu histórico e acompanhamento ficam associados à sua conta.</p>
      <div className="mt-5 space-y-3">
        {mode === "register" && <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Nome" className="w-full rounded-xl border border-ink-700 bg-ink-800 px-3.5 py-3 text-fog outline-none focus:border-volt-400" />}
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="E-mail" className="w-full rounded-xl border border-ink-700 bg-ink-800 px-3.5 py-3 text-fog outline-none focus:border-volt-400" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={8} placeholder="Senha (mín. 8 caracteres)" className="w-full rounded-xl border border-ink-700 bg-ink-800 px-3.5 py-3 text-fog outline-none focus:border-volt-400" />
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-[#ff5148]/15 p-2.5 text-[12px] text-[#ff817b]">{error}</p>}
      {error && errorRef && <p className="mt-1 text-[11px] text-fog-mute">Ref: {errorRef}</p>}
      <button disabled={busy} className="mt-5 w-full rounded-xl bg-volt-400 py-3 font-display uppercase text-ink-950 disabled:opacity-60">{busy ? "Conectando…" : mode === "login" ? "Entrar" : "Criar conta"}</button>
      <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setErrorRef(null); }} className="mt-4 w-full text-[12px] font-bold text-volt-300">{mode === "login" ? "Ainda não tenho conta" : "Já tenho uma conta"}</button>
    </motion.form>
  </div>;
}

interface ChallengeProps {
  code: string;
  setCode: (v: string) => void;
  recoveryMode: boolean;
  setRecoveryMode: (v: boolean) => void;
  error: string;
  setError: (v: string) => void;
  busy: boolean;
  onSubmit: () => Promise<void>;
  onCancel: () => void;
}

function TwoFactorChallenge({ code, setCode, recoveryMode, setRecoveryMode, error, setError, busy, onSubmit, onCancel }: ChallengeProps) {
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit();
  };

  return <div className="mx-auto flex min-h-dvh w-full max-w-[430px] items-center px-5">
    <motion.form initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit} className="w-full rounded-2xl border border-ink-700 bg-ink-850 p-6">
      <div className="flex items-center gap-3">
        <Logo size={40} />
        <div><p className="font-display text-2xl uppercase text-fog">Verificação em dois fatores</p></div>
      </div>
      <h1 className="mt-8 font-display text-2xl uppercase text-fog">{recoveryMode ? "Código de recuperação" : "Confirme o código"}</h1>
      <p className="mt-1 text-[12px] text-fog-dim">
        {recoveryMode
          ? "Informe um dos seus códigos de recuperação de uso único."
          : "Abra seu aplicativo autenticador e informe o código de 6 dígitos da conta Forja."}
      </p>
      <div className="mt-5">
        <label htmlFor="twofa-code" className="sr-only">{recoveryMode ? "Código de recuperação" : "Código de verificação"}</label>
        <input
          id="twofa-code"
          value={code}
          onChange={(e) => setCode(recoveryMode ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ""))}
          inputMode={recoveryMode ? "text" : "numeric"}
          autoComplete="one-time-code"
          autoFocus
          required
          maxLength={recoveryMode ? 9 : 6}
          placeholder={recoveryMode ? "XXXX-XXXX" : "000000"}
          aria-describedby={error ? "twofa-error" : undefined}
          className="w-full rounded-xl border border-ink-700 bg-ink-800 px-3.5 py-3 text-center font-display text-xl tracking-[.35em] text-fog outline-none focus:border-volt-400"
        />
      </div>
      {error && (
        <>
          <p id="twofa-error" role="alert" className="mt-3 rounded-lg bg-[#ff5148]/15 p-2.5 text-[12px] text-[#ff817b]">{error}</p>
          {recoveryMode ? null : <p className="mt-1 text-[11px] text-fog-dim">Sem acesso ao app? <button type="button" onClick={() => { setRecoveryMode(true); setError(""); }} className="font-bold text-volt-300 underline underline-offset-2">Usar código de recuperação</button></p>}
        </>
      )}
      {!error && !recoveryMode && <p className="mt-3 text-[11px] text-fog-dim">Sem acesso ao app? <button type="button" onClick={() => { setRecoveryMode(true); setError(""); }} className="font-bold text-volt-300 underline underline-offset-2">Usar código de recuperação</button></p>}
      <button disabled={busy || code.length < 6} className="mt-5 w-full rounded-xl bg-volt-400 py-3 font-display uppercase text-ink-950 disabled:opacity-60">{busy ? "Verificando…" : "Confirmar"}</button>
      <button type="button" onClick={onCancel} className="mt-4 w-full text-[12px] font-bold text-fog-dim">Voltar para o login</button>
    </motion.form>
  </div>;
}
