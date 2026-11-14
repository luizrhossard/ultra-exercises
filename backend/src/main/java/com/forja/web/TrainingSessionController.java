package com.forja.web;

import com.forja.domain.*;
import com.forja.repository.AppUserRepository;
import com.forja.repository.RoutineRepository;
import com.forja.repository.TrainingSessionRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Preserva uma cópia da prescrição e registra a execução real do atleta. */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TrainingSessionController {
    private final RoutineRepository routines;
    private final TrainingSessionRepository sessions;
    private final AppUserRepository users;

    record SessionPatch(SessionStatus status, @Min(1) @Max(600) Integer durationMinutes,
                        @Min(1) @Max(10) Integer sessionRpe, @Size(max = 2000) String notes) {}
    record ItemPatch(@Min(0) @Max(10) Integer completedSets, @Size(max = 40) String completedReps,
                     @Min(0) BigDecimal loadKg, @Min(1) @Max(10) Integer itemRpe,
                     @Min(0) @Max(10) Integer painLevel, @Size(max = 1000) String notes) {}
    record ItemDto(Long exerciseId, String exerciseName, int position, int prescribedSets,
                   String prescribedReps, int prescribedRestTime, Integer completedSets,
                   String completedReps, BigDecimal loadKg, Integer itemRpe, Integer painLevel, String notes) {}
    record SessionDto(Long id, Long routineId, String routineName, String sportCode, String sportName,
                      SessionStatus status, Instant scheduledAt, Instant startedAt, Instant completedAt,
                      Integer durationMinutes, Integer sessionRpe, String notes, List<ItemDto> items) {}

    @PostMapping("/routines/{routineId}/sessions")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    SessionDto createFromRoutine(@PathVariable Long routineId, Authentication auth) {
        var user = currentUser(auth);
        var routine = routines.findById(routineId)
                .filter(r -> r.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new java.util.NoSuchElementException("Rotina não encontrada"));
        var planDate = routine.getPlanDate() == null ? LocalDate.now() : routine.getPlanDate();
        var existing = sessions.findByUserIdAndPlanDate(user.getId(), planDate);
        if (existing.isPresent()) return toDto(existing.get());
        var session = TrainingSession.builder().user(user).routine(routine).sport(routine.getSport())
                .planDate(planDate).build();
        for (var item : routine.getItems()) {
            session.getItems().add(TrainingSessionItem.builder().session(session).exercise(item.getExercise())
                    .position(item.getPosition()).prescribedSets(item.getSets()).prescribedReps(item.getReps())
                    .prescribedRestTime(item.getRestTime()).build());
        }
        return toDto(sessions.save(session));
    }

    @GetMapping("/sessions")
    @Transactional(readOnly = true)
    List<SessionDto> mine(Authentication auth) {
        return sessions.findByUserIdOrderByScheduledAtDesc(currentUser(auth).getId()).stream()
                .map(TrainingSessionController::toDto).toList();
    }

    @PostMapping("/sessions/{id}/start")
    @Transactional
    ResponseEntity<SessionDto> start(@PathVariable Long id, Authentication auth) {
        return owned(id, auth).map(session -> {
            if (session.getStatus() == SessionStatus.PLANNED || session.getStatus() == SessionStatus.INTERRUPTED) {
                session.setStatus(SessionStatus.IN_PROGRESS);
                if (session.getStartedAt() == null) session.setStartedAt(Instant.now());
            }
            return ResponseEntity.ok(toDto(sessions.save(session)));
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PatchMapping("/sessions/{id}")
    @Transactional
    ResponseEntity<SessionDto> patch(@PathVariable Long id, @Valid @RequestBody SessionPatch patch,
                                     Authentication auth) {
        return owned(id, auth).map(session -> {
            if (patch.status() != null) {
                if (!allowedTransition(session.getStatus(), patch.status())) {
                    throw new IllegalArgumentException("Não é possível alterar uma sessão encerrada.");
                }
                session.setStatus(patch.status());
                if (patch.status() == SessionStatus.COMPLETED && session.getCompletedAt() == null) {
                    session.setCompletedAt(Instant.now());
                }
            }
            if (patch.durationMinutes() != null) session.setDurationMinutes(patch.durationMinutes());
            if (patch.sessionRpe() != null) session.setSessionRpe(patch.sessionRpe());
            if (patch.notes() != null) session.setNotes(patch.notes().trim());
            return ResponseEntity.ok(toDto(sessions.save(session)));
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PatchMapping("/sessions/{id}/items/{exerciseId}")
    @Transactional
    ResponseEntity<SessionDto> patchItem(@PathVariable Long id, @PathVariable Long exerciseId,
                                         @Valid @RequestBody ItemPatch patch, Authentication auth) {
        return owned(id, auth).map(session -> {
            session.getItems().stream().filter(item -> item.getExercise().getId().equals(exerciseId)).findFirst()
                    .ifPresent(item -> apply(item, patch));
            return ResponseEntity.ok(toDto(sessions.save(session)));
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    private void apply(TrainingSessionItem item, ItemPatch patch) {
        if (patch.completedSets() != null) item.setCompletedSets(patch.completedSets());
        if (patch.completedReps() != null) item.setCompletedReps(patch.completedReps().trim());
        if (patch.loadKg() != null) item.setLoadKg(patch.loadKg());
        if (patch.itemRpe() != null) item.setItemRpe(patch.itemRpe());
        if (patch.painLevel() != null) item.setPainLevel(patch.painLevel());
        if (patch.notes() != null) item.setNotes(patch.notes().trim());
    }

    private AppUser currentUser(Authentication auth) { return users.findByEmail(auth.getName()).orElseThrow(); }
    private boolean allowedTransition(SessionStatus current, SessionStatus next) {
        if (current == next) return true;
        return switch (current) {
            case PLANNED -> next == SessionStatus.IN_PROGRESS || next == SessionStatus.SKIPPED || next == SessionStatus.INTERRUPTED;
            case IN_PROGRESS -> next == SessionStatus.COMPLETED || next == SessionStatus.INTERRUPTED || next == SessionStatus.SKIPPED;
            case INTERRUPTED -> next == SessionStatus.IN_PROGRESS || next == SessionStatus.COMPLETED || next == SessionStatus.SKIPPED;
            case COMPLETED, SKIPPED -> false;
        };
    }
    private java.util.Optional<TrainingSession> owned(Long id, Authentication auth) {
        return sessions.findByIdAndUserId(id, currentUser(auth).getId());
    }
    private static SessionDto toDto(TrainingSession s) {
        return new SessionDto(s.getId(), s.getRoutine() == null ? null : s.getRoutine().getId(),
                s.getRoutine() == null ? null : s.getRoutine().getName(), s.getSport().getCode(), s.getSport().getName(),
                s.getStatus(), s.getScheduledAt(), s.getStartedAt(), s.getCompletedAt(), s.getDurationMinutes(),
                s.getSessionRpe(), s.getNotes(), s.getItems().stream().map(item -> new ItemDto(item.getExercise().getId(),
                item.getExercise().getName(), item.getPosition(), item.getPrescribedSets(), item.getPrescribedReps(),
                item.getPrescribedRestTime(), item.getCompletedSets(), item.getCompletedReps(), item.getLoadKg(),
                item.getItemRpe(), item.getPainLevel(), item.getNotes())).toList());
    }
}
