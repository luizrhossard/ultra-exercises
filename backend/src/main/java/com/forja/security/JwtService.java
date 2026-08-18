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

    private final byte[] secret;
    private final long ttlMinutes;

    public JwtService(@Value("${forja.jwt.secret}") String secret,
                      @Value("${forja.jwt.ttl-minutes}") long ttlMinutes) {
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.ttlMinutes = ttlMinutes;
    }

    public String issue(String subject) {
        String header = b64("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
        long exp = Instant.now().plusSeconds(ttlMinutes * 60).getEpochSecond();
        String payload = b64("{\"sub\":\"%s\",\"exp\":%d}".formatted(subject, exp));
        return header + "." + payload + "." + sign(header + "." + payload);
    }

    public Optional<String> validate(String token) {
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
            return Optional.ofNullable(subject).filter(s -> !s.isBlank());
        } catch (Exception e) {
            return Optional.empty();
        }
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
