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

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** [UE-28 · onda 1] Alertas de descanso: frequência semanal, descanso por grupo
 *  muscular e configurações de sensibilidade. Push/e-mail ficam para a onda 2. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql(scripts = "/cleanup.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class AlertsFlowIntegrationTest {

    @Autowired
    MockMvc mvc;

    private String bearer(String token) {
        return "Bearer " + token;
    }

    /** Duas sessões concluídas hoje contendo o exercício 5 do catálogo (peitoral). */
    private void seedTwoChestSessionsToday(String token) throws Exception {
        mvc.perform(put("/api/me")
                        .header("Authorization", bearer(token))
                        .contentType("application/json")
                        .content("{\"name\":\"Atleta\",\"sports\":[{\"code\":\"futebol\"}]}"))
                .andExpect(status().isOk());
        for (int n = 0; n < 2; n++) {
            String routine = mvc.perform(post("/api/routines/generate")
                            .header("Authorization", bearer(token))
                            .contentType("application/json").content("{\"sportId\":1}"))
                    .andExpect(status().isCreated())
                    .andReturn().getResponse().getContentAsString();
            Number routineId = JsonPath.read(routine, "$.id");
            mvc.perform(post("/api/routines/" + routineId.intValue() + "/items")
                            .header("Authorization", bearer(token))
                            .contentType("application/json")
                            .content("{\"exerciseId\":5}"))
                    .andExpect(status().isOk());
            String session = mvc.perform(post("/api/routines/" + routineId.intValue() + "/sessions")
                            .header("Authorization", bearer(token)))
                    .andExpect(status().isCreated())
                    .andReturn().getResponse().getContentAsString();
            Number sessionId = JsonPath.read(session, "$.id");
            Number exerciseId = JsonPath.read(session, "$.items[0].exerciseId");
            mvc.perform(patch("/api/sessions/" + sessionId.intValue() + "/items/" + exerciseId.intValue())
                            .header("Authorization", bearer(token))
                            .contentType("application/json")
                            .content("{\"completedSets\":3,\"loadKg\":40,\"itemRpe\":7,\"painLevel\":0}"))
                    .andExpect(status().isOk());
            mvc.perform(post("/api/sessions/" + sessionId.intValue() + "/start")
                            .header("Authorization", bearer(token)))
                    .andExpect(status().isOk());
            mvc.perform(patch("/api/sessions/" + sessionId.intValue())
                            .header("Authorization", bearer(token))
                            .contentType("application/json")
                            .content("{\"status\":\"COMPLETED\",\"durationMinutes\":45,\"sessionRpe\":7}"))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void defaultSettingsAndMuscleRestAlert() throws Exception {
        String token = TestUsers.register(mvc, "alerts-a@forja.com");
        seedTwoChestSessionsToday(token);

        // Configurações padrão criadas sob demanda na primeira leitura.
        mvc.perform(get("/api/alerts/settings").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.maxSessionsPerWeek").value(5))
                .andExpect(jsonPath("$.minRestHours").value(48));

        // Mesmo dia, mesmo músculo → alerta de descanso; frequência 2 ≤ 5 → sem alerta.
        String body = mvc.perform(get("/api/alerts").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true))
                .andReturn().getResponse().getContentAsString();
        List<String> types = JsonPath.read(body, "$.alerts[*].type");
        assertThat(types).contains("MUSCLE_REST");
        assertThat(types).doesNotContain("FREQUENCY");

        // Isolamento: atleta novo não herda alertas.
        String tokenB = TestUsers.register(mvc, "alerts-b@forja.com");
        mvc.perform(get("/api/alerts").header("Authorization", bearer(tokenB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alerts.length()").value(0));
    }

    @Test
    void sensitivitySettingsDriveFrequencyAlertsAndDisable() throws Exception {
        String token = TestUsers.register(mvc, "alerts-c@forja.com");
        seedTwoChestSessionsToday(token);

        // Sensibilidade apertada: limite 1/semana → frequência dispara junto com o descanso.
        mvc.perform(put("/api/alerts/settings")
                        .header("Authorization", bearer(token))
                        .contentType("application/json")
                        .content("{\"enabled\":true,\"maxSessionsPerWeek\":1,\"minRestHours\":48}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maxSessionsPerWeek").value(1));

        String body = mvc.perform(get("/api/alerts").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<String> types = JsonPath.read(body, "$.alerts[*].type");
        assertThat(types).contains("FREQUENCY", "MUSCLE_REST");

        // Desligado: nenhum alerta, mesmo violando as regras.
        mvc.perform(put("/api/alerts/settings")
                        .header("Authorization", bearer(token))
                        .contentType("application/json")
                        .content("{\"enabled\":false,\"maxSessionsPerWeek\":1,\"minRestHours\":48}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false));
        mvc.perform(get("/api/alerts").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.alerts.length()").value(0));

        // Faixa inválida cai no contrato VALIDATION_ERROR.
        mvc.perform(put("/api/alerts/settings")
                        .header("Authorization", bearer(token))
                        .contentType("application/json")
                        .content("{\"enabled\":true,\"maxSessionsPerWeek\":20,\"minRestHours\":48}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));

        // Sem autenticação → 401.
        mvc.perform(get("/api/alerts"))
                .andExpect(status().isUnauthorized());
    }
}
