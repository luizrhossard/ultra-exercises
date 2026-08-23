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
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

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

    /** Gera uma rotina para o esporte 1 e devolve o id. */
    private long generateRoutine(String token) throws Exception {
        String routine = mvc.perform(post("/api/routines/generate")
                        .header("Authorization", bearer(token))
                        .contentType("application/json").content("{\"sportId\":1}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(routine, "$.id")).longValue();
    }

    /** Cria a sessão a partir da rotina e devolve o corpo completo (itens incluídos). */
    private String createSessionBody(String token, long routineId) throws Exception {
        return mvc.perform(post("/api/routines/" + routineId + "/sessions")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
    }

    /** Registra o item, inicia e conclui a sessão. */
    private void completeSession(String token, Number sessionId, Number exerciseId,
                                 double loadKg, int sets, int rpe, int painLevel,
                                 int durationMinutes) throws Exception {
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
    }

    /** Sessão concluída via fluxo público: perfil -> gerar rotina -> criar sessão -> preencher item -> concluir. */
    private long seedCompletedSession(String token, double loadKg, int sets, int rpe,
                                      int painLevel, int durationMinutes) throws Exception {
        saveProfile(token);
        String session = createSessionBody(token, generateRoutine(token));
        Number sessionId = JsonPath.read(session, "$.id");
        Number exerciseId = JsonPath.read(session, "$.items[0].exerciseId");
        completeSession(token, sessionId, exerciseId, loadKg, sets, rpe, painLevel, durationMinutes);
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

    @Test
    void advancedFiltersNarrowTheHistory() throws Exception {
        String token = TestUsers.register(mvc, "progress-adv@forja.com");
        saveProfile(token);

        String body1 = createSessionBody(token, generateRoutine(token));
        Number id1 = JsonPath.read(body1, "$.id");
        Set<Long> ex1 = new HashSet<>();
        Map<Long, String> names = new HashMap<>();
        for (Object o : (List<?>) JsonPath.read(body1, "$.items[*]")) {
            Map<?, ?> it = (Map<?, ?>) o;
            long eid = ((Number) it.get("exerciseId")).longValue();
            ex1.add(eid);
            names.put(eid, (String) it.get("exerciseName"));
        }
        completeSession(token, id1, ex1.iterator().next(), 100, 3, 8, 1, 58);

        String body2 = createSessionBody(token, generateRoutine(token));
        Number id2 = JsonPath.read(body2, "$.id");
        Set<Long> ex2 = new HashSet<>();
        for (Object o : (List<?>) JsonPath.read(body2, "$.items[*]")) {
            Map<?, ?> it = (Map<?, ?>) o;
            long eid = ((Number) it.get("exerciseId")).longValue();
            ex2.add(eid);
            names.put(eid, (String) it.get("exerciseName"));
        }
        completeSession(token, id2, ex2.iterator().next(), 50, 2, 6, 0, 42);

        // Filtro por exercício: esperado calculado a partir dos conjuntos capturados.
        long target = ex1.iterator().next();
        int expectedForTarget = (ex1.contains(target) ? 1 : 0) + (ex2.contains(target) ? 1 : 0);
        mvc.perform(get("/api/progress/sessions").param("exerciseId", String.valueOf(target))
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(expectedForTarget));
        mvc.perform(get("/api/progress/sessions").param("exerciseId", "999999")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(0));

        // Busca textual por nome de exercício e por termo inexistente.
        String targetName = names.get(target);
        mvc.perform(get("/api/progress/sessions").param("q", targetName)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(expectedForTarget));
        mvc.perform(get("/api/progress/sessions").param("q", "zzz-inexistente")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(0));

        // Intensidade por faixa de RPE: sessão 1 = 8 (ALTA), sessão 2 = 6 (MODERADA).
        mvc.perform(get("/api/progress/sessions").param("intensity", "ALTA")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1));
        mvc.perform(get("/api/progress/sessions").param("intensity", "moderada")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1));
        mvc.perform(get("/api/progress/sessions").param("intensity", "LEVE")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(0));

        // Grupo muscular: músculo do exercício alvo; esperado = sessões com qualquer
        // exercício que contenha esse músculo (calculado via detalhe público).
        String muscle = musclesOf(target).get(0);
        int expectedMuscle = (sessionHasMuscle(ex1, muscle) ? 1 : 0)
                + (sessionHasMuscle(ex2, muscle) ? 1 : 0);
        mvc.perform(get("/api/progress/sessions").param("muscle", muscle)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(expectedMuscle));

        // Combinação de filtros: ALTA (só sessão 1) + músculo.
        mvc.perform(get("/api/progress/sessions")
                        .param("intensity", "ALTA").param("muscle", muscle)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(sessionHasMuscle(ex1, muscle) ? 1 : 0));
    }

    /** Músculos do exercício via endpoint público de detalhe. */
    private List<String> musclesOf(long exerciseId) throws Exception {
        return JsonPath.read(mvc.perform(get("/api/exercises/{id}", exerciseId))
                .andReturn().getResponse().getContentAsString(), "$.muscles[*]");
    }

    /** true se qualquer exercício das sessões indicadas contém o músculo informado. */
    private boolean sessionHasMuscle(Set<Long> exerciseIds, String muscle) throws Exception {
        for (long eid : exerciseIds) {
            for (Object m : musclesOf(eid)) {
                if (((String) m).equalsIgnoreCase(muscle)) return true;
            }
        }
        return false;
    }

    @Test
    void historyExercisesListsDistinctTrainedExercises() throws Exception {
        String tokenA = TestUsers.register(mvc, "progress-hx@forja.com");
        seedCompletedSession(tokenA, 40, 2, 7, 0, 30);
        seedCompletedSession(tokenA, 45, 3, 7, 0, 35);

        mvc.perform(get("/api/progress/history-exercises").header("Authorization", bearer(tokenA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$[0].id").isNumber())
                .andExpect(jsonPath("$[0].name").isNotEmpty());

        // Isolamento: usuário sem histórico recebe lista vazia.
        String tokenB = TestUsers.register(mvc, "progress-hx-empty@forja.com");
        mvc.perform(get("/api/progress/history-exercises").header("Authorization", bearer(tokenB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        mvc.perform(get("/api/progress/history-exercises"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void historyStatsAggregatesPeriod() throws Exception {
        String token = TestUsers.register(mvc, "progress-stats@forja.com");
        seedCompletedSession(token, 100, 3, 8, 1, 58); // volume 300
        seedCompletedSession(token, 50, 2, 6, 0, 42);  // volume 100
        createSessionBody(token, generateRoutine(token)); // PLANNED extra

        var today = LocalDate.now();
        mvc.perform(get("/api/progress/history-stats")
                        .param("from", today.toString()).param("to", today.toString())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSessions").value(3))
                .andExpect(jsonPath("$.completedSessions").value(2))
                .andExpect(jsonPath("$.totalDurationMinutes").value(100))
                .andExpect(jsonPath("$.totalVolumeKg").value(400.0))
                .andExpect(jsonPath("$.averageRpe").value(7.0));

        mvc.perform(get("/api/progress/history-stats")
                        .param("from", "2020-01-01").param("to", "2020-01-31")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSessions").value(0))
                .andExpect(jsonPath("$.completedSessions").value(0))
                .andExpect(jsonPath("$.averageRpe").doesNotExist());

        mvc.perform(get("/api/progress/history-stats")
                        .param("from", "2024-01-01").param("to", "2030-12-31")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void invalidFilterParamsFollowErrorContract() throws Exception {
        String token = TestUsers.register(mvc, "progress-filter-invalid@forja.com");

        mvc.perform(get("/api/progress/sessions").param("intensity", "FORTE")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));

        mvc.perform(get("/api/progress/sessions").param("q", "x".repeat(81))
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));

        mvc.perform(get("/api/progress/sessions").param("exerciseId", "-1")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    @Test
    void exerciseEvolutionMergesSameDayMaxLoads() throws Exception {
        String token = TestUsers.register(mvc, "progress-evo@forja.com");
        saveProfile(token);

        String body1 = createSessionBody(token, generateRoutine(token));
        Number id1 = JsonPath.read(body1, "$.id");
        long target = ((Number) ((List<?>) JsonPath.read(body1, "$.items[*].exerciseId")).get(0)).longValue();
        completeSession(token, id1, target, 50, 3, 8, 0, 40);

        // Sessão 2 garantindo o mesmo exercício via item adicional na rotina.
        long rid2 = generateRoutine(token);
        mvc.perform(post("/api/routines/" + rid2 + "/items")
                        .header("Authorization", bearer(token))
                        .contentType("application/json")
                        .content("{\"exerciseId\":" + target + "}"))
                .andExpect(status().isOk());
        String body2 = createSessionBody(token, rid2);
        Number id2 = JsonPath.read(body2, "$.id");
        completeSession(token, id2, target, 60, 3, 8, 0, 45);

        mvc.perform(get("/api/progress/exercise-evolution")
                        .param("exerciseId", String.valueOf(target))
                        .param("months", "6")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.exerciseId").value((int) target))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].maxLoadKg").value(60.0));

        mvc.perform(get("/api/progress/exercise-evolution")
                        .param("exerciseId", "999999")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(0));

        mvc.perform(get("/api/progress/exercise-evolution")
                        .param("exerciseId", String.valueOf(target))
                        .param("months", "13")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void volumeTrendBucketsCompletedSessions() throws Exception {
        String token = TestUsers.register(mvc, "progress-vol@forja.com");
        seedCompletedSession(token, 100, 3, 8, 0, 50); // volume 300
        seedCompletedSession(token, 50, 2, 6, 0, 30);  // volume 100

        var expectedWeekStart = LocalDate.now().with(java.time.DayOfWeek.MONDAY).toString();
        mvc.perform(get("/api/progress/volume-trend")
                        .param("granularity", "week").param("months", "3")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.granularity").value("week"))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].periodStart").value(expectedWeekStart))
                .andExpect(jsonPath("$.items[0].totalVolumeKg").value(400.0));

        var expectedMonthStart = LocalDate.now().withDayOfMonth(1).toString();
        mvc.perform(get("/api/progress/volume-trend")
                        .param("granularity", "month").param("months", "6")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].periodStart").value(expectedMonthStart))
                .andExpect(jsonPath("$.items[0].totalVolumeKg").value(400.0));

        mvc.perform(get("/api/progress/volume-trend")
                        .param("granularity", "bimestral")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    @Test
    void performanceComparisonComparesWindows() throws Exception {
        String token = TestUsers.register(mvc, "progress-cmp@forja.com");
        seedCompletedSession(token, 100, 3, 8, 0, 58); // volume 300
        seedCompletedSession(token, 50, 2, 6, 0, 42);  // volume 100

        mvc.perform(get("/api/progress/performance-comparison")
                        .param("days", "30")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days").value(30))
                .andExpect(jsonPath("$.current.sessionsCompleted").value(2))
                .andExpect(jsonPath("$.current.totalDurationMinutes").value(100))
                .andExpect(jsonPath("$.current.totalVolumeKg").value(400.0))
                .andExpect(jsonPath("$.current.averageRpe").value(7.0))
                .andExpect(jsonPath("$.previous.sessionsCompleted").value(0))
                .andExpect(jsonPath("$.previous.averageRpe").doesNotExist());

        mvc.perform(get("/api/progress/performance-comparison")
                        .param("days", "5")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest());
    }
}
