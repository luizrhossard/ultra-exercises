package com.forja.service;

import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;

/**
 * TOTP (RFC 6238) minimalista, sem dependências extras — mesma filosofia do
 * {@link com.forja.security.JwtService}. Parâmetros padrão de apps
 * autenticadores: HMAC-SHA1, 6 dígitos, passo de 30 s, tolerância de ±1 passo.
 * A validação usa o horário do SERVIDOR (nunca o do cliente).
 */
@Service
public class TotpService {

    static final int SECRET_BYTES = 20;          // 160 bits → Base32 de 32 chars
    static final long STEP_SECONDS = 30;
    static final int DIGITS = 6;
    static final long ALLOWED_DRIFT_STEPS = 1;

    private static final String BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    private final SecureRandom random = new SecureRandom();

    /** Gera segredo novo (Base32, compatível com Google/Microsoft/Authy). */
    public String generateSecret() {
        byte[] bytes = new byte[SECRET_BYTES];
        random.nextBytes(bytes);
        return base32Encode(bytes);
    }

    /** URI para QR Code de apps autenticadores. */
    public String otpauthUri(String email, String secret) {
        String label = URLEncoder.encode("Forja:" + email, StandardCharsets.UTF_8);
        return "otpauth://totp/" + label
                + "?secret=" + secret + "&issuer=Forja"
                + "&algorithm=SHA1&digits=" + DIGITS + "&period=" + STEP_SECONDS;
    }

    /** Código TOTP válido no instante informado (uso em testes e ferramentas). */
    public String codeAt(String base32Secret, Instant now) {
        byte[] key = base32Decode(base32Secret);
        return hotp(key, now.getEpochSecond() / STEP_SECONDS);
    }

    /** Valida código contra o instante atual (janela ±1 passo). */
    public boolean verify(String base32Secret, String code) {
        return verifyAt(base32Secret, code, Instant.now());
    }

    /** Variante com relógio injetável para testes determinísticos. */
    public boolean verifyAt(String base32Secret, String code, Instant now) {
        if (base32Secret == null || code == null || !code.matches("\\d{" + DIGITS + "}")) {
            return false;
        }
        byte[] key;
        try {
            key = base32Decode(base32Secret);
        } catch (IllegalArgumentException e) {
            return false;
        }
        long currentStep = now.getEpochSecond() / STEP_SECONDS;
        for (long drift = -ALLOWED_DRIFT_STEPS; drift <= ALLOWED_DRIFT_STEPS; drift++) {
            if (MessageDigest.isEqual(
                    hotp(key, currentStep + drift).getBytes(StandardCharsets.UTF_8),
                    code.getBytes(StandardCharsets.UTF_8))) {
                return true;
            }
        }
        return false;
    }

    private String hotp(byte[] key, long counter) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(key, "HmacSHA1"));
            byte[] hash = mac.doFinal(ByteBuffer.allocate(8).putLong(counter).array());
            int offset = hash[hash.length - 1] & 0x0F;
            int binary = ((hash[offset] & 0x7F) << 24)
                    | ((hash[offset + 1] & 0xFF) << 16)
                    | ((hash[offset + 2] & 0xFF) << 8)
                    | (hash[offset + 3] & 0xFF);
            int modulo = (int) Math.pow(10, DIGITS);
            return String.format("%0" + DIGITS + "d", binary % modulo);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Falha ao calcular TOTP", e);
        }
    }

    private static String base32Encode(byte[] bytes) {
        StringBuilder out = new StringBuilder((bytes.length * 8 + 4) / 5);
        int buffer = 0;
        int bitsLeft = 0;
        for (byte b : bytes) {
            buffer = (buffer << 8) | (b & 0xFF);
            bitsLeft += 8;
            while (bitsLeft >= 5) {
                out.append(BASE32_ALPHABET.charAt((buffer >> (bitsLeft - 5)) & 0x1F));
                bitsLeft -= 5;
            }
        }
        if (bitsLeft > 0) {
            out.append(BASE32_ALPHABET.charAt((buffer << (5 - bitsLeft)) & 0x1F));
        }
        return out.toString();
    }

    private static byte[] base32Decode(String input) {
        if (!input.matches("[" + BASE32_ALPHABET + "]+={0,6}")) {
            throw new IllegalArgumentException("segredo Base32 inválido");
        }
        String clean = input.replace("=", "");
        byte[] out = new byte[clean.length() * 5 / 8];
        int buffer = 0;
        int bitsLeft = 0;
        int index = 0;
        for (char c : clean.toCharArray()) {
            buffer = (buffer << 5) | BASE32_ALPHABET.indexOf(c);
            bitsLeft += 5;
            if (bitsLeft >= 8) {
                out[index++] = (byte) ((buffer >> (bitsLeft - 8)) & 0xFF);
                bitsLeft -= 8;
            }
        }
        return out;
    }
}
