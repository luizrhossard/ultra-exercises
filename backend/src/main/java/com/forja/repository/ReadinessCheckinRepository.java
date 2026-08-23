package com.forja.repository;

import com.forja.domain.ReadinessCheckin;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ReadinessCheckinRepository extends JpaRepository<ReadinessCheckin, Long> {
    Optional<ReadinessCheckin> findByUserIdAndCheckinDate(Long userId, LocalDate date);

    // [UE-42] Série temporal de prontidão em janela inclusiva, crescente por data.
    List<ReadinessCheckin> findByUserIdAndCheckinDateBetweenOrderByCheckinDateAsc(
            Long userId, LocalDate startInclusive, LocalDate endInclusive);
}
