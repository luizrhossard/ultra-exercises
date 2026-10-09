package com.forja.web;

import com.forja.TestUsers;
import com.forja.domain.ExerciseCategory;
import com.forja.domain.ExerciseDifficulty;
import com.forja.domain.ExerciseSport;
import com.forja.repository.ExerciseRepository;
import com.forja.repository.ExerciseSportRepository;
import com.forja.repository.SportRepository;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** [UE-51] Natação — catálogo específico (manguito, braçada, core, mobilidade, pull buoy). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql(scripts = "/cleanup.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class NatacaoCatalogIntegrationTest {

    /** Exercícios novos da UE-51: nome → (categoria, dificuldade, score mínimo em natação). */
    record Expected(ExerciseCategory category, ExerciseDifficulty difficulty, int minScore) {
    }

    static final Map<String, Expected> NEW_EXERCISES = Map.of(
            "Rotação Externa de Ombro com Elástico", new Expected(ExerciseCategory.ESPECIFICO, ExerciseDifficulty.INICIANTE, 5),
            "Rotação Interna de Ombro com Elástico", new Expected(ExerciseCategory.ESPECIFICO, ExerciseDifficulty.INICIANTE, 4),
            "Puxada de Braçada com Elástico", new Expected(ExerciseCategory.ESPECIFICO, ExerciseDifficulty.INTERMEDIARIO, 5),
            "Nado com Paraquedas de Resistência", new Expected(ExerciseCategory.ESPECIFICO, ExerciseDifficulty.INTERMEDIARIO, 5),
            "Nado com Pull Buoy e Palmar", new Expected(ExerciseCategory.ESPECIFICO, ExerciseDifficulty.INTERMEDIARIO, 5),
            "Prancha Streamline com Rotação", new Expected(ExerciseCategory.CORE, ExerciseDifficulty.INTERMEDIARIO, 5),
            "Mobilidade de Ombro com Bastão", new Expected(ExerciseCategory.MOBILIDADE, ExerciseDifficulty.INICIANTE, 5),
            "Mobilidade de Tornozelo em Flexão Plantar", new Expected(ExerciseCategory.MOBILIDADE, ExerciseDifficulty.INICIANTE, 4));

    static final Set<String> SHOULDER_PREVENTION = Set.of(
            "Rotação Externa de Ombro com Elástico", "Rotação Interna de Ombro com Elástico");

    @Autowired MockMvc mvc;
    @Autowired SportRepository sports;
    @Autowired ExerciseRepository exercises;
    @Autowired ExerciseSportRepository links;

    long natacaoId;

    @BeforeEach
    void setUp() {
        natacaoId = sports.findByCode("natacao").orElseThrow().getId();
    }

    private List<ExerciseSport> natacaoLinks() {
        return links.findBySportIdIn(List.of(natacaoId));
    }

    @Test
    @Transactional
    void newExercisesExistWithCategoryDifficultyAndInstructions() {
        NEW_EXERCISES.forEach((name, exp) -> {
            var ex = exercises.findByName(name).orElseThrow(() -> new AssertionError("Ausente: " + name));
            assertThat(ex.getCategory()).as(name).isEqualTo(exp.category());
            assertThat(ex.getDifficulty()).as(name).isEqualTo(exp.difficulty());
            assertThat(ex.getSteps()).as(name).hasSizeGreaterThanOrEqualTo(3).allMatch(s -> !s.isBlank());
            assertThat(ex.getEquipment()).as(name).isNotBlank();
            assertThat(ex.getMuscleGroups()).as(name).isNotEmpty();
        });
    }

    @Test
    void newExercisesAreLinkedToNatacaoWithCoherentRelevanceAndRationale() {
        var byName = natacaoLinks().stream()
                .collect(java.util.stream.Collectors.toMap(l -> l.getExercise().getName(), l -> l));

        NEW_EXERCISES.forEach((name, exp) -> {
            var link = byName.get(name);
            assertThat(link).as("vínculo natação: " + name).isNotNull();
            assertThat(link.getRelevanceScore()).as(name).isBetween(exp.minScore(), 5);
            assertThat(link.getRationale()).as(name).isNotBlank();
        });
    }

    @Test
    void natacaoMeetsMinimumCoverage() {
        var all = natacaoLinks();
        assertThat(all).hasSizeGreaterThanOrEqualTo(12);
        assertThat(all.stream().filter(l -> l.getExercise().getCategory() == ExerciseCategory.ESPECIFICO))
                .hasSizeGreaterThanOrEqualTo(5);
        assertThat(all.stream().map(l -> l.getExercise().getCategory()).distinct())
                .contains(ExerciseCategory.ESPECIFICO, ExerciseCategory.CORE, ExerciseCategory.MOBILIDADE,
                        ExerciseCategory.FORCA);
    }

    @Test
    @Transactional
    void shoulderPreventionIsCovered() {
        var prevention = natacaoLinks().stream()
                .filter(l -> SHOULDER_PREVENTION.contains(l.getExercise().getName()))
                .toList();
        assertThat(prevention).hasSizeGreaterThanOrEqualTo(2)
                .allMatch(l -> l.getRelevanceScore() >= 4)
                .allMatch(l -> l.getExercise().getMuscleGroups().contains("manguito rotador"))
                .allMatch(l -> l.getRationale().toLowerCase().contains("ombro de nadador"));
    }

    @Test
    void feedFindsNewExercisesForNatacao() throws Exception {
        String body = mvc.perform(get("/api/exercises/feed").param("sportIds", String.valueOf(natacaoId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        List<String> names = JsonPath.read(body, "$[*].name");
        assertThat(names).containsAll(NEW_EXERCISES.keySet()).hasSizeGreaterThanOrEqualTo(12);

        String especifico = mvc.perform(get("/api/exercises/feed")
                        .param("sportIds", String.valueOf(natacaoId))
                        .param("category", "ESPECIFICO"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat((List<?>) JsonPath.read(especifico, "$[*].name")).hasSizeGreaterThanOrEqualTo(5);
    }

    @Test
    void generatorPicksSwimmingSpecificExercises() throws Exception {
        String token = TestUsers.register(mvc, "nadador@forja.com");
        mvc.perform(put("/api/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content("{\"name\":\"Nadador\",\"sports\":[{\"code\":\"natacao\"}]}"))
                .andExpect(status().isOk());

        String routine = mvc.perform(post("/api/routines/generate")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content("{\"sportId\":" + natacaoId + "}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

        List<Number> ids = JsonPath.read(routine, "$.items[*].exerciseId");
        var newIds = NEW_EXERCISES.keySet().stream()
                .map(n -> exercises.findByName(n).orElseThrow().getId())
                .toList();
        assertThat(ids.stream().map(Number::longValue).filter(newIds::contains))
                .as("gerador deve escolher exercícios específicos de natação")
                .hasSizeGreaterThanOrEqualTo(2);
    }
}
