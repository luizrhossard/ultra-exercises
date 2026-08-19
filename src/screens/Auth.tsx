import { useState } from "react";
import { motion } from "framer-motion";
import { IconBolt } from "../components/Icons";
import { useApp } from "../store";

export default function Auth() {
  const { authenticate } = useApp();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    try { await authenticate(mode, email.trim(), password, name.trim()); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível entrar."); }
    finally { setBusy(false); }
  };

  return <div className="mx-auto flex min-h-dvh w-full max-w-[430px] items-center px-5">
    <motion.form initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit} className="w-full rounded-2xl border border-ink-700 bg-ink-850 p-6">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-volt-400 text-ink-950"><IconBolt size={21} /></span><div><p className="font-display text-2xl uppercase text-fog">Forja</p><p className="text-[11px] uppercase tracking-[.14em] text-fog-mute">Performance do atleta</p></div></div>
      <h1 className="mt-8 font-display text-2xl uppercase text-fog">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
      <p className="mt-1 text-[12px] text-fog-dim">Seu histórico e acompanhamento ficam associados à sua conta.</p>
      <div className="mt-5 space-y-3">
        {mode === "register" && <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Nome" className="w-full rounded-xl border border-ink-700 bg-ink-800 px-3.5 py-3 text-fog outline-none focus:border-volt-400" />}
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="E-mail" className="w-full rounded-xl border border-ink-700 bg-ink-800 px-3.5 py-3 text-fog outline-none focus:border-volt-400" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={8} placeholder="Senha (mín. 8 caracteres)" className="w-full rounded-xl border border-ink-700 bg-ink-800 px-3.5 py-3 text-fog outline-none focus:border-volt-400" />
      </div>
      {error && <p className="mt-3 rounded-lg bg-[#ff5148]/15 p-2.5 text-[12px] text-[#ff817b]">{error}</p>}
      <button disabled={busy} className="mt-5 w-full rounded-xl bg-volt-400 py-3 font-display uppercase text-ink-950 disabled:opacity-60">{busy ? "Conectando…" : mode === "login" ? "Entrar" : "Criar conta"}</button>
      <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="mt-4 w-full text-[12px] font-bold text-volt-300">{mode === "login" ? "Ainda não tenho conta" : "Já tenho uma conta"}</button>
    </motion.form>
  </div>;
}
