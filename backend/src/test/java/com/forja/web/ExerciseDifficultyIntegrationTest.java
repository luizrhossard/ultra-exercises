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

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.oneOf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * [UE-66] QA — Validação dos Casos de Teste de Dificuldade (story UE-49).
 * Base isolada (db-test) populada pelo DataSeeder com os 30 exercícios curados.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql(scripts = "/cleanup.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class ExerciseDifficultyIntegrationTest {

    @Autowired
    MockMvc mvc;

    /** CT-01: cadastro válido (caminho feliz) — os 30 exercícios do seed saem classificados. */
    @Test
    void ct01_seedClassifiesAllExercisesWithValidDifficulty() throws Exception {
        String body = mvc.perform(get("/api/exercises"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(30))
                .andExpect(jsonPath("$[*].difficulty",
                        everyItem(oneOf("INICIANTE", "INTERMEDIARIO", "AVANCADO"))))
                .andExpect(jsonPath("$[*].name", everyItem(oneOf(
                        "Agachamento Búlgaro", "Salto na Caixa", "Levantamento Terra",
                        "Sprint em Ladeira", "Flexão Pliométrica", "Barra Fixa",
                        "Remada Curvada", "Desenvolvimento Militar", "Prancha com Toque no Ombro",
                        "Woodchopper com Anilha", "Afundo Lateral", "Cadeira Nórdica",
                        "Corda de Batalha", "Sombra com Halteres Leves", "Deslocamento Lateral com Faixa",
                        "Salto Lateral Skater", "Arremesso Rotacional de Med Ball",
                        "Mobilidade de Quadril 90/90", "Ponte de Glúteo Unilateral",
                        "Burpee com Salto", "Panturrilha em Pé", "Puxada na Toalha",
                        // [UE-51] Natação
                        "Rotação Externa de Ombro com Elástico", "Rotação Interna de Ombro com Elástico",
                        "Puxada de Braçada com Elástico", "Nado com Paraquedas de Resistência",
                        "Nado com Pull Buoy e Palmar", "Prancha Streamline com Rotação",
                        "Mobilidade de Ombro com Bastão", "Mobilidade de Tornozelo em Flexão Plantar"))))
                .andReturn().getResponse().getContentAsString();

        assertThat((List<?>) JsonPath.read(body, "$[?(@.difficulty == 'INICIANTE')].name")).hasSize(16);
        assertThat((List<?>) JsonPath.read(body, "$[?(@.difficulty == 'INTERMEDIARIO')].name")).hasSize(12);
        assertThat((List<?>) JsonPath.read(body, "$[?(@.difficulty == 'AVANCADO')].name")).hasSize(2);
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
                .andExpect(jsonPath("$.length()").value(30));
    }
}
