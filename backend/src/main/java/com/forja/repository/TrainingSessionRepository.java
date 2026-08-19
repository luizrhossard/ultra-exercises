package com.forja.repository;

import com.forja.domain.TrainingSession;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface TrainingSessionRepository extends JpaRepository<TrainingSession, Long> {
    @EntityGraph(attributePaths = {"sport", "routine", "items", "items.exercise"})
    List<TrainingSession> findByUserIdOrderByScheduledAtDesc(Long userId);
    @EntityGraph(attributePaths = {"sport", "routine", "items", "items.exercise"})
    Optional<TrainingSession> findByIdAndUserId(Long id, Long userId);
}
