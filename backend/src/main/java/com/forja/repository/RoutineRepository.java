package com.forja.repository;

import com.forja.domain.Routine;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.time.Instant;

public interface RoutineRepository extends JpaRepository<Routine, Long> {

    List<Routine> findByUserIdOrderByCreatedAtDesc(Long userId);

    // [UE-29] Leitura pública por token de compartilhamento.
    java.util.Optional<Routine> findByShareToken(String shareToken);

    java.util.Optional<Routine> findFirstByUserIdAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc(
            Long userId, Instant startOfDay);

    java.util.Optional<Routine> findByUserIdAndPlanDate(Long userId, java.time.LocalDate planDate);
}
