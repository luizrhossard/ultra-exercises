package com.forja.common.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.forja.common.exception.ErrorResponse;
import com.forja.config.RateLimitProperties;
import com.forja.config.TraceIdFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Limite de taxa por endpoint. Regras:
 * - login/cadastro: chave = IP do cliente (janelas rígidas);
 * - leitura pública (/sports, /exercises): chave = IP;
 * - API autenticada: chave = usuário; sem usuário válido: IP.
 * Retorna 429 padronizado com Retry-After e registra evento WARN sem
 * armazenar o valor bruto da chave.
 */
@Slf4j
public class RateLimitFilter extends OncePerRequestFilter {

    private static final List<String> PUBLIC_READ_PREFIXES = List.of("/api/sports", "/api/exercises");

    private final RateLimitProperties props;
    private final SlidingWindowRateLimiter limiter;
    private final ObjectMapper json;

    public RateLimitFilter(RateLimitProperties props, SlidingWindowRateLimiter limiter, ObjectMapper json) {
        this.props = props;
        this.limiter = limiter;
        this.json = json;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !props.enabled();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String ip = clientIp(request);
        String scope;
        String key;
        RateLimitProperties.Rule rule;

        if (HttpMethod.POST.matches(request.getMethod()) && "/api/auth/login".equals(request.getRequestURI())) {
            scope = "login";
            rule = props.login();
            key = "login:" + ip;
        } else if (HttpMethod.POST.matches(request.getMethod()) && "/api/auth/register".equals(request.getRequestURI())) {
            scope = "register";
            rule = props.register();
            key = "register:" + ip;
        } else if (isPublicRead(request)) {
            scope = "public";
            rule = props.publicRead();
            key = "pub:" + ip;
        } else {
            String user = currentUser();
            if (user != null) {
                scope = "user";
                rule = props.authenticated();
                key = "user:" + user;
            } else {
                scope = "anonymous";
                rule = props.publicRead();
                key = "anon:" + ip;
            }
        }

        var decision = limiter.tryAcquire(key, rule.limit(), rule.windowSeconds());
        if (!decision.allowed()) {
            // Sem o valor da chave no log: IP/e-mail não são armazenados aqui.
            log.warn("rate_limited scope={} route={} retryAfterSeconds={}",
                    scope, request.getRequestURI(), decision.retryAfterSeconds());
            response.setStatus(429);
            response.setHeader("Retry-After", Integer.toString(decision.retryAfterSeconds()));
            response.setContentType("application/json;charset=UTF-8");
            String traceId = MDC.get(TraceIdFilter.MDC_KEY);
            response.getWriter().write(json.writeValueAsString(ErrorResponse.of(
                    429, "RATE_LIMITED",
                    "Muitas requisições. Aguarde %d segundos e tente novamente.".formatted(decision.retryAfterSeconds()),
                    List.of(), traceId)));
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean isPublicRead(HttpServletRequest request) {
        if (!HttpMethod.GET.matches(request.getMethod())) return false;
        String path = request.getRequestURI();
        return PUBLIC_READ_PREFIXES.stream().anyMatch(path::startsWith);
    }

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return null;
        }
        return String.valueOf(auth.getPrincipal());
    }

    /** IP real atrás de proxy confiável (primeiro valor de X-Forwarded-For); caso contrário, remoteAddr. */
    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            return (comma > 0 ? forwarded.substring(0, comma) : forwarded).trim();
        }
        return request.getRemoteAddr();
    }
}
