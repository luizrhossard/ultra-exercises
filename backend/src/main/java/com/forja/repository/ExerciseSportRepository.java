package com.forja.repository;

import com.forja.domain.ExerciseSport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ExerciseSportRepository extends JpaRepository<ExerciseSport, ExerciseSport.Id> {

    /**
     * Hot path do feed: todos os pares dos esportes do usuário, com exercício e
     * esporte já carregados (evita lazy loading fora da transação).
     * Coberto pelo índice (sport_id, relevance_score DESC).
     */
    @Query("""
            select es from ExerciseSport es
            join fetch es.exercise ex
            join fetch es.sport s
            where s.id in :sportIds
            order by es.relevanceScore desc
            """)
    List<ExerciseSport> findBySportIdIn(@Param("sportIds") Collection<Long> sportIds);

    Optional<ExerciseSport> findByExerciseIdAndSportId(Long exerciseId, Long sportId);
}
