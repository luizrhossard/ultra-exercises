package com.forja.service;

import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;

/**
 * Geração e verificação de códigos de recuperação de uso único (UE-24).
 * Códigos em claro existem apenas no retorno da geração; o banco guarda
 * somente hash BCrypt. Um código usado é invalidado imediatamente.
 */
@Service
@RequiredArgsConstructor
public class RecoveryCodeService {

    public static final int CODE_COUNT = 8;
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final SecureRandom random = new SecureRandom();
    private final PasswordEncoder encoder;

    /** Gera um lote novo de códigos em claro (formato XXXX-XXXX). */
    public List<String> generate() {
        List<String> codes = new ArrayList<>(CODE_COUNT);
        for (int i = 0; i < CODE_COUNT; i++) {
            StringBuilder sb = new StringBuilder(9);
            for (int j = 0; j < 8; j++) {
                if (j == 4) sb.append('-');
                sb.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
            }
            codes.add(sb.toString());
        }
        return codes;
    }

    /** Hash BCrypt do código para persistência. */
    public String hash(String plainCode) {
        return encoder.encode(plainCode);
    }

    /**
     * Índice do hash que corresponde ao código em claro (-1 se nenhum).
     * Permite ao chamador invalidar exatamente o código usado.
     */
    public int matchIndex(String rawCode, List<String> unusedHashes) {
        if (rawCode == null || rawCode.isBlank()) return -1;
        for (int i = 0; i < unusedHashes.size(); i++) {
            if (encoder.matches(rawCode, unusedHashes.get(i))) {
                return i;
            }
        }
        return -1;
    }
}
