package com.forja.web;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * UE-25: contrato de erro padronizado com traceId em todas as respostas de
 * erro, correlação via header X-Trace-Id e formato de validação.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql(scripts = "/cleanup.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class ErrorContractIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Test
    void unauthorizedErrorCarriesTraceIdMatchingResponseHeader() throws Exception {
        MvcResult result = mvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.traceId").isNotEmpty())
                .andReturn();

        String bodyTraceId = JsonPath.read(result.getResponse().getContentAsString(), "$.traceId");
        assertThat(result.getResponse().getHeader("X-Trace-Id")).isEqualTo(bodyTraceId);
    }

    @Test
    void incomingTraceIdIsEchoedAndPresentInErrorBody() throws Exception {
        MvcResult result = mvc.perform(get("/api/me").header("X-Trace-Id", "client-trace-12345678"))
                .andExpect(status().isUnauthorized())
                .andReturn();

        String bodyTraceId = JsonPath.read(result.getResponse().getContentAsString(), "$.traceId");
        assertThat(bodyTraceId).isEqualTo("client-trace-12345678");
        assertThat(result.getResponse().getHeader("X-Trace-Id")).isEqualTo("client-trace-12345678");
    }

    @Test
    void validationErrorReturnsFieldsAndTraceId() throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content("{\"email\":\"invalido\",\"password\":\"123\",\"name\":\"X\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields").isArray())
                .andExpect(jsonPath("$.traceId").isNotEmpty())
                .andReturn();

        String bodyTraceId = JsonPath.read(result.getResponse().getContentAsString(), "$.traceId");
        assertThat(result.getResponse().getHeader("X-Trace-Id")).isEqualTo(bodyTraceId);
    }

    @Test
    void successfulRequestsAlsoReceiveTraceHeader() throws Exception {
        mvc.perform(get("/api/sports"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getHeader("X-Trace-Id");

        // O header é verificado na própria resposta acima; asserção explícita:
        MvcResult result = mvc.perform(get("/api/sports")).andExpect(status().isOk()).andReturn();
        assertThat(result.getResponse().getHeader("X-Trace-Id")).isNotBlank();
    }
}
