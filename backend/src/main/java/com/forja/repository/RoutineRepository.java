package com.forja.repository;

import com.forja.domain.Routine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

import java.util.List;
import java.time.Instant;

public interface RoutineRepository extends JpaRepository<Routine, Long> {

    List<Routine> findByUserIdOrderByCreatedAtDesc(Long userId);

    // [UE-29] Leitura pública por token de compartilhamento.
    java.util.Optional<Routine> findByShareToken(String shareToken);

    java.util.Optional<Routine> findFirstByUserIdAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc(
            Long userId, Instant startOfDay);

    @EntityGraph(attributePaths = {"sport", "items", "items.exercise"})
    java.util.Optional<Routine> findByUserIdAndPlanDate(Long userId, java.time.LocalDate planDate);
}
