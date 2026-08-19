package com.forja.web;

import com.forja.domain.AppUser;
import com.forja.repository.AppUserRepository;
import com.forja.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock AppUserRepository users;
    @Mock PasswordEncoder encoder;
    @Mock JwtService jwt;

    AuthController controller;

    @BeforeEach
    void setUp() {
        controller = new AuthController(users, encoder, jwt);
    }

    @Test
    void registerCreatesUserAndReturnsToken() {
        when(users.findByEmail("novo@forja.com")).thenReturn(Optional.empty());
        when(encoder.encode("senha12345")).thenReturn("encoded");
        when(jwt.issue("novo@forja.com")).thenReturn("token-abc");
        when(users.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = controller.register(
                new AuthController.RegisterRequest("novo@forja.com", "senha12345", "Ana"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().token()).isEqualTo("token-abc");
        assertThat(response.getBody().email()).isEqualTo("novo@forja.com");
        assertThat(response.getBody().name()).isEqualTo("Ana");
        verify(users).save(argThat(u -> "encoded".equals(u.getPassword())));
    }

    @Test
    void registerWithExistingEmailReturnsConflict() {
        when(users.findByEmail("existe@forja.com"))
                .thenReturn(Optional.of(AppUser.builder().email("existe@forja.com").build()));

        var response = controller.register(
                new AuthController.RegisterRequest("existe@forja.com", "senha12345", null));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        verify(users, never()).save(any());
    }

    @Test
    void loginWithValidCredentialsReturnsToken() {
        AppUser user = AppUser.builder().email("a@forja.com").password("encoded").name("Ana").build();
        when(users.findByEmail("a@forja.com")).thenReturn(Optional.of(user));
        when(encoder.matches("senha12345", "encoded")).thenReturn(true);
        when(jwt.issue("a@forja.com")).thenReturn("token-xyz");

        var response = controller.login(new AuthController.LoginRequest("a@forja.com", "senha12345"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().token()).isEqualTo("token-xyz");
        assertThat(response.getBody().name()).isEqualTo("Ana");
    }

    @Test
    void loginWithWrongPasswordReturnsUnauthorized() {
        AppUser user = AppUser.builder().email("a@forja.com").password("encoded").build();
        when(users.findByEmail("a@forja.com")).thenReturn(Optional.of(user));
        when(encoder.matches("errada", "encoded")).thenReturn(false);

        var response = controller.login(new AuthController.LoginRequest("a@forja.com", "errada"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void loginWithUnknownEmailReturnsUnauthorized() {
        when(users.findByEmail("nope@forja.com")).thenReturn(Optional.empty());

        var response = controller.login(new AuthController.LoginRequest("nope@forja.com", "senha12345"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}