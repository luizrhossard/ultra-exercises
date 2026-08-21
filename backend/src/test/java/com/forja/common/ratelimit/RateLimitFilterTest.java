package com.forja.common.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.forja.config.RateLimitProperties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitFilterTest {

    private final SlidingWindowRateLimiter limiter = new SlidingWindowRateLimiter();
    // Mesmo comportamento do mapper do Spring (módulo java.time registrado).
    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();
    private RateLimitFilter filter;

    @BeforeEach
    void setUp() {
        filter = new RateLimitFilter(new RateLimitProperties(
                true,
                new RateLimitProperties.Rule(2, 900),   // login
                new RateLimitProperties.Rule(2, 3600),  // register
                new RateLimitProperties.Rule(3, 60),    // public read
                new RateLimitProperties.Rule(5, 60),    // authenticated
                1024), limiter, json);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private MockHttpServletResponse run(MockHttpServletRequest request) {
        try {
            var response = new MockHttpServletResponse();
            filter.doFilter(request, response, new MockFilterChain());
            return response;
        } catch (Exception e) {
            throw new IllegalStateException("falha ao executar filtro", e);
        }
    }

    private MockHttpServletRequest request(String method, String uri, String ip) {
        var request = new MockHttpServletRequest(method, uri);
        request.setRemoteAddr(ip);
        return request;
    }

    @Test
    void allowsUnderLimitAndBlocksAboveWith429AndRetryAfter() throws Exception {
        String ip = "10.10.0.%d".formatted(System.nanoTime() % 250);
        assertThat(run(request("POST", "/api/auth/login", ip)).getStatus()).isEqualTo(200);
        assertThat(run(request("POST", "/api/auth/login", ip)).getStatus()).isEqualTo(200);

        var blocked = run(request("POST", "/api/auth/login", ip));
        assertThat(blocked.getStatus()).isEqualTo(429);
        assertThat(blocked.getHeader("Retry-After")).isNotNull();
        assertThat(blocked.getContentAsString()).contains("RATE_LIMITED");
    }

    @Test
    void isolatesBucketsPerClientIp() {
        String suffix = Long.toString(System.nanoTime());
        String ipA = "10.20.0.11." + suffix;
        String ipB = "10.20.0.22." + suffix;

        // Intercalado: cada IP consome seu próprio bucket até o limite (2).
        for (int i = 0; i < 2; i++) {
            assertThat(run(request("POST", "/api/auth/login", ipA)).getStatus()).isEqualTo(200);
            assertThat(run(request("POST", "/api/auth/login", ipB)).getStatus()).isEqualTo(200);
        }

        // ipA esgota, mas ipC (bucket próprio) segue liberado.
        assertThat(run(request("POST", "/api/auth/login", ipA)).getStatus()).isEqualTo(429);
        assertThat(run(request("POST", "/api/auth/login", "10.20.0.33." + suffix)).getStatus()).isEqualTo(200);
    }

    @Test
    void authenticatedRequestsAreKeyedByUserNotByIp() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("atleta@forja.com", null, List.of()));

        int blocked = 0;
        for (int i = 0; i < 6; i++) {
            if (run(request("GET", "/api/routines", "10.30.0.1")).getStatus() == 429) blocked++;
        }
        assertThat(blocked).isEqualTo(1); // limite de usuário é 5; só a 6ª bloqueia

        SecurityContextHolder.clearContext();
        // Mesmo IP agora anônimo usa bucket distinto ("anon:") → não é bloqueado.
        assertThat(run(request("GET", "/api/routines", "10.30.0.1")).getStatus()).isEqualTo(200);
    }
}
