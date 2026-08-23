package com.forja.web;

import com.forja.common.exception.UnauthorizedException;
import com.forja.domain.AppUser;
import com.forja.domain.RecoveryCode;
import com.forja.repository.AppUserRepository;
import com.forja.repository.RecoveryCodeRepository;
import com.forja.security.JwtService;
import com.forja.service.RecoveryCodeService;
import com.forja.service.TotpService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

/**
 * Ciclo de vida do 2FA (TOTP) do usuário autenticado [UE-24].
 * Ações sensíveis (regenerar códigos, desativar) exigem reautenticação:
 * senha atual + código TOTP válido. Códigos de recuperação são exibidos
 * uma única vez e persistidos apenas como hash BCrypt.
 */
@Slf4j
@RestController
@RequestMapping("/api/me/2fa")
@RequiredArgsConstructor
public class TwoFactorController {

    private static final long PENDING_TTL_MINUTES = 10;

    private final AppUserRepository users;
    private final RecoveryCodeRepository recoveryRepo;
    private final TotpService totp;
    private final RecoveryCodeService recoveryCodes;
    private final PasswordEncoder encoder;

    record SetupResponse(String secret, String otpauthUri) {}
    record CodeRequest(@NotBlank String code) {}
    record RecoveryCodesResponse(List<String> recoveryCodes) {}
    record ConfirmRequest(@NotBlank String password, @NotBlank String code) {}
    record StatusResponse(boolean enabled) {}

    @GetMapping("/status")
    StatusResponse status(Authentication auth) {
        return new StatusResponse(load(auth).isTotpEnabled());
    }

    @PostMapping("/setup")
    @Transactional
    SetupResponse setup(Authentication auth) {
        var user = requireNotEnabled(load(auth));
        String secret = totp.generateSecret();
        user.setTotpPendingSecret(secret);
        user.setTotpPendingExpiresAt(Instant.now().plusSeconds(PENDING_TTL_MINUTES * 60));
        users.save(user);
        log.info("security_event event=2fa_setup_started userId={}", user.getId());
        return new SetupResponse(secret, totp.otpauthUri(user.getEmail(), secret));
    }

    @PostMapping("/activate")
    @Transactional
    RecoveryCodesResponse activate(Authentication auth, @Valid @RequestBody CodeRequest request) {
        var user = requireNotEnabled(load(auth));
        Instant now = Instant.now();
        if (user.getTotpPendingSecret() == null
                || user.getTotpPendingExpiresAt() == null
                || now.isAfter(user.getTotpPendingExpiresAt())) {
            throw new UnauthorizedException("Configuração expirada. Inicie o processo novamente.");
        }
        if (!totp.verify(user.getTotpPendingSecret(), request.code())) {
            throw new UnauthorizedException("Código inválido.");
        }
        user.setTotpSecret(user.getTotpPendingSecret());
        user.setTotpEnabled(true);
        user.setTotpPendingSecret(null);
        user.setTotpPendingExpiresAt(null);
        users.save(user);

        List<String> plain = storeRecoveryCodes(user.getId());
        log.info("security_event event=2fa_activated userId={}", user.getId());
        return new RecoveryCodesResponse(plain);
    }

    @PostMapping("/recovery-codes")
    @Transactional
    RecoveryCodesResponse regenerate(Authentication auth, @Valid @RequestBody ConfirmRequest request) {
        var user = load(auth);
        requireStrongReauth(user, request);
        recoveryRepo.deleteByUserId(user.getId());
        List<String> plain = storeRecoveryCodes(user.getId());
        log.info("security_event event=2fa_recovery_codes_regenerated userId={}", user.getId());
        return new RecoveryCodesResponse(plain);
    }

    @PostMapping("/disable")
    @Transactional
    void disable(Authentication auth, @Valid @RequestBody ConfirmRequest request) {
        var user = load(auth);
        if (!user.isTotpEnabled()) {
            throw new IllegalArgumentException("Dois fatores não está ativo.");
        }
        requireStrongReauth(user, request);
        wipeTwoFactor(user);
        log.info("security_event event=2fa_disabled userId={}", user.getId());
    }

    // ---- helpers ----

    private AppUser load(Authentication auth) {
        return users.findByEmail(auth.getName())
                .orElseThrow(() -> new UnauthorizedException("Autenticação necessária."));
    }

    private AppUser requireNotEnabled(AppUser user) {
        if (user.isTotpEnabled()) {
            throw new IllegalArgumentException("Dois fatores já está ativo.");
        }
        return user;
    }

    /** Reautenticação forte: senha atual + código TOTP válido do segredo ativo. */
    private void requireStrongReauth(AppUser user, ConfirmRequest request) {
        if (!encoder.matches(request.password(), user.getPassword())) {
            throw new UnauthorizedException("Credenciais inválidas.");
        }
        if (!totp.verify(user.getTotpSecret(), request.code())) {
            throw new UnauthorizedException("Código inválido.");
        }
    }

    /** Persiste hashes e devolve códigos em claro (exibição única). */
    private List<String> storeRecoveryCodes(Long userId) {
        List<String> plain = recoveryCodes.generate();
        for (String code : plain) {
            recoveryRepo.save(RecoveryCode.builder()
                    .userId(userId)
                    .codeHash(recoveryCodes.hash(code))
                    .build());
        }
        return plain;
    }

    private void wipeTwoFactor(AppUser user) {
        user.setTotpSecret(null);
        user.setTotpEnabled(false);
        user.setTotpPendingSecret(null);
        user.setTotpPendingExpiresAt(null);
        users.save(user);
        recoveryRepo.deleteByUserId(user.getId());
    }
}
