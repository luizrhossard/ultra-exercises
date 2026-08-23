package com.forja.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.forja.common.exception.ErrorResponse;
import com.forja.common.ratelimit.RateLimitFilter;
import com.forja.common.ratelimit.SlidingWindowRateLimiter;
import com.forja.security.JwtAuthFilter;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.io.IOException;
import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    /**
     * CSP em modo Report-Only na fase inicial (não bloqueia, apenas reporta).
     * 'unsafe-inline' em style-src: exigência do swagger-ui, exceção documentada
     * em docs/security/http-security-headers.md. Ativar modo efetivo após
     * validar ausência de violações.
     */
    static final String CSP_POLICY = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

    private final JwtAuthFilter jwtAuthFilter;
    private final ObjectMapper json;
    private final SlidingWindowRateLimiter rateLimiter;
    private final RateLimitProperties rateLimitProperties;

    @Value("${forja.cors.origins}")
    private String corsOrigins;

    @Value("${forja.security.hsts-enabled:false}")
    private boolean hstsEnabled;

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // API stateless com JWT no header Authorization: CSRF não se aplica.
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsSource()))
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // catálogo público; rotinas e geração exigem JWT; Swagger/OpenAPI públicos (dev)
                        .requestMatchers("/api/auth/**", "/api/sports/**", "/api/exercises/**",
                                "/api/share/**",
                                "/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        .anyRequest().authenticated())
                .headers(headers -> {
                    headers.contentTypeOptions(withDefaults -> {});
                    headers.frameOptions(frame -> frame.deny());
                    headers.referrerPolicy(referrer -> referrer.policy(
                            org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN));
                    headers.permissionsPolicy(permissions -> permissions.policy(
                            "geolocation=(), camera=(), microphone=(), payment=(), usb=()"));
                    headers.contentSecurityPolicy(csp -> csp.reportOnly().policyDirectives(CSP_POLICY));
                    if (hstsEnabled) {
                        headers.httpStrictTransportSecurity(hsts -> hsts.includeSubDomains(true).maxAgeInSeconds(31_536_000));
                    }
                })
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, e) ->
                                writeError(response, 401, "UNAUTHORIZED", "Autenticação necessária."))
                        .accessDeniedHandler((request, response, e) ->
                                writeError(response, 403, "FORBIDDEN", "Acesso negado.")))
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                // Depois da autenticação JWT: permite limitar por usuário autenticado.
                .addFilterAfter(new RateLimitFilter(rateLimitProperties, rateLimiter, json), JwtAuthFilter.class);
        return http.build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    private void writeError(HttpServletResponse response, int status, String error, String message)
            throws IOException {
        String traceId = MDC.get(TraceIdFilter.MDC_KEY);
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(json.writeValueAsString(ErrorResponse.of(status, error, message, List.of(), traceId)));
    }

    /** Somente origens explicitamente configuradas por ambiente; sem wildcard. */
    private CorsConfigurationSource corsSource() {
        var config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(corsOrigins.split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setMaxAge(3600L);
        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
