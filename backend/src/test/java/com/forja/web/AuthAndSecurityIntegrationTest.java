package com.forja.web;

import com.forja.TestUsers;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Testes de integração: autenticação, 401/403, IDOR e contrato de erro padronizado. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql(scripts = "/cleanup.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class AuthAndSecurityIntegrationTest {

    @Autowired
    MockMvc mvc;

    private String bearer(String token) {
        return "Bearer " + token;
    }

    @Test
    void unauthenticatedRequestIsRejectedWithStandardizedError() throws Exception {
        mvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("Autenticação necessária."));
    }

    @Test
    void registerReturnsTokenAndAllowsAccessToMe() throws Exception {
        String token = TestUsers.register(mvc, "ana@forja.com");

        mvc.perform(get("/api/me").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("ana@forja.com"));
    }

    @Test
    void loginWithValidCredentialsReturnsToken() throws Exception {
        TestUsers.register(mvc, "login@forja.com");

        mvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"email\":\"login@forja.com\",\"password\":\"senha12345\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.email").value("login@forja.com"));
    }

    @Test
    void loginWithInvalidCredentialsReturnsStandardizedUnauthorized() throws Exception {
        mvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"email\":\"ninguem@forja.com\",\"password\":\"errada123\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
    }

    @Test
    void registerWithInvalidPayloadReturnsValidationErrorWithFields() throws Exception {
        mvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content("{\"email\":\"curta@forja.com\",\"password\":\"123\",\"name\":\"X\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields[0].field").value("password"))
                .andExpect(jsonPath("$.fields[0].message").isNotEmpty());
    }

    @Test
    void userCannotAccessAnotherUsersRoutine() throws Exception {
        String tokenA = TestUsers.register(mvc, "dona@forja.com");
        String tokenB = TestUsers.register(mvc, "intruso@forja.com");

        String routineBody = mvc.perform(post("/api/routines/generate")
                        .header("Authorization", bearer(tokenA))
                        .contentType("application/json")
                        .content("{\"sportId\":1}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long routineId = ((Number) JsonPath.read(routineBody, "$.id")).longValue();

        // IDOR: usuário B não pode alterar itens da rotina de A (responde 404, sem vazar existência)
        mvc.perform(patch("/api/routines/{id}/items/{exerciseId}", routineId, 1)
                        .header("Authorization", bearer(tokenB))
                        .contentType("application/json")
                        .content("{\"sets\":3}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("NOT_FOUND"));

        // IDOR: B não pode criar sessão a partir da rotina de A
        mvc.perform(post("/api/routines/{id}/sessions", routineId)
                        .header("Authorization", bearer(tokenB)))
                .andExpect(status().isNotFound());

        // B não enxerga a rotina de A na própria lista
        mvc.perform(get("/api/routines").header("Authorization", bearer(tokenB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void userCannotPatchAnotherUsersSession() throws Exception {
        String tokenA = TestUsers.register(mvc, "sessao.a@forja.com");
        String tokenB = TestUsers.register(mvc, "sessao.b@forja.com");

        String routineBody = mvc.perform(post("/api/routines/generate")
                        .header("Authorization", bearer(tokenA))
                        .contentType("application/json")
                        .content("{\"sportId\":1}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long routineId = ((Number) JsonPath.read(routineBody, "$.id")).longValue();

        String sessionBody = mvc.perform(post("/api/routines/{id}/sessions", routineId)
                        .header("Authorization", bearer(tokenA)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long sessionId = ((Number) JsonPath.read(sessionBody, "$.id")).longValue();

        mvc.perform(patch("/api/sessions/{id}", sessionId)
                        .header("Authorization", bearer(tokenB))
                        .contentType("application/json")
                        .content("{\"status\":\"COMPLETED\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void profileUpdateWithInvalidPayloadReturnsValidationError() throws Exception {
        String token = TestUsers.register(mvc, "perfil@forja.com");

        mvc.perform(put("/api/me")
                        .header("Authorization", bearer(token))
                        .contentType("application/json")
                        .content("{\"name\":\"Ana\",\"sports\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields[0].field").value("sports"));
    }

    @Test
    void readinessRejectsOutOfRangeValues() throws Exception {
        String token = TestUsers.register(mvc, "readiness@forja.com");

        mvc.perform(put("/api/readiness/today")
                        .header("Authorization", bearer(token))
                        .contentType("application/json")
                        .content("{\"sleepQuality\":1,\"fatigue\":9,\"stress\":1,\"soreness\":1,\"painLevel\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields[0].field").value("fatigue"));
    }

    @Test
    void openapiSpecIsAccessible() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.info.title").value("Forja API"));
    }
}