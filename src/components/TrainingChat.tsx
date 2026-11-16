import { useState } from "react";
import { ApiError, request } from "../api";

type Message = { role: "user" | "assistant"; content: string };
type Reply = { message: string; proposalId: string | null; items: { exerciseId: number; name: string; sets: number; reps: string; rest: number }[] };

export function TrainingChat({ token, sportId, onSaved }: { token: string; sportId: number; onSaved: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [reply, setReply] = useState<Reply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send() {
    if (!input.trim() || busy) return;
    const next: Message[] = [...messages, { role: "user", content: input.trim() }];
    setBusy(true); setError(""); setReply(null);
    try {
      const result = await request<Reply>("/training-chat", { method: "POST", body: JSON.stringify({ sportId, messages: next }) }, token, { timeoutMs: 50000 });
      setMessages([...next, { role: "assistant", content: result.message }]); setReply(result); setInput("");
    } catch (e) { setError(e instanceof ApiError ? e.message : "Não foi possível conversar. Tente novamente."); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!reply?.proposalId || busy) return;
    setBusy(true); setError("");
    try {
      await request("/training-chat/save", { method: "POST", body: JSON.stringify({ proposalId: reply.proposalId }) }, token);
      setReply(null); onSaved();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }
  return <section className="mt-5 rounded-2xl border border-ink-600 bg-ink-850 p-5">
    <h2 className="font-display text-xl uppercase text-fog">Planejar com IA</h2>
    <p className="mt-2 text-sm text-fog-dim">Conte seu objetivo, tempo disponível, equipamentos e como está hoje. Atualize também o check-in no Perfil. A IA pode reduzir séries e retirar exercícios da seleção do sistema.</p>
    <p className="mt-2 text-xs text-fog-mute">Ao enviar, sua conversa e os exercícios selecionados serão processados pelo OpenRouter e pelo provedor do modelo. Evite informações pessoais. A conversa não é salva ao sair desta tela.</p>
    <div role="log" aria-live="polite" className="my-4 max-h-96 space-y-3 overflow-y-auto">
      {messages.map((m, i) => <p key={i} className="whitespace-pre-wrap text-sm text-fog"><strong>{m.role === "user" ? "Você" : "Assistente"}: </strong>{m.content}</p>)}
    </div>
    <form onSubmit={e => { e.preventDefault(); void send(); }}>
      <label htmlFor="training-message" className="text-sm text-fog">Sua mensagem</label>
      <textarea id="training-message" maxLength={2000} value={input} onChange={e => { setInput(e.target.value); setReply(null); }} disabled={busy} className="mt-2 w-full rounded-lg border border-ink-600 bg-ink-950 p-3 text-fog" placeholder="Tenho 30 minutos e quero um treino leve..." />
      <button disabled={busy || !input.trim() || messages.length >= 20} className="mt-2 rounded-lg bg-volt-400 px-4 py-2 text-ink-950 disabled:opacity-50">{busy ? "Aguarde…" : "Enviar"}</button>
      <button type="button" disabled={busy} onClick={() => { setMessages([]); setReply(null); setError(""); setInput(""); }} className="ml-3 text-sm text-fog-dim">Nova conversa</button>
    </form>
    {error && <p role="alert" className="mt-3 text-sm text-fog">{error} Você pode usar o botão de geração tradicional acima.</p>}
    {reply?.proposalId && <div className="mt-4 rounded-lg border border-ink-600 p-3">
      <h3 className="font-bold text-fog">Revise sua proposta</h3>
      <ul className="mt-2 space-y-2 text-sm text-fog-dim">{reply.items.map(i => <li key={i.exerciseId}>{i.name}: {i.sets} séries × {i.reps} · descanso {i.rest}s</li>)}</ul>
      <button disabled={busy} onClick={() => void save()} className="mt-3 rounded-lg bg-volt-400 px-4 py-2 text-ink-950 disabled:opacity-50">Salvar proposta</button>
      <p className="mt-2 text-xs text-fog-mute">Proposta válida por 15 minutos. Para ajustar, envie outra mensagem.</p>
    </div>}
  </section>;
}
