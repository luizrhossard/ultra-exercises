package com.forja.web;

import com.forja.TestUsers;
import com.forja.service.TotpService;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * UE-24: fluxo completo de 2FA — ativação, desafio no login, códigos de
 * recuperação de uso único, reautenticação forte e desativação.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Sql(scripts = "/cleanup.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class TwoFactorFlowIntegrationTest {

    @Autowired
    MockMvc mvc;
    @Autowired
    TotpService totp;

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private String loginChallengeToken(String email) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"email\":\"%s\",\"password\":\"senha12345\"}".formatted(email)))
                .andExpect(status().isOk())
                .andReturn();
        assertThat((boolean) JsonPath.read(result.getResponse().getContentAsString(), "$.mfaRequired")).isTrue();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.challengeToken");
    }

    @Test
    @Order(1)
    void loginWithoutTwoFactorReturnsDirectToken() throws Exception {
        TestUsers.register(mvc, "2fa@forja.com");

        mvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"email\":\"2fa@forja.com\",\"password\":\"senha12345\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mfaRequired").value(false))
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    @Order(2)
    void setupAndActivateEnrollsTwoFactor() throws Exception {
        String token = TestUsers.register(mvc, "ativa@forja.com");

        // Setup: segredo pendente + URI otpauth.
        MvcResult setup = mvc.perform(post("/api/me/2fa/setup").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.secret").isNotEmpty())
                .andExpect(jsonPath("$.otpauthUri").value(
                        org.hamcrest.Matchers.containsString("otpauth://totp/")))
                .andReturn();
        String secret = JsonPath.read(setup.getResponse().getContentAsString(), "$.secret");
        String code = totp.codeAt(secret, Instant.now());

        // Ativação exige código válido e devolve recovery codes uma única vez.
        MvcResult activate = mvc.perform(post("/api/me/2fa/activate")
                        .header("Authorization", bearer(token))
                        .contentType("application/json")
                        .content("{\"code\":\"%s\"}".formatted(code)))
                .andExpect(status().isOk())
                .andReturn();
        var recoveryCodes = (java.util.List<String>) JsonPath.read(
                activate.getResponse().getContentAsString(), "$.recoveryCodes");
        assertThat(recoveryCodes).hasSize(8);

        mvc.perform(get("/api/me/2fa/status").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true));
    }

    @Test
    @Order(3)
    void loginRequiresSecondFactorAndChallengeTokenCannotAuthenticate() throws Exception {
        String challenge = loginChallengeToken("ativa@forja.com");

        // Token de desafio NÃO serve como acesso pleno.
        mvc.perform(get("/api/me").header("Authorization", bearer(challenge)))
                .andExpect(status().isUnauthorized());

        // Código errado: 401 com mensagem neutra.
        mvc.perform(post("/api/auth/2fa/verify")
                        .contentType("application/json")
                        .content("{\"challengeToken\":\"%s\",\"code\":\"000000\"}".formatted(challenge)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Código inválido."));

        // Código correto conclui o login.
        String secret = pendingSecretOf("ativa@forja.com");
        MvcResult verify = mvc.perform(post("/api/auth/2fa/verify")
                        .contentType("application/json")
                        .content("{\"challengeToken\":\"%s\",\"code\":\"%s\"}"
                                .formatted(challenge, totp.codeAt(secret, Instant.now()))))
                .andExpect(status().isOk())
                .andReturn();
        String accessToken = JsonPath.read(verify.getResponse().getContentAsString(), "$.token");

        mvc.perform(get("/api/me").header("Authorization", bearer(accessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("ativa@forja.com"));
    }

    @Test
    @Order(4)
    void recoveryCodeWorksOnceOnly() throws Exception {
        // Regenera códigos com reautenticação forte (senha + TOTP).
        String secret = pendingSecretOf("ativa@forja.com");
        MvcResult regen = mvc.perform(post("/api/me/2fa/recovery-codes")
                        .header("Authorization", bearer(activeToken()))
                        .contentType("application/json")
                        .content("{\"password\":\"senha12345\",\"code\":\"%s\"}"
                                .formatted(totp.codeAt(secret, Instant.now()))))
                .andExpect(status().isOk())
                .andReturn();
        var codes = (java.util.List<String>) JsonPath.read(
                regen.getResponse().getContentAsString(), "$.recoveryCodes");
        String firstCode = codes.get(0);

        // Uso do código de recuperação no login.
        String challenge = loginChallengeToken("ativa@forja.com");
        MvcResult used = mvc.perform(post("/api/auth/2fa/verify")
                        .contentType("application/json")
                        .content("{\"challengeToken\":\"%s\",\"code\":\"%s\"}"
                                .formatted(challenge, firstCode)))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(JsonPath.<String>read(used.getResponse().getContentAsString(), "$.token")).isNotEmpty();

        // Segunda tentativa com o MESMO código falha (uso único).
        String challenge2 = loginChallengeToken("ativa@forja.com");
        mvc.perform(post("/api/auth/2fa/verify")
                        .contentType("application/json")
                        .content("{\"challengeToken\":\"%s\",\"code\":\"%s\"}"
                                .formatted(challenge2, firstCode)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(5)
    void disableRequiresStrongReauthAndRemovesTwoFactor() throws Exception {
        String secret = pendingSecretOf("ativa@forja.com");

        // Senha errada → negado.
        mvc.perform(post("/api/me/2fa/disable")
                        .header("Authorization", bearer(activeToken()))
                        .contentType("application/json")
                        .content("{\"password\":\"errada12345\",\"code\":\"%s\"}"
                                .formatted(totp.codeAt(secret, Instant.now()))))
                .andExpect(status().isUnauthorized());

        // Reautenticação forte → desativa.
        mvc.perform(post("/api/me/2fa/disable")
                        .header("Authorization", bearer(activeToken()))
                        .contentType("application/json")
                        .content("{\"password\":\"senha12345\",\"code\":\"%s\"}"
                                .formatted(totp.codeAt(secret, Instant.now()))))
                .andExpect(status().isOk());

        mvc.perform(get("/api/me/2fa/status").header("Authorization", bearer(activeToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false));

        // Login volta a ser direto, sem segundo fator.
        mvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"email\":\"ativa@forja.com\",\"password\":\"senha12345\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mfaRequired").value(false));
    }

    // ---- helpers ----

    /** Token de acesso pleno obtido passando pelo desafio 2FA completo. */
    private String activeTokenCache = null;

    private String activeToken() throws Exception {
        if (activeTokenCache != null) return activeTokenCache;
        String challenge = loginChallengeToken("ativa@forja.com");
        String secret = pendingSecretOf("ativa@forja.com");
        MvcResult result = mvc.perform(post("/api/auth/2fa/verify")
                        .contentType("application/json")
                        .content("{\"challengeToken\":\"%s\",\"code\":\"%s\"}"
                                .formatted(challenge, totp.codeAt(secret, Instant.now()))))
                .andExpect(status().isOk())
                .andReturn();
        activeTokenCache = JsonPath.read(result.getResponse().getContentAsString(), "$.token");
        return activeTokenCache;
    }

    /**
     * O teste precisa do segredo TOTP ativo para gerar códigos válidos.
     * O backend nunca o expõe pós-ativação; aqui recuperamos via banco de teste.
     */
    @Autowired
    org.springframework.jdbc.core.JdbcTemplate jdbc;

    private String pendingSecretOf(String email) {
        return jdbc.queryForObject(
                "select totp_secret from app_user where email = ?", String.class, email);
    }
}
