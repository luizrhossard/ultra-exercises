package com.forja.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class TraceIdFilterTest {

    private final TraceIdFilter filter = new TraceIdFilter();

    @BeforeEach
    @AfterEach
    void cleanMdc() {
        MDC.clear();
    }

    /** Captura o MDC no momento em que a cadeia é executada. */
    private static class CapturingChain extends MockFilterChain {
        final AtomicReference<String> mdcDuringRequest = new AtomicReference<>();

        @Override
        public void doFilter(ServletRequest request, ServletResponse response)
                throws IOException, ServletException {
            mdcDuringRequest.set(MDC.get(TraceIdFilter.MDC_KEY));
            super.doFilter(request, response);
        }
    }

    @Test
    void generatesTraceIdWhenAbsentAndClearsMdcAfterwards() throws Exception {
        var request = new MockHttpServletRequest("GET", "/api/sports");
        var response = new MockHttpServletResponse();
        var chain = new CapturingChain();

        filter.doFilter(request, response, (FilterChain) chain);

        String traceId = response.getHeader(TraceIdFilter.HEADER);
        assertThat(traceId).isNotBlank();
        assertThat(traceId).hasSize(36); // formato UUID
        assertThat(chain.mdcDuringRequest.get()).isEqualTo(traceId);
        assertThat(MDC.get(TraceIdFilter.MDC_KEY)).isNull(); // limpo após a requisição
    }

    @Test
    void propagatesValidIncomingTraceId() throws Exception {
        var request = new MockHttpServletRequest("GET", "/api/sports");
        request.addHeader(TraceIdFilter.HEADER, "frontend-trace-9876543210");
        var response = new MockHttpServletResponse();
        var chain = new CapturingChain();

        filter.doFilter(request, response, (FilterChain) chain);

        assertThat(response.getHeader(TraceIdFilter.HEADER)).isEqualTo("frontend-trace-9876543210");
        assertThat(chain.mdcDuringRequest.get()).isEqualTo("frontend-trace-9876543210");
    }

    @Test
    void replacesUnsafeIncomingTraceId() throws Exception {
        var request = new MockHttpServletRequest("GET", "/api/sports");
        request.addHeader(TraceIdFilter.HEADER, "id com espaços e <script>alert(1)</script>");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        String traceId = response.getHeader(TraceIdFilter.HEADER);
        assertThat(traceId).doesNotContain("<").doesNotContain(" ").hasSize(36);
    }

    @Test
    void replacesTooLongIncomingTraceId() throws Exception {
        var request = new MockHttpServletRequest("GET", "/api/sports");
        request.addHeader(TraceIdFilter.HEADER, "a".repeat(200));
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getHeader(TraceIdFilter.HEADER)).hasSize(36);
    }
}
