# Runbook · Pressão de memória JVM (heap > 90%)

**Alerta de origem:** `ForjaJvmHeapPressure` (warning)

## Sintomas
- `jvm_memory_used_bytes{area="heap"} / jvm_memory_max_bytes > 0.9` por 15 min
- Picos de pausa do GC; resposta oscilando entre rápida e lenta
- Em estágio avançado: `OutOfMemoryError` nos logs e morte do processo

## Diagnóstico
1. Painel **"JVM heap"**: padrão serra (GC recupera) = carga; rampa sem volta
   = vazamento.
2. Vazamento costuma estar em cache crescente, coleções estáticas ou
   listeners não removidos. Correlacionar com deploy recente.
3. Heap dump em emergência (antes de reiniciar):
   `jcmd <pid> GC.heap_dump /tmp/forja-heap.hprof` — analisar com Eclipse MAT.

## Ação imediata
- Carga legítima → aumentar `-Xmx` da instância com folga real de RAM.
- Vazamento suspeito → reiniciar a API recupera imediatamente; preservar o
  heap dump ANTES do restart para análise com issue dedicada.

## Verificação
- Heap estabilizado abaixo de 70% após o GC no painel.
- Sem novos disparos de `ForjaJvmHeapPressure` em 1h.

## Escalação
- Vazamento confirmado → issue com dump anexado e janela de reprodução;
  considerar limitar payload/cache enquanto o fix estrutural não sai.
