package com.forja.web;

import com.forja.domain.AppUser;
import com.forja.domain.Routine;
import com.forja.repository.AppUserRepository;
import com.forja.repository.ExerciseRepository;
import com.forja.repository.ExerciseSportRepository;
import com.forja.repository.RoutineRepository;
import com.forja.service.RoutineGeneratorService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.security.SecureRandom;
import java.util.Base64;
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
    private final ExerciseSportRepository exerciseSports;

    /** [UE-29] Base pública do frontend montada no link/QR compartilhado. */
    @Value("${forja.share.base-url:http://localhost:3000}")
    private String baseUrl;

    record GenerateRequest(@NotNull Long sportId, @jakarta.validation.constraints.FutureOrPresent LocalDate planDate) {
    }

    record AddItemRequest(@NotNull Long exerciseId) {
    }

    record ReplaceItemRequest(@NotNull Long replacementExerciseId) {}

    record AlternativeDto(Long exerciseId, String exerciseName) {}

    record ItemPatch(@jakarta.validation.constraints.Min(1) @jakarta.validation.constraints.Max(10) Integer sets,
                     @jakarta.validation.constraints.Min(0) @jakarta.validation.constraints.Max(900) Integer restTime) {
    }

    record ItemDto(Long exerciseId, String exerciseName, int position,
                   int sets, String reps, int restTime) {
    }

    record RoutineDto(Long id, String name, String sportCode, String sportName,
                      Instant createdAt, List<ItemDto> items, Integer readinessScore,
                      Boolean readinessAdjusted, Boolean requiresReview, String reviewRecommendation,
                      String explanation, Boolean restDay) {
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
        var result = generator.generateWithReadiness(auth.getName(), request.sportId(), request.planDate());
        return toDto(result);
    }

    /** [UE-29] Gera (uma vez) e devolve o link público de leitura da rotina para QR/compartilhamento. */
    @PostMapping("/{id}/share")
    @Transactional
    ShareLinkDto share(@PathVariable Long id, Authentication auth) {
        var routine = ownedRoutine(id, auth)
                .orElseThrow(() -> new NoSuchElementException("Rotina não encontrada"));
        if (routine.getShareToken() == null) {
            var bytes = new byte[16];
            new SecureRandom().nextBytes(bytes);
            routine.setShareToken(Base64.getUrlEncoder().withoutPadding().encodeToString(bytes));
            routines.save(routine);
        }
        return new ShareLinkDto(baseUrl + "/compartilhada/" + routine.getShareToken());
    }

    record ShareLinkDto(String url) {}

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
                                         @Valid @RequestBody ItemPatch patch,
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

    @GetMapping("/{id}/items/{exerciseId}/alternatives")
    @Transactional(readOnly = true)
    List<AlternativeDto> alternatives(@PathVariable Long id, @PathVariable Long exerciseId, Authentication auth) {
        var routine = ownedRoutine(id, auth).orElseThrow(() -> new NoSuchElementException("Rotina não encontrada"));
        var current = routine.getItems().stream().filter(item -> item.getExercise().getId().equals(exerciseId))
                .findFirst().orElseThrow(() -> new NoSuchElementException("Exercício não encontrado na rotina"));
        var usedIds = routine.getItems().stream().map(item -> item.getExercise().getId()).collect(java.util.stream.Collectors.toSet());
        return exerciseSports.findBySportIdIn(List.of(routine.getSport().getId())).stream()
                .map(link -> link.getExercise())
                .filter(exercise -> exercise.getCategory() == current.getExercise().getCategory())
                .filter(exercise -> !usedIds.contains(exercise.getId()))
                .distinct()
                .limit(10)
                .map(exercise -> new AlternativeDto(exercise.getId(), exercise.getName()))
                .toList();
    }

    @PutMapping("/{id}/items/{exerciseId}/replace")
    @Transactional
    RoutineDto replaceItem(@PathVariable Long id, @PathVariable Long exerciseId,
                           @Valid @RequestBody ReplaceItemRequest request, Authentication auth) {
        var routine = ownedRoutine(id, auth).orElseThrow(() -> new NoSuchElementException("Rotina não encontrada"));
        var current = routine.getItems().stream().filter(item -> item.getExercise().getId().equals(exerciseId))
                .findFirst().orElseThrow(() -> new NoSuchElementException("Exercício não encontrado na rotina"));
        var replacement = exercises.findById(request.replacementExerciseId())
                .orElseThrow(() -> new NoSuchElementException("Exercício alternativo não encontrado"));
        boolean alreadyUsed = routine.getItems().stream()
                .anyMatch(item -> item.getExercise().getId().equals(replacement.getId()));
        if (alreadyUsed || replacement.getCategory() != current.getExercise().getCategory()
                || exerciseSports.findByExerciseIdAndSportId(replacement.getId(), routine.getSport().getId()).isEmpty()) {
            throw new IllegalArgumentException("Escolha um exercício alternativo disponível para este esporte e categoria.");
        }
        var replacementItem = com.forja.domain.RoutineItem.builder().routine(routine).exercise(replacement)
                .position(current.getPosition()).sets(current.getSets()).reps(current.getReps())
                .restTime(current.getRestTime()).build();
        routine.getItems().remove(current);
        routine.getItems().add(replacementItem);
        return toDto(routines.save(routine));
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
        return toDto(r, r.getReadinessScore(), r.isReadinessAdjusted(), r.isRequiresReview(),
                r.isRequiresReview() ? "Revise a sessão com um profissional antes de iniciar." : null,
                r.getExplanation(), r.isRestDay());
    }

    private static RoutineDto toDto(RoutineGeneratorService.GenerationResult result) {
        return toDto(result.routine(), result.readinessScore(), result.readinessAdjusted(),
                result.requiresReview(), result.reviewRecommendation(), result.explanation(), result.routine().isRestDay());
    }

    private static RoutineDto toDto(Routine r, Integer readinessScore, Boolean readinessAdjusted,
                                    Boolean requiresReview, String reviewRecommendation) {
        return toDto(r, readinessScore, readinessAdjusted, requiresReview, reviewRecommendation, null, r.isRestDay());
    }

    private static RoutineDto toDto(Routine r, Integer readinessScore, Boolean readinessAdjusted,
                                    Boolean requiresReview, String reviewRecommendation, String explanation, Boolean restDay) {
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
                        .toList(),
                readinessScore,
                readinessAdjusted,
                requiresReview,
                reviewRecommendation,
                explanation,
                restDay);
    }
}
