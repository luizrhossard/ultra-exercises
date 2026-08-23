package com.forja.repository;

import com.forja.domain.SessionStatus;
import com.forja.domain.TrainingSession;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface TrainingSessionRepository extends JpaRepository<TrainingSession, Long>,
        JpaSpecificationExecutor<TrainingSession> {

    @EntityGraph(attributePaths = {"sport", "routine", "items", "items.exercise"})
    List<TrainingSession> findByUserIdOrderByScheduledAtDesc(Long userId);
    @EntityGraph(attributePaths = {"sport", "routine", "items", "items.exercise"})
    Optional<TrainingSession> findByIdAndUserId(Long id, Long userId);

    // [UE-42] Sessões concluídas numa janela (resumo semanal).
    @EntityGraph(attributePaths = {"sport", "routine", "items", "items.exercise"})
    List<TrainingSession> findByUserIdAndStatusAndCompletedAtGreaterThanEqualAndCompletedAtLessThan(
            Long userId, SessionStatus status, Instant startInclusive, Instant endExclusive);

    // [UE-30] Busca filtrada do histórico (Specifications); escopo sempre do usuário autenticado.
    @Override
    @EntityGraph(attributePaths = {"sport", "routine", "items", "items.exercise"})
    Page<TrainingSession> findAll(Specification<TrainingSession> spec, Pageable pageable);

    // [UE-30] Variante sem paginação para as estatísticas do período.
    @Override
    @EntityGraph(attributePaths = {"sport", "routine", "items", "items.exercise"})
    List<TrainingSession> findAll(Specification<TrainingSession> spec);

    // [UE-30] Exercícios distintos presentes no histórico do atleta (fonte do filtro).
    @Query("""
            select distinct ex.id, ex.name from TrainingSession s
            join s.items it join it.exercise ex
            where s.user.id = :userId
            order by ex.name
            """)
    List<Object[]> findDistinctExerciseOptions(Long userId);
}
