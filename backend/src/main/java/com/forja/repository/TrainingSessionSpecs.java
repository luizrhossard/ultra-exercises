package com.forja.repository;

import com.forja.domain.TrainingSession;
import com.forja.domain.TrainingSessionItem;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;

/**
 * [UE-30] Filtros combináveis do histórico de treinos — sempre ancorados no
 * usuário autenticado. Métodos fábrica devolvem {@code null} quando o filtro
 * está ausente; quem compõe ignora partes nulas (sem binding de nulos no SQL).
 */
public final class TrainingSessionSpecs {

    private TrainingSessionSpecs() {
    }

    public static Specification<TrainingSession> ownedBy(Long userId) {
        return (root, query, cb) -> cb.equal(root.get("user").get("id"), userId);
    }

    /** Janela por scheduledAt: [start, end). Qualquer limite pode ser nulo. */
    public static Specification<TrainingSession> scheduledBetween(Instant start, Instant end) {
        return (root, query, cb) -> {
            var spec = cb.conjunction();
            if (start != null) spec = cb.and(spec, cb.greaterThanOrEqualTo(root.get("scheduledAt"), start));
            if (end != null) spec = cb.and(spec, cb.lessThan(root.get("scheduledAt"), end));
            return spec;
        };
    }

    /** Busca textual em nome da rotina, do esporte e dos exercícios da sessão. */
    public static Specification<TrainingSession> matchesText(String q) {
        if (q == null) return null;
        String needle = "%" + q.toLowerCase() + "%";
        return (root, query, cb) -> {
            Join<Object, Object> routine = root.join("routine", JoinType.LEFT);
            var byRoutine = cb.like(cb.lower(cb.coalesce(routine.get("name"), "")), needle);
            var bySport = cb.like(cb.lower(root.get("sport").get("name")), needle);
            var item = root.join("items", JoinType.LEFT);
            var exercise = item.join("exercise", JoinType.LEFT);
            var byExercise = cb.like(cb.lower(exercise.get("name")), needle);
            return cb.or(byRoutine, bySport, byExercise);
        };
    }

    /** Sessão contém o exercício informado. */
    public static Specification<TrainingSession> hasExercise(Long exerciseId) {
        if (exerciseId == null) return null;
        return (root, query, cb) -> {
            Subquery<TrainingSessionItem> sub = query.subquery(TrainingSessionItem.class);
            var item = sub.from(TrainingSessionItem.class);
            sub.select(item);
            sub.where(cb.equal(item.get("session"), root),
                    cb.equal(item.get("exercise").get("id"), exerciseId));
            return cb.exists(sub);
        };
    }

    /** Sessão contém algum exercício do grupo muscular (comparação insensível a caixa). */
    public static Specification<TrainingSession> hasMuscle(String muscle) {
        if (muscle == null) return null;
        String target = muscle.toLowerCase();
        return (root, query, cb) -> {
            Subquery<TrainingSessionItem> sub = query.subquery(TrainingSessionItem.class);
            var item = sub.from(TrainingSessionItem.class);
            Join<Object, Object> exercise = item.join("exercise");
            Join<Object, String> muscleGroup = exercise.join("muscleGroups");
            sub.select(item);
            sub.where(cb.equal(item.get("session"), root),
                    cb.equal(cb.lower(muscleGroup), target));
            return cb.exists(sub);
        };
    }

    /** Faixa de RPE da sessão (inclusive). Qualquer limite pode ser nulo. */
    public static Specification<TrainingSession> rpeBetween(Integer minRpe, Integer maxRpe) {
        return (root, query, cb) -> {
            var spec = cb.conjunction();
            if (minRpe != null) spec = cb.and(spec, cb.greaterThanOrEqualTo(root.get("sessionRpe"), minRpe));
            if (maxRpe != null) spec = cb.and(spec, cb.lessThanOrEqualTo(root.get("sessionRpe"), maxRpe));
            return spec;
        };
    }
}
