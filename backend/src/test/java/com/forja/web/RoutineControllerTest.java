package com.forja.web;

import com.forja.domain.AppUser;
import com.forja.domain.Exercise;
import com.forja.domain.ExerciseCategory;
import com.forja.domain.Routine;
import com.forja.domain.RoutineItem;
import com.forja.domain.Sport;
import com.forja.repository.AppUserRepository;
import com.forja.repository.ExerciseRepository;
import com.forja.repository.RoutineRepository;
import com.forja.repository.ExerciseSportRepository;
import com.forja.service.RoutineGeneratorService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoutineControllerTest {

    @Mock RoutineRepository routines;
    @Mock RoutineGeneratorService generator;
    @Mock AppUserRepository users;
    @Mock ExerciseRepository exercises;
    @Mock ExerciseSportRepository exerciseSports;
    @Mock Authentication auth;

    RoutineController controller;

    @BeforeEach
    void setUp() {
        controller = new RoutineController(routines, generator, users, exercises, exerciseSports);
        when(auth.getName()).thenReturn("atleta@forja.com");
    }

    private AppUser user(long id) {
        return AppUser.builder().id(id).email("atleta@forja.com").build();
    }

    private Sport sport(long id) {
        return Sport.builder().id(id).code("futebol").name("Futebol").build();
    }

    private Routine routine(long id, AppUser owner, Sport sp) {
        return Routine.builder().id(id).user(owner).sport(sp).name("Treino Futebol").build();
    }

    @Test
    void mineReturnsOnlyUserRoutines() {
        AppUser me = user(1L);
        when(users.findByEmail("atleta@forja.com")).thenReturn(Optional.of(me));
        when(routines.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(routine(10L, me, sport(1L))));

        var result = controller.mine(auth);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).id()).isEqualTo(10L);
        assertThat(result.get(0).sportCode()).isEqualTo("futebol");
    }

    @Test
    void generateDelegatesToServiceAndReturnsDto() {
        AppUser me = user(1L);
        Routine generated = routine(7L, me, sport(1L));
        when(generator.generateWithReadiness("atleta@forja.com", 3L, null)).thenReturn(
                new RoutineGeneratorService.GenerationResult(generated, null, false, false, null, "Motivo"));

        var result = controller.generate(new RoutineController.GenerateRequest(3L, null), auth);

        assertThat(result.id()).isEqualTo(7L);
        assertThat(result.sportCode()).isEqualTo("futebol");
        assertThat(result.readinessAdjusted()).isFalse();
        assertThat(result.requiresReview()).isFalse();
        verify(generator).generateWithReadiness("atleta@forja.com", 3L, null);
    }

    @Test
    void generateReturnsReviewRecommendationFromReadiness() {
        AppUser me = user(1L);
        Routine generated = routine(8L, me, sport(1L));
        String recommendation = "Revise o treino com um profissional antes de iniciar.";
        when(generator.generateWithReadiness("atleta@forja.com", 3L, null)).thenReturn(
                new RoutineGeneratorService.GenerationResult(generated, 12, true, true, recommendation, "Ajuste"));

        var result = controller.generate(new RoutineController.GenerateRequest(3L, null), auth);

        assertThat(result.readinessScore()).isEqualTo(12);
        assertThat(result.readinessAdjusted()).isTrue();
        assertThat(result.requiresReview()).isTrue();
        assertThat(result.reviewRecommendation()).isEqualTo(recommendation);
    }

    @Test
    void addItemAddsExerciseWithPresetOnce() {
        AppUser me = user(1L);
        Sport sp = sport(1L);
        Routine r = routine(5L, me, sp);
        Exercise ex = Exercise.builder().id(9L).name("Agachamento").category(ExerciseCategory.FORCA).build();
        when(users.findByEmail("atleta@forja.com")).thenReturn(Optional.of(me));
        when(routines.findById(5L)).thenReturn(Optional.of(r));
        when(exercises.findById(9L)).thenReturn(Optional.of(ex));

        var first = controller.addItem(5L, new RoutineController.AddItemRequest(9L), auth);
        var second = controller.addItem(5L, new RoutineController.AddItemRequest(9L), auth);

        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(first.getBody().items()).hasSize(1);
        assertThat(first.getBody().items().get(0).sets()).isEqualTo(4); // preset FORCA
        assertThat(second.getBody().items()).hasSize(1); // sem duplicar
        verify(routines, times(1)).save(r);
    }

    @Test
    void replacesExerciseWithSportAndCategoryCompatibleAlternativePreservingDose() {
        AppUser me = user(1L);
        Sport sp = sport(1L);
        Exercise oldExercise = Exercise.builder().id(9L).name("Agachamento A").category(ExerciseCategory.FORCA).build();
        Exercise newExercise = Exercise.builder().id(10L).name("Agachamento B").category(ExerciseCategory.FORCA).build();
        Routine routine = routine(5L, me, sp);
        routine.getItems().add(RoutineItem.builder().routine(routine).exercise(oldExercise).position(0)
                .sets(2).reps("8 reps").restTime(150).build());
        when(users.findByEmail("atleta@forja.com")).thenReturn(Optional.of(me));
        when(routines.findById(5L)).thenReturn(Optional.of(routine));
        when(exercises.findById(10L)).thenReturn(Optional.of(newExercise));
        when(exerciseSports.findByExerciseIdAndSportId(10L, 1L))
                .thenReturn(Optional.of(com.forja.domain.ExerciseSport.builder().exercise(newExercise).sport(sp).build()));
        when(routines.save(routine)).thenReturn(routine);

        var result = controller.replaceItem(5L, 9L, new RoutineController.ReplaceItemRequest(10L), auth);

        assertThat(result.items()).singleElement().satisfies(item -> {
            assertThat(item.exerciseId()).isEqualTo(10L);
            assertThat(item.sets()).isEqualTo(2);
            assertThat(item.restTime()).isEqualTo(150);
        });
    }

    @Test
    void addItemReturnsNotFoundWhenRoutineNotOwned() {
        AppUser me = user(1L);
        AppUser other = AppUser.builder().id(2L).email("outro@forja.com").build();
        Routine foreign = routine(5L, other, sport(1L));
        when(users.findByEmail("atleta@forja.com")).thenReturn(Optional.of(me));
        when(routines.findById(5L)).thenReturn(Optional.of(foreign));

        assertThatThrownBy(() -> controller.addItem(5L, new RoutineController.AddItemRequest(9L), auth))
                .isInstanceOf(NoSuchElementException.class);
    }

    @Test
    void patchItemUpdatesSetsAndRestTime() {
        AppUser me = user(1L);
        Routine r = routine(5L, me, sport(1L));
        Exercise ex = Exercise.builder().id(9L).name("Agachamento").category(ExerciseCategory.FORCA).build();
        r.getItems().add(RoutineItem.builder()
                .routine(r).exercise(ex).position(0).sets(4).reps("8 reps").restTime(120).build());
        when(users.findByEmail("atleta@forja.com")).thenReturn(Optional.of(me));
        when(routines.findById(5L)).thenReturn(Optional.of(r));

        var response = controller.patchItem(5L, 9L, new RoutineController.ItemPatch(3, 90), auth);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().items().get(0).sets()).isEqualTo(3);
        assertThat(response.getBody().items().get(0).restTime()).isEqualTo(90);
    }

    @Test
    void patchItemReturnsNotFoundWhenRoutineNotOwned() {
        AppUser me = user(1L);
        AppUser other = AppUser.builder().id(2L).email("outro@forja.com").build();
        when(users.findByEmail("atleta@forja.com")).thenReturn(Optional.of(me));
        when(routines.findById(5L)).thenReturn(Optional.of(routine(5L, other, sport(1L))));

        assertThatThrownBy(() -> controller.patchItem(5L, 9L, new RoutineController.ItemPatch(3, 90), auth))
                .isInstanceOf(NoSuchElementException.class);
    }

    @Test
    void deleteReturnsNotFoundWhenRoutineNotOwned() {
        AppUser me = user(1L);
        AppUser other = AppUser.builder().id(2L).email("outro@forja.com").build();
        when(users.findByEmail("atleta@forja.com")).thenReturn(Optional.of(me));
        when(routines.findById(5L)).thenReturn(Optional.of(routine(5L, other, sport(1L))));

        assertThatThrownBy(() -> controller.delete(5L, auth))
                .isInstanceOf(NoSuchElementException.class);

        verify(routines, never()).delete(any());
        verify(routines, never()).deleteById(5L);
    }
}
