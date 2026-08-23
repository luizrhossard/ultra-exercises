package com.forja.repository;

import com.forja.domain.SessionStatus;
import com.forja.domain.TrainingSession;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface TrainingSessionRepository extends JpaRepository<TrainingSession, Long> {
    @EntityGraph(attributePaths = {"sport", "routine", "items", "items.exercise"})
    List<TrainingSession> findByUserIdOrderByScheduledAtDesc(Long userId);
    @EntityGraph(attributePaths = {"sport", "routine", "items", "items.exercise"})
    Optional<TrainingSession> findByIdAndUserId(Long id, Long userId);

    // [UE-42] Histórico paginado do progresso; janela opcional por scheduled_at.
    @EntityGraph(attributePaths = {"sport", "routine", "items", "items.exercise"})
    Page<TrainingSession> findByUserIdAndScheduledAtGreaterThanEqualAndScheduledAtLessThan(
            Long userId, Instant startInclusive, Instant endExclusive, Pageable pageable);

    // [UE-42] Sessões concluídas numa janela (resumo semanal).
    @EntityGraph(attributePaths = {"sport", "routine", "items", "items.exercise"})
    List<TrainingSession> findByUserIdAndStatusAndCompletedAtGreaterThanEqualAndCompletedAtLessThan(
            Long userId, SessionStatus status, Instant startInclusive, Instant endExclusive);
}
