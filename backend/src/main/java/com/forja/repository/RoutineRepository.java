package com.forja.repository;

import com.forja.domain.Routine;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RoutineRepository extends JpaRepository<Routine, Long> {

    List<Routine> findByUserIdOrderByCreatedAtDesc(Long userId);

    // [UE-29] Leitura pública por token de compartilhamento.
    java.util.Optional<Routine> findByShareToken(String shareToken);
}
