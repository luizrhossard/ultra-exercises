package com.forja.common.ratelimit;

import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Janela deslizante em memória, chaveada por string (ex.: "login:ip",
 * "user:e-mail"). Suficiente para a instância única atual; para múltiplas
 * instâncias, trocar por armazenamento compartilhado (Redis/banco) mantendo
 * esta interface — ver docs/security/rate-limiting.md.
 */
@Service
public class SlidingWindowRateLimiter {

    /** Teto defensivo de chaves em memória (mitiga exaustão por IPs falsos). */
    static final int MAX_BUCKETS = 100_000;

    private final Map<String, Deque<Long>> buckets = new ConcurrentHashMap<>();

    public record Decision(boolean allowed, int retryAfterSeconds) {
        static final Decision ALLOWED = new Decision(true, 0);
    }

    public Decision tryAcquire(String key, int limit, long windowSeconds) {
        long now = System.currentTimeMillis();
        long windowMs = windowSeconds * 1000;

        Deque<Long> hits = buckets.computeIfAbsent(key, k -> new ArrayDeque<>());
        Decision decision;
        synchronized (hits) {
            while (!hits.isEmpty() && now - hits.peekFirst() >= windowMs) {
                hits.pollFirst();
            }
            if (hits.size() < limit) {
                hits.addLast(now);
                decision = Decision.ALLOWED;
            } else {
                long retryInMs = windowMs - (now - hits.peekFirst());
                decision = new Decision(false, Math.max(1, (int) Math.ceil(retryInMs / 1000.0)));
            }
        }

        if (buckets.size() > MAX_BUCKETS) {
            evictStale(now);
        }
        return decision;
    }

    private void evictStale(long now) {
        Iterator<Map.Entry<String, Deque<Long>>> it = buckets.entrySet().iterator();
        while (it.hasNext()) {
            Deque<Long> hits = it.next().getValue();
            synchronized (hits) {
                if (hits.isEmpty() || now - hits.peekLast() > 3_600_000) {
                    it.remove();
                }
            }
        }
    }
}
