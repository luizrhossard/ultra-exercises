package com.forja.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * UE-26: headers de segurança, CORS restritivo e rate limiting end-to-end.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "forja.rate-limit.login.limit=2",
        "forja.rate-limit.login.window-seconds=900",
})
class SecurityHeadersAndRateLimitIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Test
    void responsesCarrySecurityHeaders() throws Exception {
        mvc.perform(get("/api/sports"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Referrer-Policy", "strict-origin-when-cross-origin"))
                .andExpect(header().exists("Permissions-Policy"))
                .andExpect(header().exists("Content-Security-Policy-Report-Only"));
    }

    @Test
    void hstsIsAbsentOverHttpWhenDisabled() throws Exception {
        MvcResult result = mvc.perform(get("/api/sports")).andExpect(status().isOk()).andReturn();
        assertThat(result.getResponse().getHeader("Strict-Transport-Security")).isNull();
    }

    @Test
    void corsAllowsConfiguredOrigin() throws Exception {
        mvc.perform(options("/api/sports")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
    }

    @Test
    void corsRejectsUnknownOrigin() throws Exception {
        MvcResult result = mvc.perform(options("/api/sports")
                        .header("Origin", "https://evil.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andReturn();

        assertThat(result.getResponse().getStatus()).isIn(403, 200);
        // O header decisivo NÃO pode ser emitido para origem desconhecida.
        assertThat(result.getResponse().getHeader("Access-Control-Allow-Origin")).isNull();
    }

    @Test
    void loginRateLimitBlocksExcessiveAttempts() throws Exception {
        String ip = "10.99.99.77";
        org.springframework.test.web.servlet.request.RequestPostProcessor fromIp = request -> {
            request.setRemoteAddr(ip);
            return request;
        };
        var loginBody = "{\"email\":\"ninguem@forja.com\",\"password\":\"senha12345\"}";

        for (int i = 0; i < 2; i++) {
            mvc.perform(post("/api/auth/login").with(fromIp)
                            .contentType("application/json")
                            .content(loginBody))
                    .andExpect(status().isUnauthorized());
        }

        // 3ª tentativa do mesmo IP é bloqueada antes de chegar ao controller.
        mvc.perform(post("/api/auth/login").with(fromIp)
                        .contentType("application/json")
                        .content(loginBody))
                .andExpect(status().is(429))
                .andExpect(jsonPath("$.error").value("RATE_LIMITED"))
                .andExpect(header().exists("Retry-After"));

        // IP diferente não é afetado (isolamento por chave).
        mvc.perform(post("/api/auth/login").with(request -> {
                    request.setRemoteAddr("10.99.99.78");
                    return request;
                })
                        .contentType("application/json")
                        .content(loginBody))
                .andExpect(status().isUnauthorized());
    }
}
