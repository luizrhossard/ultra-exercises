package com.forja.web;

import com.forja.TestUsers;
import com.forja.domain.Exercise;
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

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * [UE-52] Vôlei — exercícios específicos de aterrissagem, ataque, bloqueio, ombro de ataque
 * e reatividade. Regras de catálogo em docs/features/catalogo-volei.md.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql(scripts = "/cleanup.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class VoleiCatalogIntegrationTest {

    static final String LANDING = "Aterrissagem Silenciosa de Salto";
    static final String ATTACK = "Passada de Aproximação de Ataque";
    static final String BLOCK_LATERAL = "Deslocamento Lateral com Salto de Bloqueio";
    static final String BLOCK_JUMP = "Impulsão Vertical com Alcance de Bloqueio";
    static final String SHOULDER_YTW = "Elevação em Y-T-W com Elástico";
    static final String SHOULDER_EXT = "Rotação Externa de Ombro com Elástico";
    static final String SHOULDER_INT = "Rotação Interna de Ombro com Elástico";
    static final String REACTIVE = "Saltos Reativos de Contato Curto";

    /** Exercícios novos da UE-52: nome → categoria e dificuldade esperadas. */
    static final Map<String, Object[]> NEW_EXERCISES = Map.of(
            LANDING, new Object[]{ExerciseCategory.ESPECIFICO, ExerciseDifficulty.INICIANTE},
            ATTACK, new Object[]{ExerciseCategory.ESPECIFICO, ExerciseDifficulty.INTERMEDIARIO},
            BLOCK_LATERAL, new Object[]{ExerciseCategory.ESPECIFICO, ExerciseDifficulty.INTERMEDIARIO},
            BLOCK_JUMP, new Object[]{ExerciseCategory.PLIOMETRIA, ExerciseDifficulty.INTERMEDIARIO},
            SHOULDER_YTW, new Object[]{ExerciseCategory.ESPECIFICO, ExerciseDifficulty.INICIANTE},
            REACTIVE, new Object[]{ExerciseCategory.PLIOMETRIA, ExerciseDifficulty.INTERMEDIARIO});

    static final Set<String> SHOULDER_PREVENTION = Set.of(SHOULDER_YTW, SHOULDER_EXT, SHOULDER_INT);

    @Autowired MockMvc mvc;
    @Autowired SportRepository sports;
    @Autowired ExerciseRepository exercises;
    @Autowired ExerciseSportRepository links;

    long voleiId;

    @BeforeEach
    void setUp() {
        voleiId = sports.findByCode("volei").orElseThrow().getId();
    }

    private List<ExerciseSport> voleiLinks() {
        return links.findBySportIdIn(List.of(voleiId));
    }

    private Exercise byName(String name) {
        return exercises.findByName(name).orElseThrow(() -> new AssertionError("Ausente: " + name));
    }

    @Test
    void voleiHasAtLeastFiveSpecificExercises() {
        long specific = voleiLinks().stream()
                .filter(l -> l.getExercise().getCategory() == ExerciseCategory.ESPECIFICO)
                .count();
        assertThat(specific).isGreaterThanOrEqualTo(5);
    }

    @Test
    void newExercisesExistWithCategoryDifficultyAndInstructions() {
        NEW_EXERCISES.forEach((name, expected) -> {
            var ex = byName(name);
            assertThat(ex.getCategory()).as(name).isEqualTo(expected[0]);
            assertThat(ex.getDifficulty()).as(name).isEqualTo(expected[1]);
            assertThat(ex.getSteps()).as(name).hasSizeGreaterThanOrEqualTo(3).allMatch(s -> !s.isBlank());
            assertThat(ex.getEquipment()).as(name).isNotBlank();
            assertThat(ex.getMuscleGroups()).as(name).isNotEmpty();
        });
    }

    @Test
    void newExercisesAreLinkedToVoleiWithCoherentRelevance() {
        var byExercise = voleiLinks().stream()
                .collect(java.util.stream.Collectors.toMap(l -> l.getExercise().getName(), l -> l, (a, b) -> a));

        NEW_EXERCISES.keySet().forEach(name -> {
            var link = byExercise.get(name);
            assertThat(link).as("vínculo vôlei: " + name).isNotNull();
            assertThat(link.getRelevanceScore()).as(name).isBetween(4, 5);
            assertThat(link.getRationale()).as(name).isNotBlank();
        });
    }

    @Test
    void landingExercisesArePresent() {
        var landing = voleiLinks().stream()
                .filter(l -> l.getExercise().getName().equals(LANDING))
                .findFirst().orElseThrow();
        assertThat(landing.getRelevanceScore()).isEqualTo(5);
        assertThat(landing.getRationale().toLowerCase()).contains("aterrissagem");
    }

    @Test
    void attackAndBlockCoverageIsPresent() {
        var names = voleiLinks().stream().map(l -> l.getExercise().getName()).toList();
        assertThat(names).contains(ATTACK, BLOCK_LATERAL, BLOCK_JUMP);

        var attack = voleiLinks().stream().filter(l -> l.getExercise().getName().equals(ATTACK)).findFirst().orElseThrow();
        assertThat(attack.getRationale().toLowerCase()).contains("ataque");
        var block = voleiLinks().stream().filter(l -> l.getExercise().getName().equals(BLOCK_LATERAL)).findFirst().orElseThrow();
        assertThat(block.getRationale().toLowerCase()).contains("bloqueio");
    }

    @Test
    void shoulderHealthCoverageIsPresent() {
        var prevention = voleiLinks().stream()
                .filter(l -> SHOULDER_PREVENTION.contains(l.getExercise().getName()))
                .toList();
        assertThat(prevention).hasSizeGreaterThanOrEqualTo(2);
        assertThat(prevention).allMatch(l -> l.getRelevanceScore() >= 3);
        assertThat(prevention.stream().map(l -> l.getExercise().getName())).contains(SHOULDER_YTW);
        // critério clínico: exercício de manguito/escápula, não apenas nome
        assertThat(prevention.stream()
                .filter(l -> l.getExercise().getMuscleGroups().contains("manguito rotador"))
                .count()).isGreaterThanOrEqualTo(2);
    }

    @Test
    void reactivePlyometricsArePresent() {
        assertThat(byName(REACTIVE).getCategory()).isEqualTo(ExerciseCategory.PLIOMETRIA);
        assertThat(voleiLinks().stream().map(l -> l.getExercise().getName())).contains(REACTIVE);
    }

    @Test
    void feedFindsNewVoleiExercises() throws Exception {
        String body = mvc.perform(get("/api/exercises/feed").param("sportIds", String.valueOf(voleiId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        List<String> names = JsonPath.read(body, "$[*].name");
        assertThat(names).containsAll(NEW_EXERCISES.keySet());

        String specific = mvc.perform(get("/api/exercises/feed")
                        .param("sportIds", String.valueOf(voleiId))
                        .param("category", "ESPECIFICO"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat((List<?>) JsonPath.read(specific, "$[*].name")).hasSizeGreaterThanOrEqualTo(5);
    }

    @Test
    void generatorIncludesSpecificVoleiExercisesForProfessional() throws Exception {
        String token = TestUsers.register(mvc, "levantador@forja.com");
        mvc.perform(put("/api/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content("{\"name\":\"Levantador\",\"sports\":[{\"code\":\"volei\",\"level\":\"PROFESSIONAL\"}]}"))
                .andExpect(status().isOk());

        String routine = mvc.perform(post("/api/routines/generate")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content("{\"sportId\":" + voleiId + "}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

        List<Number> ids = JsonPath.read(routine, "$.items[*].exerciseId");
        Set<Long> voleiExerciseIds = voleiLinks().stream().map(l -> l.getExercise().getId())
                .collect(java.util.stream.Collectors.toSet());
        List<Exercise> picked = ids.stream().map(n -> exercises.findById(n.longValue()).orElseThrow()).toList();

        var specific = picked.stream().filter(e -> e.getCategory() == ExerciseCategory.ESPECIFICO).toList();
        assertThat(specific).as("gerador deve incluir ESPECIFICO de vôlei para profissional").isNotEmpty();
        assertThat(specific).allMatch(e -> voleiExerciseIds.contains(e.getId()));
    }
}
