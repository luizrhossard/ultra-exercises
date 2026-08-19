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
import com.forja.service.RoutineGeneratorService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
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
    @Mock Authentication auth;

    RoutineController controller;

    @BeforeEach
    void setUp() {
        controller = new RoutineController(routines, generator, users, exercises);
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
        when(generator.generate("atleta@forja.com", 3L)).thenReturn(generated);

        var result = controller.generate(new RoutineController.GenerateRequest(3L), auth);

        assertThat(result.id()).isEqualTo(7L);
        assertThat(result.sportCode()).isEqualTo("futebol");
        verify(generator).generate("atleta@forja.com", 3L);
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
    void addItemReturnsNotFoundWhenRoutineNotOwned() {
        AppUser me = user(1L);
        AppUser other = AppUser.builder().id(2L).email("outro@forja.com").build();
        Routine foreign = routine(5L, other, sport(1L));
        when(users.findByEmail("atleta@forja.com")).thenReturn(Optional.of(me));
        when(routines.findById(5L)).thenReturn(Optional.of(foreign));

        var response = controller.addItem(5L, new RoutineController.AddItemRequest(9L), auth);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
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

        var response = controller.patchItem(5L, 9L, new RoutineController.ItemPatch(3, 90), auth);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void deleteReturnsNotFoundWhenRoutineNotOwned() {
        AppUser me = user(1L);
        AppUser other = AppUser.builder().id(2L).email("outro@forja.com").build();
        when(users.findByEmail("atleta@forja.com")).thenReturn(Optional.of(me));
        when(routines.findById(5L)).thenReturn(Optional.of(routine(5L, other, sport(1L))));

        controller.delete(5L, auth);

        verify(routines, never()).delete(any());
    }
}