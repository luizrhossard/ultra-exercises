package com.forja.repository;

import com.forja.domain.ReadinessCheckin;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.Optional;

public interface ReadinessCheckinRepository extends JpaRepository<ReadinessCheckin, Long> {
    Optional<ReadinessCheckin> findByUserIdAndCheckinDate(Long userId, LocalDate date);
}
