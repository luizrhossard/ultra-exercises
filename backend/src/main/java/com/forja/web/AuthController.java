package com.forja.web;

import com.forja.common.exception.UnauthorizedException;
import com.forja.domain.AppUser;
import com.forja.repository.AppUserRepository;
import com.forja.repository.RecoveryCodeRepository;
import com.forja.security.JwtService;
import com.forja.service.RecoveryCodeService;
import com.forja.service.TotpService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AppUserRepository users;
    private final RecoveryCodeRepository recoveryRepo;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final TotpService totp;
    private final RecoveryCodeService recoveryCodes;

    record RegisterRequest(@NotBlank @Email String email,
                           @NotBlank @Size(min = 8) String password,
                           String name) {
    }

    record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {
    }

    record AuthResponse(String token, String email, String name) {
    }

    /**
     * Resposta unificada do login: mfaRequired=true indica estado de autenticação
     * parcial — concluir via /2fa/verify com o challengeToken.
     */
    record LoginResponse(boolean mfaRequired, String challengeToken,
                         String token, String email, String name) {

        static LoginResponse direct(String token, String email, String name) {
            return new LoginResponse(false, null, token, email, name);
        }

        static LoginResponse challenge(String challengeToken) {
            return new LoginResponse(true, challengeToken, null, null, null);
        }
    }

    record VerifyRequest(@NotBlank String challengeToken, @NotBlank String code) {
    }

    @PostMapping("/register")
    ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        if (users.findByEmail(request.email()).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
        var user = users.save(AppUser.builder()
                .email(request.email())
                .password(encoder.encode(request.password()))
                .name(request.name())
                .build());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new AuthResponse(jwt.issue(user.getEmail()), user.getEmail(), user.getName()));
    }

    @PostMapping("/login")
    ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return users.findByEmail(request.email())
                .filter(user -> encoder.matches(request.password(), user.getPassword()))
                .map(user -> ResponseEntity.ok(respond(user)))
                .orElseThrow(() -> new UnauthorizedException("Credenciais inválidas."));
    }

    /** Segundo fator do login: código TOTP ou código de recuperação de uso único. */
    @PostMapping("/2fa/verify")
    @Transactional
    ResponseEntity<LoginResponse> verifyTwoFactor(@Valid @RequestBody VerifyRequest request) {
        String email = jwt.validateChallenge(request.challengeToken())
                .orElseThrow(() -> new UnauthorizedException("Sessão de verificação expirada. Entre novamente."));

        var user = users.findByEmail(email)
                .filter(AppUser::isTotpEnabled)
                .orElseThrow(() -> new UnauthorizedException("Sessão de verificação expirada. Entre novamente."));

        boolean success = authenticateSecondFactor(user, request.code());
        if (!success) {
            log.info("security_event event=2fa_challenge_failed userId={}", user.getId());
            // Mensagem neutra: não revela se falhou por código errado, usuário ou estado interno.
            throw new UnauthorizedException("Código inválido.");
        }
        log.info("security_event event=2fa_challenge_success userId={}", user.getId());
        return ResponseEntity.ok(LoginResponse.direct(jwt.issue(user.getEmail()), user.getEmail(), user.getName()));
    }

    private LoginResponse respond(AppUser user) {
        if (user.isTotpEnabled()) {
            // Autenticação parcial: credenciais primárias válidas, falta o segundo fator.
            return LoginResponse.challenge(jwt.issueChallenge(user.getEmail()));
        }
        return LoginResponse.direct(jwt.issue(user.getEmail()), user.getEmail(), user.getName());
    }

    private boolean authenticateSecondFactor(AppUser user, String code) {
        if (code.matches("\\d{6}")) {
            return totp.verify(user.getTotpSecret(), code);
        }
        // Código de recuperação: consome o primeiro hash correspondente não utilizado.
        var unused = recoveryRepo.findByUserIdAndUsedAtIsNull(user.getId());
        int index = recoveryCodes.matchIndex(code, unused.stream().map(rc -> rc.getCodeHash()).toList());
        if (index < 0) {
            return false;
        }
        var used = unused.get(index);
        used.setUsedAt(Instant.now());
        recoveryRepo.save(used);
        log.info("security_event event=recovery_code_used userId={}", user.getId());
        return true;
    }
}
