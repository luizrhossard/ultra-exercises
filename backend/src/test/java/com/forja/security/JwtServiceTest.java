package com.forja.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private static final String SECRET = "test-secret-0123456789abcdefghijklmnopqrstuv";

    @Test
    void issuedTokenValidatesToSubject() {
        JwtService jwt = new JwtService(SECRET, 60);

        String token = jwt.issue("atleta@forja.com");

        assertThat(jwt.validate(token)).contains("atleta@forja.com");
    }

    @Test
    void tamperedTokenIsRejected() {
        JwtService jwt = new JwtService(SECRET, 60);
        String token = jwt.issue("atleta@forja.com");

        String tampered = token.substring(0, token.length() - 2) + "xx";

        assertThat(jwt.validate(tampered)).isEmpty();
    }

    @Test
    void malformedTokenIsRejected() {
        JwtService jwt = new JwtService(SECRET, 60);

        assertThat(jwt.validate("no-dots")).isEmpty();
        assertThat(jwt.validate("only.two.parts")).isEmpty();
        assertThat(jwt.validate("")).isEmpty();
    }

    @Test
    void expiredTokenIsRejected() {
        JwtService jwt = new JwtService(SECRET, -1);

        String token = jwt.issue("atleta@forja.com");

        assertThat(jwt.validate(token)).isEmpty();
    }

    @Test
    void tokenSignedWithDifferentSecretIsRejected() {
        JwtService issuer = new JwtService(SECRET, 60);
        JwtService verifier = new JwtService("another-secret-0123456789abcdefghijklmnopqrstuv", 60);

        assertThat(verifier.validate(issuer.issue("atleta@forja.com"))).isEmpty();
    }
}