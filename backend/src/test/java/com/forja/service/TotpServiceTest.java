package com.forja.service;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class TotpServiceTest {

    // Vetor oficial do RFC 6238 (SHA1): segredo ASCII "12345678901234567890".
    private static final String RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    private final TotpService totp = new TotpService();

    @Test
    void matchesRfc6238Vectors() {
        assertThat(totp.codeAt(RFC_SECRET, Instant.ofEpochSecond(59))).isEqualTo("287082");
        assertThat(totp.codeAt(RFC_SECRET, Instant.ofEpochSecond(1111111109))).isEqualTo("081804");
        assertThat(totp.verifyAt(RFC_SECRET, "287082", Instant.ofEpochSecond(59))).isTrue();
        assertThat(totp.verifyAt(RFC_SECRET, "081804", Instant.ofEpochSecond(1111111109))).isTrue();
    }

    @Test
    void acceptsCodeWithinOneStepOfDrift() {
        Instant now = Instant.ofEpochSecond(59);
        String code = totp.codeAt(RFC_SECRET, now);

        assertThat(totp.verifyAt(RFC_SECRET, code, now.plusSeconds(29))).isTrue();
        assertThat(totp.verifyAt(RFC_SECRET, code, now.minusSeconds(29))).isTrue();
    }

    @Test
    void rejectsCodeBeyondDriftWindow() {
        Instant now = Instant.ofEpochSecond(59);
        String code = totp.codeAt(RFC_SECRET, now);

        assertThat(totp.verifyAt(RFC_SECRET, code, now.plusSeconds(61))).isFalse();
    }

    @Test
    void rejectsMalformedCodesAndSecrets() {
        Instant now = Instant.ofEpochSecond(59);

        assertThat(totp.verifyAt(RFC_SECRET, "28708", now)).isFalse();     // 5 dígitos
        assertThat(totp.verifyAt(RFC_SECRET, "28708a", now)).isFalse();    // não numérico
        assertThat(totp.verifyAt(RFC_SECRET, null, now)).isFalse();
        assertThat(totp.verifyAt(null, "287082", now)).isFalse();
        assertThat(totp.verifyAt("!!!secreto-invalido!!!", "123456", now)).isFalse();
    }

    @Test
    void generatesUsableSecretsWithOtpauthUri() {
        String secret = totp.generateSecret();

        assertThat(secret).hasSize(32).matches("[A-Z2-7]+");
        String uri = totp.otpauthUri("ana@forja.com", secret);
        assertThat(uri)
                .startsWith("otpauth://totp/")
                .contains("secret=" + secret)
                .contains("issuer=Forja")
                .contains("digits=6")
                .contains("period=30");

        // Segredo gerado valida o próprio código no instante atual.
        String code = totp.codeAt(secret, Instant.now());
        assertThat(totp.verify(secret, code)).isTrue();
    }
}
