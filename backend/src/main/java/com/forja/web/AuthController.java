package com.forja.web;

import com.forja.common.exception.UnauthorizedException;
import com.forja.domain.AppUser;
import com.forja.repository.AppUserRepository;
import com.forja.security.JwtService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AppUserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    record RegisterRequest(@NotBlank @Email String email,
                           @NotBlank @Size(min = 8) String password,
                           String name) {
    }

    record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {
    }

    record AuthResponse(String token, String email, String name) {
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
    ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return users.findByEmail(request.email())
                .filter(user -> encoder.matches(request.password(), user.getPassword()))
                .map(user -> ResponseEntity.ok(
                        new AuthResponse(jwt.issue(user.getEmail()), user.getEmail(), user.getName())))
                .orElseThrow(() -> new UnauthorizedException("Credenciais inválidas."));
    }
}
