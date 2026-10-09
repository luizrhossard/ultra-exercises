package com.forja.service;

import com.forja.domain.AppUser;
import com.forja.domain.Exercise;
import com.forja.domain.ExerciseCategory;
import com.forja.domain.ExerciseSport;
import com.forja.domain.Routine;
import com.forja.domain.RoutineItem;
import com.forja.domain.ExerciseDifficulty;
import com.forja.domain.Sport;
import com.forja.domain.SportLevel;
import com.forja.domain.UserSport;
import com.forja.repository.AppUserRepository;
import com.forja.repository.ExerciseSportRepository;
import com.forja.repository.RoutineRepository;
import com.forja.repository.SportRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoutineGeneratorServiceTest {

    @Mock AppUserRepository users;
    @Mock SportRepository sports;
    @Mock ExerciseSportRepository links;
    @Mock RoutineRepository routines;

    RoutineGeneratorService service;

    @BeforeEach
    void setUp() {
        service = new RoutineGeneratorService(users, sports, links, routines);
    }

    private Sport sport(long id, String code, String name) {
        return Sport.builder().id(id).code(code).name(name).build();
    }

    private Exercise exercise(long id, String name, ExerciseCategory category) {
        return Exercise.builder().id(id).name(name).category(category).build();
    }

    private ExerciseSport link(Exercise ex, Sport sp, int score) {
        return ExerciseSport.builder().exercise(ex).sport(sp).relevanceScore(score).build();
    }

    private AppUser userWithSports(Sport... sports) {
        AppUser user = AppUser.builder().id(1L).email("atleta@forja.com").build();
        for (Sport s : sports) {
            user.getUserSports().add(UserSport.builder().user(user).sport(s).build());
        }
        return user;
    }

    private Exercise exercise(long id, String name, ExerciseCategory category, ExerciseDifficulty difficulty) {
        return Exercise.builder().id(id).name(name).category(category).difficulty(difficulty).build();
    }

    /** [UE-50] Usuário com nível distinto por esporte (ordem estável). */
    private AppUser userWithLevels(Map<Sport, SportLevel> levels) {
        AppUser user = AppUser.builder().id(1L).email("atleta@forja.com").build();
        levels.entrySet().stream()
                .sorted(Comparator.comparing(e -> e.getKey().getId()))
                .forEach(e -> user.getUserSports().add(
                        UserSport.builder().user(user).sport(e.getKey()).level(e.getValue()).build()));
        return user;
    }

    private Routine generateWith(AppUser user, Sport focus, List<ExerciseSport> pairs) {
        when(users.findByEmail("atleta@forja.com")).thenReturn(Optional.of(user));
        when(sports.findById(focus.getId())).thenReturn(Optional.of(focus));
        when(links.findBySportIdIn(any())).thenReturn(pairs);
        when(routines.save(any())).thenAnswer(inv -> inv.getArgument(0));
        return service.generate("atleta@forja.com", focus.getId());
    }

    @Test
    void generatesRoutineWithUpToSevenItemsAndSaves() {
        Sport focus = sport(1L, "futebol", "Futebol");
        AppUser user = userWithSports(focus);

        List<ExerciseSport> pairs = new ArrayList<>();
        ExerciseCategory[] cats = {
                ExerciseCategory.FORCA, ExerciseCategory.FORCA, ExerciseCategory.FORCA,
                ExerciseCategory.PLIOMETRIA, ExerciseCategory.CORE, ExerciseCategory.CONDICIONAMENTO,
                ExerciseCategory.ESPECIFICO, ExerciseCategory.MOBILIDADE};
        for (int i = 0; i < cats.length; i++) {
            pairs.add(link(exercise(i + 1L, "Ex" + i, cats[i]), focus, 5));
        }

        Routine result = generateWith(user, focus, pairs);

        assertThat(result.getItems()).hasSize(7);
        verify(routines).save(result);
    }

    @Test
    void respectsCategoryQuotas() {
        Sport focus = sport(1L, "futebol", "Futebol");
        AppUser user = userWithSports(focus);

        List<ExerciseSport> pairs = new ArrayList<>();
        pairs.add(link(exercise(1L, "ForcaA", ExerciseCategory.FORCA), focus, 5));
        pairs.add(link(exercise(2L, "ForcaB", ExerciseCategory.FORCA), focus, 5));
        pairs.add(link(exercise(3L, "Plio", ExerciseCategory.PLIOMETRIA), focus, 5));
        pairs.add(link(exercise(4L, "Core", ExerciseCategory.CORE), focus, 5));
        pairs.add(link(exercise(5L, "Cond", ExerciseCategory.CONDICIONAMENTO), focus, 5));
        pairs.add(link(exercise(6L, "Esp", ExerciseCategory.ESPECIFICO), focus, 5));
        pairs.add(link(exercise(7L, "Mob", ExerciseCategory.MOBILIDADE), focus, 5));

        Routine result = generateWith(user, focus, pairs);

        Map<ExerciseCategory, Long> counts = result.getItems().stream()
                .collect(Collectors.groupingBy(it -> it.getExercise().getCategory(), Collectors.counting()));
        assertThat(counts.get(ExerciseCategory.FORCA)).isEqualTo(2);
        assertThat(counts.get(ExerciseCategory.PLIOMETRIA)).isEqualTo(1);
        assertThat(counts.get(ExerciseCategory.CORE)).isEqualTo(1);
        assertThat(counts.get(ExerciseCategory.CONDICIONAMENTO)).isEqualTo(1);
        assertThat(counts.get(ExerciseCategory.ESPECIFICO)).isEqualTo(1);
        assertThat(counts.get(ExerciseCategory.MOBILIDADE)).isEqualTo(1);
    }

    @Test
    void focusSportScoreCountsDouble() {
        Sport focus = sport(1L, "futebol", "Futebol");
        Sport other = sport(2L, "corrida", "Corrida");
        AppUser user = userWithSports(focus, other);

        // A: foco 5 → total 10 · C: foco 3 + outro 4 → total 10 (empata, perde no focusScore)
        // B: foco 4 → total 8
        List<ExerciseSport> pairs = List.of(
                link(exercise(1L, "A", ExerciseCategory.FORCA), focus, 5),
                link(exercise(2L, "B", ExerciseCategory.FORCA), focus, 4),
                link(exercise(3L, "C", ExerciseCategory.FORCA), focus, 3),
                link(exercise(3L, "C", ExerciseCategory.FORCA), other, 4));

        Routine result = generateWith(user, focus, pairs);

        assertThat(result.getItems()).extracting(it -> it.getExercise().getId())
                .containsExactly(1L, 3L, 2L);
    }

    @Test
    void addsExtraSetWhenFocusScoreIsFive() {
        Sport focus = sport(1L, "futebol", "Futebol");
        AppUser user = userWithLevels(Map.of(focus, SportLevel.AMATEUR));

        List<ExerciseSport> pairs = List.of(
                link(exercise(1L, "Foco5", ExerciseCategory.FORCA), focus, 5),
                link(exercise(2L, "Foco3", ExerciseCategory.FORCA), focus, 3));

        Routine result = generateWith(user, focus, pairs);

        RoutineItem item5 = result.getItems().stream()
                .filter(it -> it.getExercise().getId() == 1L).findFirst().orElseThrow();
        RoutineItem item3 = result.getItems().stream()
                .filter(it -> it.getExercise().getId() == 2L).findFirst().orElseThrow();
        assertThat(item5.getSets()).isEqualTo(5); // preset AMATEUR FORCA 4 + 1
        assertThat(item3.getSets()).isEqualTo(4);
    }

    @Test
    void routineNameFollowsPattern() {
        Sport focus = sport(1L, "futebol", "Futebol");
        AppUser user = userWithSports(focus);

        Routine result = generateWith(user, focus,
                List.of(link(exercise(1L, "A", ExerciseCategory.FORCA), focus, 5)));

        String expected = "Treino Futebol · " + LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM"));
        assertThat(result.getName()).isEqualTo(expected);
    }

    @Test
    void throwsWhenUserNotFound() {
        when(users.findByEmail("x@forja.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.generate("x@forja.com", 1L))
                .isInstanceOf(NoSuchElementException.class);
    }

    @Test
    void throwsWhenSportNotFound() {
        Sport focus = sport(1L, "futebol", "Futebol");
        AppUser user = userWithSports(focus);
        when(users.findByEmail("atleta@forja.com")).thenReturn(Optional.of(user));
        when(sports.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.generate("atleta@forja.com", 99L))
                .isInstanceOf(NoSuchElementException.class);
    }

    // ================================================================ [UE-50] SportLevel

    /**
     * Catálogo de referência (ids estáveis) com todas as dificuldades por categoria.
     * Score igual para todos os esportes passados — isola o efeito do nível.
     */
    private List<ExerciseSport> catalog(Sport... sps) {
        List<Exercise> exs = List.of(
                exercise(1L, "F_ini", ExerciseCategory.FORCA, ExerciseDifficulty.INICIANTE),
                exercise(2L, "F_int", ExerciseCategory.FORCA, ExerciseDifficulty.INTERMEDIARIO),
                exercise(3L, "F_adv", ExerciseCategory.FORCA, ExerciseDifficulty.AVANCADO),
                exercise(4L, "F_adv2", ExerciseCategory.FORCA, ExerciseDifficulty.AVANCADO),
                exercise(5L, "P_ini", ExerciseCategory.PLIOMETRIA, ExerciseDifficulty.INICIANTE),
                exercise(6L, "P_adv", ExerciseCategory.PLIOMETRIA, ExerciseDifficulty.AVANCADO),
                exercise(7L, "C_ini", ExerciseCategory.CORE, ExerciseDifficulty.INICIANTE),
                exercise(8L, "C_int", ExerciseCategory.CORE, ExerciseDifficulty.INTERMEDIARIO),
                exercise(9L, "K_int", ExerciseCategory.CONDICIONAMENTO, ExerciseDifficulty.INTERMEDIARIO),
                exercise(10L, "E_ini", ExerciseCategory.ESPECIFICO, ExerciseDifficulty.INICIANTE),
                exercise(11L, "E_int", ExerciseCategory.ESPECIFICO, ExerciseDifficulty.INTERMEDIARIO),
                exercise(12L, "E_adv", ExerciseCategory.ESPECIFICO, ExerciseDifficulty.AVANCADO),
                exercise(13L, "M_ini", ExerciseCategory.MOBILIDADE, ExerciseDifficulty.INICIANTE));
        Map<Long, Integer> score = Map.of(3L, 5, 6L, 5, 12L, 5);
        List<ExerciseSport> pairs = new ArrayList<>();
        for (Sport sp : sps) {
            for (Exercise ex : exs) pairs.add(link(ex, sp, score.getOrDefault(ex.getId(), 4)));
        }
        return pairs;
    }

    private Routine generateAt(SportLevel level) {
        Sport focus = sport(1L, "futebol", "Futebol");
        return generateWith(userWithLevels(Map.of(focus, level)), focus, catalog(focus));
    }

    private static List<String> names(Routine r) {
        return r.getItems().stream().map(it -> it.getExercise().getName()).toList();
    }

    private static List<ExerciseDifficulty> difficulties(Routine r) {
        return r.getItems().stream().map(it -> it.getExercise().getDifficulty()).toList();
    }

    private static int totalSets(Routine r) {
        return r.getItems().stream().mapToInt(RoutineItem::getSets).sum();
    }

    /** 1. Mesmo usuário com níveis diferentes por esporte: o nível do FOCO é o que vale. */
    @Test
    void sameUserUsesLevelOfFocusSport() {
        Sport futebol = sport(1L, "futebol", "Futebol");
        Sport corrida = sport(2L, "corrida", "Corrida");
        AppUser user = userWithLevels(Map.of(futebol, SportLevel.PROFESSIONAL, corrida, SportLevel.RECREATIONAL));

        assertThat(user.getUserSports()).extracting(UserSport::getLevel)
                .containsExactly(SportLevel.PROFESSIONAL, SportLevel.RECREATIONAL);
        assertThat(RoutineGeneratorService.levelFor(user, 1L)).isEqualTo(SportLevel.PROFESSIONAL);
        assertThat(RoutineGeneratorService.levelFor(user, 2L)).isEqualTo(SportLevel.RECREATIONAL);

        Routine asPro = generateWith(user, futebol, catalog(futebol, corrida));
        Routine asRec = generateWith(user, corrida, catalog(futebol, corrida));

        assertThat(difficulties(asPro)).contains(ExerciseDifficulty.AVANCADO);
        assertThat(difficulties(asRec)).doesNotContain(ExerciseDifficulty.AVANCADO);
        assertThat(names(asPro)).isNotEqualTo(names(asRec));
    }

    /** 2 e 3. A rotina muda conforme o nível; recreativo ≠ profissional. */
    @Test
    void routineChangesWithSportLevel() {
        Routine rec = generateAt(SportLevel.RECREATIONAL);
        Routine ama = generateAt(SportLevel.AMATEUR);
        Routine comp = generateAt(SportLevel.COMPETITIVE);
        Routine pro = generateAt(SportLevel.PROFESSIONAL);

        assertThat(names(rec)).containsExactly("F_ini", "F_int", "P_ini", "C_ini", "K_int", "E_ini", "M_ini");
        assertThat(names(pro)).containsExactly("F_adv", "F_adv2", "P_adv", "C_int", "K_int", "E_adv", "E_int", "M_ini");
        assertThat(names(rec)).isNotEqualTo(names(pro));
        assertThat(names(comp)).isNotEqualTo(names(rec)).isNotEqualTo(names(pro));
        assertThat(names(ama)).doesNotContain("F_adv", "P_adv", "E_adv");
    }

    /** 4. Níveis de base (RECREATIONAL/AMATEUR) nunca recebem AVANCADO, mesmo com relevância 5. */
    @Test
    void entryLevelsNeverReceiveAdvancedExercises() {
        for (SportLevel level : List.of(SportLevel.RECREATIONAL, SportLevel.AMATEUR)) {
            assertThat(difficulties(generateAt(level))).as(level.name())
                    .doesNotContain(ExerciseDifficulty.AVANCADO);
        }
    }

    @Test
    void recreationalWithOnlyAdvancedCatalogGetsEmptyRoutineInsteadOfUnsafeOne() {
        Sport focus = sport(1L, "futebol", "Futebol");
        Routine r = generateWith(userWithLevels(Map.of(focus, SportLevel.RECREATIONAL)), focus,
                List.of(link(exercise(1L, "Adv", ExerciseCategory.FORCA, ExerciseDifficulty.AVANCADO), focus, 5)));
        assertThat(r.getItems()).isEmpty();
    }

    @Test
    void userWithoutFocusSportFallsBackToRecreational() {
        Sport focus = sport(1L, "futebol", "Futebol");
        Sport other = sport(2L, "corrida", "Corrida");
        AppUser user = userWithLevels(Map.of(other, SportLevel.PROFESSIONAL));
        assertThat(RoutineGeneratorService.levelFor(user, focus.getId())).isEqualTo(SportLevel.RECREATIONAL);
    }

    /** 5. Profissional (e competitivo) recebe AVANCADO quando disponível, com mais ESPECIFICO no PRO. */
    @Test
    void highLevelsReceiveAdvancedAndSpecificExercises() {
        Routine pro = generateAt(SportLevel.PROFESSIONAL);
        Routine comp = generateAt(SportLevel.COMPETITIVE);

        assertThat(difficulties(pro)).filteredOn(d -> d == ExerciseDifficulty.AVANCADO).hasSize(4);
        assertThat(difficulties(comp)).contains(ExerciseDifficulty.AVANCADO);
        assertThat(pro.getItems()).filteredOn(it -> it.getExercise().getCategory() == ExerciseCategory.ESPECIFICO)
                .hasSize(2);
        assertThat(pro.getItems()).hasSize(8);
        assertThat(generateAt(SportLevel.RECREATIONAL).getItems()).hasSize(7);
    }

    /** 6. Volume e intensidade progridem com o nível. */
    @Test
    void volumeAndIntensityScaleWithLevel() {
        int rec = totalSets(generateAt(SportLevel.RECREATIONAL));
        int ama = totalSets(generateAt(SportLevel.AMATEUR));
        int comp = totalSets(generateAt(SportLevel.COMPETITIVE));
        int pro = totalSets(generateAt(SportLevel.PROFESSIONAL));
        assertThat(List.of(rec, ama, comp, pro)).containsExactly(18, 25, 36, 41);

        RoutineItem recForca = generateAt(SportLevel.RECREATIONAL).getItems().get(0);
        RoutineItem proForca = generateAt(SportLevel.PROFESSIONAL).getItems().get(0);
        assertThat(recForca.getReps()).isEqualTo("10 reps");
        assertThat(recForca.getRestTime()).isEqualTo(120);
        assertThat(proForca.getReps()).isEqualTo("5 reps");   // carga maior, menos reps
        assertThat(proForca.getRestTime()).isEqualTo(180);
        assertThat(proForca.getSets()).isEqualTo(6);          // 5 + bônus foco, teto 6
    }

    @Test
    void recreationalDoesNotGetFocusExtraSet() {
        Sport focus = sport(1L, "futebol", "Futebol");
        Routine r = generateWith(userWithLevels(Map.of(focus, SportLevel.RECREATIONAL)), focus,
                List.of(link(exercise(1L, "Foco5", ExerciseCategory.FORCA, ExerciseDifficulty.INICIANTE), focus, 5)));
        assertThat(r.getItems().get(0).getSets()).isEqualTo(3);
    }

    /** 7. Relevância por esporte continua dominante sobre o bônus de dificuldade. */
    @Test
    void relevanceStillDominatesDifficultyBonus() {
        Sport focus = sport(1L, "futebol", "Futebol");
        Sport other = sport(2L, "corrida", "Corrida");
        AppUser user = userWithLevels(Map.of(focus, SportLevel.PROFESSIONAL, other, SportLevel.AMATEUR));

        // Int5: 2×5 + 1 = 11 · Adv3: 2×3 + 2 = 8 · IntOther: 2×3 + 4 + 1 = 11 (perde no focusScore)
        List<ExerciseSport> pairs = List.of(
                link(exercise(1L, "Adv3", ExerciseCategory.FORCA, ExerciseDifficulty.AVANCADO), focus, 3),
                link(exercise(2L, "Int5", ExerciseCategory.FORCA, ExerciseDifficulty.INTERMEDIARIO), focus, 5),
                link(exercise(3L, "IntOther", ExerciseCategory.FORCA, ExerciseDifficulty.INTERMEDIARIO), focus, 3),
                link(exercise(3L, "IntOther", ExerciseCategory.FORCA, ExerciseDifficulty.INTERMEDIARIO), other, 4));

        Routine r = generateWith(user, focus, pairs);

        assertThat(names(r)).containsExactly("Int5", "IntOther", "Adv3");
    }
}