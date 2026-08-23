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

import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * [UE-42] Progresso: histórico paginado, resumo semanal e tendência de prontidão.
 * Cobre autenticação, isolamento por usuário (IDOR), paginação/limites, contrato
 * de erro com traceId e agregações sobre dados reais semeados via API pública.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql(scripts = "/cleanup.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class ProgressControllerIntegrationTest {

    @Autowired
    MockMvc mvc;

    private String bearer(String token) {
        return "Bearer " + token;
    }

    /** O gerador pondera exercícios pelos esportes do perfil; sem esportes a rotina sai vazia. */
    private void saveProfile(String token) throws Exception {
        mvc.perform(put("/api/me")
                        .header("Authorization", bearer(token))
                        .contentType("application/json")
                        .content("{\"name\":\"Atleta\",\"sports\":[{\"code\":\"futebol\"}]}"))
                .andExpect(status().isOk());
    }

    /** Sessão concluída via fluxo público: perfil -> gerar rotina -> criar sessão -> preencher item -> concluir. */
    private long seedCompletedSession(String token, double loadKg, int sets, int rpe,
                                      int painLevel, int durationMinutes) throws Exception {
        saveProfile(token);
        String routine = mvc.perform(post("/api/routines/generate")
                        .header("Authorization", bearer(token))
                        .contentType("application/json").content("{\"sportId\":1}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        Number routineId = JsonPath.read(routine, "$.id");

        String session = mvc.perform(post("/api/routines/" + routineId.intValue() + "/sessions")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        Number sessionId = JsonPath.read(session, "$.id");
        Number exerciseId = JsonPath.read(session, "$.items[0].exerciseId");

        mvc.perform(patch("/api/sessions/" + sessionId.intValue() + "/items/" + exerciseId.intValue())
                        .header("Authorization", bearer(token))
                        .contentType("application/json")
                        .content("{\"completedSets\":%d,\"loadKg\":%s,\"itemRpe\":%d,\"painLevel\":%d}"
                                .formatted(sets, loadKg, rpe, painLevel)))
                .andExpect(status().isOk());
        mvc.perform(post("/api/sessions/" + sessionId.intValue() + "/start")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk());
        mvc.perform(patch("/api/sessions/" + sessionId.intValue())
                        .header("Authorization", bearer(token))
                        .contentType("application/json")
                        .content("{\"status\":\"COMPLETED\",\"durationMinutes\":%d,\"sessionRpe\":%d}"
                                .formatted(durationMinutes, rpe)))
                .andExpect(status().isOk());
        return sessionId.longValue();
    }

    private void saveReadiness(String token, int sleepQuality, int fatigue, int stress, int soreness) throws Exception {
        mvc.perform(put("/api/readiness/today")
                        .header("Authorization", bearer(token))
                        .contentType("application/json")
                        .content("{\"sleepQuality\":%d,\"fatigue\":%d,\"stress\":%d,\"soreness\":%d,\"painLevel\":0}"
                                .formatted(sleepQuality, fatigue, stress, soreness)))
                .andExpect(status().isOk());
    }

    @Test
    void unauthenticatedIsRejectedWithTraceId() throws Exception {
        mvc.perform(get("/api/progress/sessions"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.traceId").isNotEmpty());
    }

    @Test
    void userSeesOnlyOwnSessionsAndCannotTouchOthers() throws Exception {
        String tokenA = TestUsers.register(mvc, "progress-a@forja.com");
        long sessionA = seedCompletedSession(tokenA, 50.5, 3, 8, 2, 58);
        seedCompletedSession(tokenA, 40, 2, 6, 0, 42);

        String tokenB = TestUsers.register(mvc, "progress-b@forja.com");

        // Isolamento: B não vê nada de A.
        mvc.perform(get("/api/progress/sessions").header("Authorization", bearer(tokenB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(0))
                .andExpect(jsonPath("$.items.length()").value(0));

        // A vê somente as próprias sessões.
        mvc.perform(get("/api/progress/sessions").header("Authorization", bearer(tokenA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(2));

        // IDOR: B não consegue alterar a sessão de A.
        mvc.perform(patch("/api/sessions/" + sessionA)
                        .header("Authorization", bearer(tokenB))
                        .contentType("application/json").content("{\"status\":\"SKIPPED\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void paginationRespectsPageAndSizeLimits() throws Exception {
        String token = TestUsers.register(mvc, "progress-page@forja.com");
        for (int i = 0; i < 3; i++) {
            seedCompletedSession(token, 30 + i, 2, 7, 0, 30);
        }

        mvc.perform(get("/api/progress/sessions")
                        .param("page", "0").param("size", "2")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.totalItems").value(3))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.hasNext").value(true));

        mvc.perform(get("/api/progress/sessions")
                        .param("page", "1").param("size", "2")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.hasNext").value(false));
    }

    @Test
    void invalidParametersFollowErrorContract() throws Exception {
        String token = TestUsers.register(mvc, "progress-invalid@forja.com");

        mvc.perform(get("/api/progress/sessions").param("size", "51")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));

        mvc.perform(get("/api/progress/sessions").param("page", "-1")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));

        // Data fora do formato ISO cai no contrato ErrorResponse com traceId.
        mvc.perform(get("/api/progress/sessions").param("from", "banana")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.traceId").isNotEmpty());

        mvc.perform(get("/api/progress/sessions")
                        .param("from", "2026-08-20").param("to", "2026-08-01")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest());

        mvc.perform(get("/api/progress/readiness-trend").param("days", "6")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest());

        mvc.perform(get("/api/progress/readiness-trend").param("days", "91")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void dateWindowFiltersSessions() throws Exception {
        String token = TestUsers.register(mvc, "progress-window@forja.com");
        seedCompletedSession(token, 30, 2, 7, 0, 30);
        var today = LocalDate.now();

        mvc.perform(get("/api/progress/sessions")
                        .param("from", today.toString()).param("to", today.toString())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1));

        mvc.perform(get("/api/progress/sessions")
                        .param("from", today.plusDays(1).toString())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(0));
    }

    @Test
    void weeklySummaryAggregatesRealData() throws Exception {
        String token = TestUsers.register(mvc, "progress-week@forja.com");
        seedCompletedSession(token, 100, 3, 8, 1, 58); // volume 300
        seedCompletedSession(token, 50, 2, 6, 0, 42);  // volume 100
        saveReadiness(token, 5, 1, 1, 1);              // score 30

        mvc.perform(get("/api/progress/weekly-summary").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.periodStart").isNotEmpty())
                .andExpect(jsonPath("$.periodEnd").isNotEmpty())
                .andExpect(jsonPath("$.current.sessionsCompleted").value(2))
                .andExpect(jsonPath("$.current.totalDurationMinutes").value(100))
                .andExpect(jsonPath("$.current.totalVolumeKg").value(400.0))
                .andExpect(jsonPath("$.current.averageRpe").value(7.0))
                .andExpect(jsonPath("$.current.averageReadiness").value(30.0))
                .andExpect(jsonPath("$.previous.sessionsCompleted").value(0))
                .andExpect(jsonPath("$.previous.averageRpe").doesNotExist());
    }

    @Test
    void readinessTrendReturnsOnlyCheckedDaysAscending() throws Exception {
        String token = TestUsers.register(mvc, "progress-trend@forja.com");
        saveReadiness(token, 4, 2, 2, 2); // score 8+8+4+4 = 24

        mvc.perform(get("/api/progress/readiness-trend").param("days", "30")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.periodDays").value(30))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].readiness").value(24));

        // Sem check-ins: lista vazia válida.
        String other = TestUsers.register(mvc, "progress-trend-empty@forja.com");
        mvc.perform(get("/api/progress/readiness-trend").header("Authorization", bearer(other)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(0));
    }

    @Test
    void emptyHistoryReturnsValidEmptyPage() throws Exception {
        String token = TestUsers.register(mvc, "progress-empty@forja.com");
        mvc.perform(get("/api/progress/sessions").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(0))
                .andExpect(jsonPath("$.totalPages").value(0))
                .andExpect(jsonPath("$.hasNext").value(false));

        mvc.perform(get("/api/progress/weekly-summary").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current.sessionsCompleted").value(0))
                .andExpect(jsonPath("$.current.averageReadiness").doesNotExist());
    }
}
