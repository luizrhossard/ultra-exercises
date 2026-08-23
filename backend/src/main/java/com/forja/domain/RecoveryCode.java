package com.forja.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Código de recuperação de uso único (UE-24). Armazena apenas o hash BCrypt;
 * o código em claro é exibido uma única vez na geração.
 */
@Entity
@Table(name = "recovery_code")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecoveryCode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "code_hash", nullable = false, length = 100)
    private String codeHash;

    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
