package com.forja.common.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.forja.config.RateLimitProperties;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class RequestSizeLimitFilterTest {

    private final RequestSizeLimitFilter filter = new RequestSizeLimitFilter(
            new RateLimitProperties(true, null, null, null, null, null, 1024),
            new ObjectMapper().findAndRegisterModules());

    @Test
    void rejectsOversizedBodyWith413() throws Exception {
        var request = new MockHttpServletRequest("POST", "/api/auth/register");
        request.setContentType("application/json");
        request.setContent(new byte[2048]);

        var response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> { throw new AssertionError("não deveria passar"); });

        assertThat(response.getStatus()).isEqualTo(413);
        assertThat(response.getContentAsString()).contains("PAYLOAD_TOO_LARGE");
    }

    @Test
    void passesBodiesWithinLimit() throws Exception {
        var request = new MockHttpServletRequest("POST", "/api/auth/register");
        request.setContentType("application/json");
        request.setContent(new byte[512]);

        var response = new MockHttpServletResponse();
        boolean[] reachedEnd = {false};
        filter.doFilter(request, response, (req, res) -> reachedEnd[0] = true);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(reachedEnd[0]).isTrue();
    }
}
