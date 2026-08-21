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

/** Testes de integração: catálogo público (sports/exercises), perfil, readiness e ciclo de treino. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql(scripts = "/cleanup.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class CatalogAndTrainingFlowIntegrationTest {

    @Autowired
    MockMvc mvc;

    private String bearer(String token) {
        return "Bearer " + token;
    }

    @Test
    void sportsReturnsSeededCatalog() throws Exception {
        mvc.perform(get("/api/sports"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(8))
                .andExpect(jsonPath("$[0].code").isNotEmpty());
    }

    @Test
    void feedReturnsRankedExercisesForSport() throws Exception {
        mvc.perform(get("/api/exercises/feed").param("sportIds", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(org.hamcrest.Matchers.greaterThan(0)))
                .andExpect(jsonPath("$[0].name").isNotEmpty())
                .andExpect(jsonPath("$[0].bestScore").isNumber());
    }

    @Test
    void feedWithUnknownSportReturnsEmptyList() throws Exception {
        mvc.perform(get("/api/exercises/feed").param("sportIds", "99999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void feedSupportsQueryAndCategoryFilters() throws Exception {
        mvc.perform(get("/api/exercises/feed")
                        .param("sportIds", "1")
                        .param("category", "FORCA"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(org.hamcrest.Matchers.greaterThan(0)))
                .andExpect(jsonPath("$[0].category").value("FORCA"));
    }

    @Test
    void exerciseDetailReturnsFullPayloadAndUnknownReturnsNotFound() throws Exception {
        mvc.perform(get("/api/exercises/{id}", 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").isNotEmpty())
                .andExpect(jsonPath("$.steps").isArray())
                .andExpect(jsonPath("$.links").isArray());

        mvc.perform(get("/api/exercises/{id}", 999999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("NOT_FOUND"));
    }

    @Test
    void profileAndReadinessHappyPath() throws Exception {
        String token = TestUsers.register(mvc, "ciclo@forja.com");

        mvc.perform(put("/api/me")
                        .header("Authorization", bearer(token))
                        .contentType("application/json")
                        .content("{\"name\":\"Ciclista\",\"sports\":[{\"code\":\"futebol\",\"level\":\"COMPETITIVE\"},{\"code\":\"boxe\"}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Ciclista"))
                .andExpect(jsonPath("$.sports.length()").value(2));

        mvc.perform(get("/api/me").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sports[0].code").value("futebol"));

        String readinessBody = mvc.perform(put("/api/readiness/today")
                        .header("Authorization", bearer(token))
                        .contentType("application/json")
                        .content("{\"sleepQuality\":4,\"fatigue\":2,\"stress\":3,\"soreness\":1,\"painArea\":\"joelho\",\"painLevel\":2,\"notes\":\"Bem dormido\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readinessScore").isNumber())
                .andReturn().getResponse().getContentAsString();
        int score = JsonPath.read(readinessBody, "$.readinessScore");

        mvc.perform(get("/api/readiness/today").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readinessScore").value(score))
                .andExpect(jsonPath("$.painArea").value("joelho"));
    }

    @Test
    void routineAndSessionLifecycle() throws Exception {
        String token = TestUsers.register(mvc, "treino@forja.com");

        mvc.perform(put("/api/me")
                        .header("Authorization", bearer(token))
                        .contentType("application/json")
                        .content("{\"name\":\"Treinador\",\"sports\":[{\"code\":\"futebol\"}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sports[0].code").value("futebol"));

        String routineBody = mvc.perform(post("/api/routines/generate")
                        .header("Authorization", bearer(token))
                        .contentType("application/json")
                        .content("{\"sportId\":1}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").isNotEmpty())
                .andExpect(jsonPath("$.items.length()").value(org.hamcrest.Matchers.greaterThan(0)))
                .andReturn().getResponse().getContentAsString();
        long routineId = ((Number) JsonPath.read(routineBody, "$.id")).longValue();
        long exerciseId = ((Number) JsonPath.read(routineBody, "$.items[0].exerciseId")).longValue();

        mvc.perform(get("/api/routines").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(routineId));

        String sessionBody = mvc.perform(post("/api/routines/{id}/sessions", routineId)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PLANNED"))
                .andReturn().getResponse().getContentAsString();
        long sessionId = ((Number) JsonPath.read(sessionBody, "$.id")).longValue();

        mvc.perform(post("/api/sessions/{id}/start", sessionId)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

        mvc.perform(patch("/api/sessions/{id}/items/{exerciseId}", sessionId, exerciseId)
                        .header("Authorization", bearer(token))
                        .contentType("application/json")
                        .content("{\"completedSets\":3,\"completedReps\":\"8 reps\",\"loadKg\":40,\"itemRpe\":7}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].completedSets").value(3));

        mvc.perform(patch("/api/sessions/{id}", sessionId)
                        .header("Authorization", bearer(token))
                        .contentType("application/json")
                        .content("{\"status\":\"COMPLETED\",\"durationMinutes\":45,\"sessionRpe\":7}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.completedAt").isNotEmpty());

        mvc.perform(get("/api/sessions").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].status").value("COMPLETED"));
    }
}