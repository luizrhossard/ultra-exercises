package com.forja.web;

import com.forja.domain.AppUser;
import com.forja.domain.Routine;
import com.forja.repository.AppUserRepository;
import com.forja.repository.ExerciseRepository;
import com.forja.repository.RoutineRepository;
import com.forja.service.RoutineGeneratorService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/routines")
@RequiredArgsConstructor
public class RoutineController {

    private final RoutineRepository routines;
    private final RoutineGeneratorService generator;
    private final AppUserRepository users;
    private final ExerciseRepository exercises;

    record GenerateRequest(@NotNull Long sportId) {
    }

    record AddItemRequest(@NotNull Long exerciseId) {
    }

    record ItemPatch(Integer sets, Integer restTime) {
    }

    record ItemDto(Long exerciseId, String exerciseName, int position,
                   int sets, String reps, int restTime) {
    }

    record RoutineDto(Long id, String name, String sportCode, String sportName,
                      Instant createdAt, List<ItemDto> items) {
    }

    @GetMapping
    @Transactional(readOnly = true)
    List<RoutineDto> mine(Authentication auth) {
        return routines.findByUserIdOrderByCreatedAtDesc(currentUser(auth).getId())
                .stream().map(RoutineController::toDto).toList();
    }

    @PostMapping("/generate")
    @ResponseStatus(HttpStatus.CREATED)
    RoutineDto generate(@Valid @RequestBody GenerateRequest request, Authentication auth) {
        var routine = generator.generate(auth.getName(), request.sportId());
        return toDto(routine);
    }

    @PostMapping("/{id}/items")
    @Transactional
    ResponseEntity<RoutineDto> addItem(@PathVariable Long id,
                                       @Valid @RequestBody AddItemRequest request,
                                       Authentication auth) {
        return ownedRoutine(id, auth).map(routine -> {
            var exercise = exercises.findById(request.exerciseId())
                    .orElseThrow(() -> new NoSuchElementException("Exercício não encontrado"));
            boolean already = routine.getItems().stream()
                    .anyMatch(it -> it.getExercise().getId().equals(exercise.getId()));
            if (!already) {
                var preset = RoutineGeneratorService.PRESETS.get(exercise.getCategory());
                routine.getItems().add(com.forja.domain.RoutineItem.builder()
                        .routine(routine)
                        .exercise(exercise)
                        .position(routine.getItems().size())
                        .sets(preset.sets())
                        .reps(preset.reps())
                        .restTime(preset.rest())
                        .build());
                routines.save(routine);
            }
            return ResponseEntity.ok(toDto(routine));
        }).orElseThrow(() -> new NoSuchElementException("Rotina não encontrada"));
    }

    @PatchMapping("/{id}/items/{exerciseId}")
    @Transactional
    ResponseEntity<RoutineDto> patchItem(@PathVariable Long id,
                                         @PathVariable Long exerciseId,
                                         @RequestBody ItemPatch patch,
                                         Authentication auth) {
        return ownedRoutine(id, auth).map(routine -> {
            routine.getItems().stream()
                    .filter(it -> it.getExercise().getId().equals(exerciseId))
                    .findFirst()
                    .ifPresent(it -> {
                        if (patch.sets() != null) it.setSets(patch.sets());
                        if (patch.restTime() != null) it.setRestTime(patch.restTime());
                    });
            routines.save(routine);
            return ResponseEntity.ok(toDto(routine));
        }).orElseThrow(() -> new NoSuchElementException("Rotina não encontrada"));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable Long id, Authentication auth) {
        ownedRoutine(id, auth).orElseThrow(() -> new NoSuchElementException("Rotina não encontrada"));
        routines.deleteById(id);
    }

    // ---- helpers ----

    private AppUser currentUser(Authentication auth) {
        return users.findByEmail(auth.getName())
                .orElseThrow(() -> new NoSuchElementException("Usuário não encontrado"));
    }

    private java.util.Optional<Routine> ownedRoutine(Long routineId, Authentication auth) {
        var user = currentUser(auth);
        return routines.findById(routineId)
                .filter(r -> r.getUser().getId().equals(user.getId()));
    }

    private static RoutineDto toDto(Routine r) {
        return new RoutineDto(
                r.getId(),
                r.getName(),
                r.getSport().getCode(),
                r.getSport().getName(),
                r.getCreatedAt(),
                r.getItems().stream()
                        .map(it -> new ItemDto(
                                it.getExercise().getId(),
                                it.getExercise().getName(),
                                it.getPosition(),
                                it.getSets(),
                                it.getReps(),
                                it.getRestTime()))
                        .toList());
    }
}
