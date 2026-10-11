package com.forja.web;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.oneOf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * [UE-66] QA — Validação dos Casos de Teste de Dificuldade (story UE-49).
 * Base isolada (db-test) populada pelo DataSeeder com os 38 exercícios curados.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql(scripts = "/cleanup.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class ExerciseDifficultyIntegrationTest {

    @Autowired
    MockMvc mvc;

    /** CT-01: cadastro válido (caminho feliz) — os 38 exercícios do seed saem classificados. */
    @Test
    void ct01_seedClassifiesAllExercisesWithValidDifficulty() throws Exception {
        String body = mvc.perform(get("/api/exercises"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(38))
                .andExpect(jsonPath("$[*].difficulty",
                        everyItem(oneOf("INICIANTE", "INTERMEDIARIO", "AVANCADO"))))
                .andExpect(jsonPath("$[*].name", everyItem(oneOf(
                        "Agachamento Búlgaro", "Salto na Caixa", "Levantamento Terra",
                        "Sprint em Ladeira", "Flexão Pliométrica", "Barra Fixa",
                        "Remada Curvada", "Desenvolvimento Militar", "Prancha com Toque no Ombro",
                        "Woodchopper com Anilha", "Afundo Lateral", "Cadeira Nórdica",
                        "Corda de Batalha", "Sombra com Halteres Leves", "Deslocamento Lateral com Faixa",
                        "Isometria Cervical com Harness", "Soco no Landmine",
                        "Condicionamento de Boxe em Rounds 3:1", "Sombra de Boxe com Elástico",
                        "Pegada de Kimono — Retenção de Lapela e Manga", "Sprawl Reativo e Defesa de Queda",
                        "Ponte Isométrica de Quadril para Grappling", "Levantada Técnica de Jiu-Jitsu",
                        "Skip A — Técnica de Passada", "Dribbling de Corrida",
                        "Pogos Bilaterais de Baixa Amplitude",
                        "Arremesso de Med Ball no Padrão do Saque", "Split Step Reativo",
                        "Deslocamento em Oito na Quadra", "Extensão Excêntrica de Punho",
                        "Rotação Externa de Ombro com Faixa",
                        "Salto Lateral Skater", "Arremesso Rotacional de Med Ball",
                        "Mobilidade de Quadril 90/90", "Ponte de Glúteo Unilateral",
                        "Burpee com Salto", "Panturrilha em Pé", "Puxada na Toalha"))))
                .andReturn().getResponse().getContentAsString();

        assertThat((List<?>) JsonPath.read(body, "$[?(@.difficulty == 'INICIANTE')].name")).hasSize(22);
        assertThat((List<?>) JsonPath.read(body, "$[?(@.difficulty == 'INTERMEDIARIO')].name")).hasSize(14);
        assertThat((List<?>) JsonPath.read(body, "$[?(@.difficulty == 'AVANCADO')].name")).hasSize(2);
    }

    /** UE-55: pelo menos cinco exercícios específicos de tênis e cobertura dos padrões pedidos. */
    @Test
    void ue55_tennisSpecificExercisesCoverAcceptanceCriteria() throws Exception {
        String body = mvc.perform(get("/api/exercises").param("category", "ESPECIFICO"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(18))
                .andReturn().getResponse().getContentAsString();

        List<Map<String, Object>> specific = JsonPath.read(body, "$[*]");
        List<String> requiredNames = List.of(
                "Arremesso de Med Ball no Padrão do Saque",
                "Split Step Reativo",
                "Deslocamento em Oito na Quadra",
                "Extensão Excêntrica de Punho",
                "Rotação Externa de Ombro com Faixa");

        assertThat(specific).extracting(exercise -> exercise.get("name")).containsAll(requiredNames);

        for (Map<String, Object> exercise : specific) {
            if (!requiredNames.contains(exercise.get("name"))) continue;

            mvc.perform(get("/api/exercises/{id}", exercise.get("id")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.category").value("ESPECIFICO"))
                    .andExpect(jsonPath("$.links[*].sportCode", hasItem("tenis")));
        }
    }

    /** UE-56: cada modalidade de combate tem ao menos quatro exercícios ESPECIFICO ligados ao esporte. */
    @Test
    void ue56_boxingAndJiuJitsuSpecificExercisesCoverAcceptanceCriteria() throws Exception {
        String body = mvc.perform(get("/api/exercises").param("category", "ESPECIFICO"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(18))
                .andReturn().getResponse().getContentAsString();

        List<Map<String, Object>> specific = JsonPath.read(body, "$[*]");
        Map<String, String> requiredSportByName = Map.of(
                "Isometria Cervical com Harness", "boxe",
                "Soco no Landmine", "boxe",
                "Condicionamento de Boxe em Rounds 3:1", "boxe",
                "Sombra de Boxe com Elástico", "boxe",
                "Pegada de Kimono — Retenção de Lapela e Manga", "jiu-jitsu",
                "Sprawl Reativo e Defesa de Queda", "jiu-jitsu",
                "Ponte Isométrica de Quadril para Grappling", "jiu-jitsu",
                "Levantada Técnica de Jiu-Jitsu", "jiu-jitsu");

        assertThat(specific).extracting(exercise -> exercise.get("name"))
                .containsAll(requiredSportByName.keySet());

        for (Map<String, Object> exercise : specific) {
            String sportCode = requiredSportByName.get(exercise.get("name"));
            if (sportCode == null) continue;

            mvc.perform(get("/api/exercises/{id}", exercise.get("id")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.category").value("ESPECIFICO"))
                    .andExpect(jsonPath("$.links[*].sportCode", hasItem(sportCode)));
        }
    }

    /** UE-57: os três drills de corrida estão no catálogo específico e vinculados à modalidade. */
    @Test
    void ue57_runningTechniqueDrillsAreSpecificAndLinkedToRunning() throws Exception {
        String body = mvc.perform(get("/api/exercises").param("category", "ESPECIFICO"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(18))
                .andReturn().getResponse().getContentAsString();

        List<Map<String, Object>> specific = JsonPath.read(body, "$[*]");
        List<String> runningDrills = List.of(
                "Skip A — Técnica de Passada",
                "Dribbling de Corrida",
                "Pogos Bilaterais de Baixa Amplitude");

        assertThat(specific).extracting(exercise -> exercise.get("name")).containsAll(runningDrills);

        for (Map<String, Object> exercise : specific) {
            if (!runningDrills.contains(exercise.get("name"))) continue;

            mvc.perform(get("/api/exercises/{id}", exercise.get("id")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.category").value("ESPECIFICO"))
                    .andExpect(jsonPath("$.links[*].sportCode", hasItem("corrida")));
        }
    }

    /** CT-02: validação de campo obrigatório — valor inválido de dificuldade é bloqueado com 400. */
    @Test
    void ct02_invalidDifficultyIsRejectedWithContractError() throws Exception {
        mvc.perform(get("/api/exercises").param("difficulty", "XPTO"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.traceId").isNotEmpty());
    }

    /** CT-03: consistência do valor exposto — detalhe do exercício devolve a mesma dificuldade do catálogo. */
    @Test
    void ct03_detailMatchesCatalogDifficulty() throws Exception {
        String avancados = mvc.perform(get("/api/exercises").param("difficulty", "AVANCADO"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        int id = JsonPath.read(avancados, "$[0].id");
        String expected = JsonPath.read(avancados, "$[0].difficulty");

        mvc.perform(get("/api/exercises/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.difficulty").value(expected));
    }

    /** CT-04: filtro no catálogo — GET /api/exercises?difficulty=X retorna apenas o nível pedido. */
    @Test
    void ct04_filterByDifficultyReturnsOnlyMatches() throws Exception {
        mvc.perform(get("/api/exercises").param("difficulty", "AVANCADO"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[*].name", everyItem(oneOf("Levantamento Terra", "Cadeira Nórdica"))))
                .andExpect(jsonPath("$[*].difficulty", everyItem(oneOf("AVANCADO"))));

        mvc.perform(get("/api/exercises").param("difficulty", "INICIANTE")
                        .param("category", "FORCA"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[*].difficulty", everyItem(oneOf("INICIANTE"))));

        mvc.perform(get("/api/exercises").param("difficulty", "INTERMEDIARIO")
                        .param("q", "terra"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        mvc.perform(get("/api/exercises"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(38));
    }
}
