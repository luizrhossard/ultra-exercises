package com.forja.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "app_user")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 160)
    private String email;

    @Column(nullable = false, length = 100)
    private String password;

    @Column(length = 80)
    private String name;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    // ---- Dois fatores (TOTP) [UE-24] ----

    /** Segredo TOTP ativo. Presente apenas quando totpEnabled=true. */
    @Column(name = "totp_secret", length = 255)
    private String totpSecret;

    @Column(name = "totp_enabled", nullable = false)
    @Builder.Default
    private boolean totpEnabled = false;

    /** Segredo aguardando confirmação de código (setup). Expira em totpPendingExpiresAt. */
    @Column(name = "totp_pending_secret", length = 255)
    private String totpPendingSecret;

    @Column(name = "totp_pending_expires_at")
    private Instant totpPendingExpiresAt;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<UserSport> userSports = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Routine> routines = new ArrayList<>();
}
