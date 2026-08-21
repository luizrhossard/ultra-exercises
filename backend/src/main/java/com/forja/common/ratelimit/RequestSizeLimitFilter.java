package com.forja.common.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.forja.common.exception.ErrorResponse;
import com.forja.config.RateLimitProperties;
import com.forja.config.TraceIdFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Rejeita cedo requisições com corpo acima do limite configurado (padrão 1 MiB),
 * protegendo memória e largura de banda. Corpos chunked (sem Content-Length)
 * não são medidos aqui — limitação documentada.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 5)
@RequiredArgsConstructor
public class RequestSizeLimitFilter extends OncePerRequestFilter {

    private static final List<String> BODY_METHODS = List.of("POST", "PUT", "PATCH");

    private final RateLimitProperties props;
    private final ObjectMapper json;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (BODY_METHODS.contains(request.getMethod())) {
            long contentLength = request.getContentLengthLong();
            if (contentLength > props.maxPayloadBytes()) {
                response.setStatus(413);
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write(json.writeValueAsString(ErrorResponse.of(
                        413, "PAYLOAD_TOO_LARGE", "Corpo da requisição muito grande.",
                        List.of(), MDC.get(TraceIdFilter.MDC_KEY))));
                return;
            }
        }
        chain.doFilter(request, response);
    }
}
