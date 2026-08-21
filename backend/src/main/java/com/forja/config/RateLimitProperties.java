package com.forja.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Limites de taxa por classe de endpoint (janela deslizante em memória).
 * Valores iniciais conservadores; ajustáveis por ambiente via propriedades.
 */
@ConfigurationProperties(prefix = "forja.rate-limit")
public record RateLimitProperties(
        boolean enabled,
        Rule login,
        Rule register,
        Rule publicRead,
        Rule authenticated,
        long maxPayloadBytes) {

    public record Rule(int limit, long windowSeconds) {
    }

    public RateLimitProperties {
        if (login == null) login = new Rule(5, 900);            // 5 por IP a cada 15 min
        if (register == null) register = new Rule(5, 3600);     // 5 por IP por hora
        if (publicRead == null) publicRead = new Rule(30, 60);  // 30 por IP por minuto
        if (authenticated == null) authenticated = new Rule(100, 60); // 100 por usuário por minuto
        if (maxPayloadBytes <= 0) maxPayloadBytes = 1_048_576;  // 1 MiB
    }
}
