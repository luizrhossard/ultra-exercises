package com.forja.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

/** JWT HS256 minimalista, sem dependências extras. */
@Component
public class JwtService {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();

    /** Vida útil do estado de autenticação parcial (desafio 2FA): 5 minutos. */
    static final long CHALLENGE_TTL_SECONDS = 300;

    private final byte[] secret;
    private final long ttlMinutes;

    public JwtService(@Value("${forja.jwt.secret}") String secret,
                      @Value("${forja.jwt.ttl-minutes}") long ttlMinutes) {
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.ttlMinutes = ttlMinutes;
    }

    public String issue(String subject) {
        return issueToken(subject, ttlMinutes * 60, null);
    }

    /** Token de desafio 2FA: vida curta, só serve para concluir o login (UE-24). */
    public String issueChallenge(String subject) {
        return issueToken(subject, CHALLENGE_TTL_SECONDS, "2fa");
    }

    private String issueToken(String subject, long ttlSeconds, String typ) {
        String header = b64("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
        long exp = Instant.now().plusSeconds(ttlSeconds).getEpochSecond();
        String payload = typ == null
                ? b64("{\"sub\":\"%s\",\"exp\":%d}".formatted(subject, exp))
                : b64("{\"sub\":\"%s\",\"exp\":%d,\"typ\":\"%s\"}".formatted(subject, exp, typ));
        return header + "." + payload + "." + sign(header + "." + payload);
    }

    public record JwtClaims(String sub, String typ) {
    }

    public Optional<JwtClaims> parse(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) return Optional.empty();

            String expected = sign(parts[0] + "." + parts[1]);
            if (!MessageDigest.isEqual(
                    expected.getBytes(StandardCharsets.UTF_8),
                    parts[2].getBytes(StandardCharsets.UTF_8))) {
                return Optional.empty();
            }

            var payload = JSON.readTree(
                    Base64.getUrlDecoder().decode(parts[1]));
            long exp = payload.path("exp").asLong(0);
            if (exp < Instant.now().getEpochSecond()) return Optional.empty();

            String subject = payload.path("sub").asText(null);
            if (subject == null || subject.isBlank()) return Optional.empty();

            String typ = payload.hasNonNull("typ") ? payload.path("typ").asText() : null;
            return Optional.of(new JwtClaims(subject, typ));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    /** Token de acesso pleno: rejeita explicitamente tokens de desafio. */
    public Optional<String> validate(String token) {
        return parse(token)
                .filter(claims -> claims.typ() == null)
                .map(JwtClaims::sub);
    }

    /** Token de desafio 2FA: só aceita o tipo "2fa". */
    public Optional<String> validateChallenge(String token) {
        return parse(token)
                .filter(claims -> "2fa".equals(claims.typ()))
                .map(JwtClaims::sub);
    }

    private String sign(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return B64.encodeToString(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao assinar JWT", e);
        }
    }

    private String b64(String raw) {
        return B64.encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }
}
