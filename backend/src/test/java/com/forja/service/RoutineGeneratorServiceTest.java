package com.forja.service;

import com.forja.domain.AppUser;
import com.forja.domain.Exercise;
import com.forja.domain.ExerciseCategory;
import com.forja.domain.ExerciseSport;
import com.forja.domain.Routine;
import com.forja.domain.RoutineItem;
import com.forja.domain.Sport;
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
        AppUser user = userWithSports(focus);

        List<ExerciseSport> pairs = List.of(
                link(exercise(1L, "Foco5", ExerciseCategory.FORCA), focus, 5),
                link(exercise(2L, "Foco3", ExerciseCategory.FORCA), focus, 3));

        Routine result = generateWith(user, focus, pairs);

        RoutineItem item5 = result.getItems().stream()
                .filter(it -> it.getExercise().getId() == 1L).findFirst().orElseThrow();
        RoutineItem item3 = result.getItems().stream()
                .filter(it -> it.getExercise().getId() == 2L).findFirst().orElseThrow();
        assertThat(item5.getSets()).isEqualTo(5); // preset FORCA 4 + 1
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
}