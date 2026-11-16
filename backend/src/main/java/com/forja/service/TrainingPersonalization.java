package com.forja.service;

import com.forja.domain.*;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/** Deterministic, explainable policy. Only completed sessions and recorded effort count. */
final class TrainingPersonalization {
    private final SportLevel level;
    private final ReadinessCheckin readiness;
    private final List<TrainingSession> history;
    private final Map<Long, List<TrainingSessionItem>> performances = new HashMap<>();
    private final Set<Long> painful = new HashSet<>();
    private final Set<Long> recent = new HashSet<>();
    private final Set<String> recentMuscles = new HashSet<>();
    private final boolean reduced;

    TrainingPersonalization(SportLevel level, ReadinessCheckin readiness,
                            List<TrainingSession> history, Instant now) {
        this.level = level;
        this.readiness = readiness;
        this.history = history;
        if (readiness != null && readiness.getPainLevel() >= 5) {
            throw new IllegalArgumentException("A dor informada no check-in exige revisão. Procure orientação profissional antes de gerar um novo treino.");
        }
        for (var session : history) {
            long hours = Duration.between(session.getCompletedAt(), now).toHours();
            for (var item : session.getItems()) {
                long id = item.getExercise().getId();
                if (hours < 14 * 24 && item.getPainLevel() != null && item.getPainLevel() > 0) painful.add(id);
                // Unperformed items must not imply training exposure or successful completion.
                if (item.getCompletedSets() == null || item.getCompletedSets() <= 0) continue;
                performances.computeIfAbsent(id, k -> new ArrayList<>()).add(item);
                if (hours < 48) {
                    recent.add(id);
                    recentMuscles.addAll(item.getExercise().getMuscleGroups());
                }
            }
        }
        boolean recentHardSession = history.stream().anyMatch(s ->
                Duration.between(s.getCompletedAt(), now).toHours() < 48
                        && s.getSessionRpe() != null && s.getSessionRpe() >= 8);
        reduced = recentHardSession || (readiness != null && (readiness.getReadinessScore() < 18
                || readiness.getFatigue() >= 4 || readiness.getSoreness() >= 4
                || readiness.getStress() >= 4 || readiness.getSleepQuality() <= 2 || readiness.getPainLevel() > 0));
    }

    boolean eligible(Exercise exercise) {
        // Free-text pain locations cannot reliably be mapped to anatomy: do not guess.
        return !painful.contains(exercise.getId())
                && !(level == SportLevel.RECREATIONAL && "AVANCADO".equals(exercise.getDifficulty()))
                && !(reduced && exercise.getCategory() == ExerciseCategory.PLIOMETRIA);
    }

    int adjustment(Exercise exercise) {
        int score = recent.contains(exercise.getId()) ? -6 : 0;
        if (exercise.getMuscleGroups().stream().anyMatch(recentMuscles::contains)) score -= 2;
        if (performances.containsKey(exercise.getId()) && !recent.contains(exercise.getId())) score += 1;
        return score;
    }

    record Prescription(int sets, String reps, int rest, String reason) {}

    Prescription prescribe(Exercise exercise) {
        var preset = RoutineGeneratorService.PRESETS.get(exercise.getCategory());
        int baseSets = Math.max(1, preset.sets() - (level == SportLevel.RECREATIONAL ? 1 : 0));
        int sets = baseSets;
        int rest = preset.rest();
        String reason = "Selecionado pela relevância para o esporte; volume ajustado ao nível informado.";
        var previous = performances.getOrDefault(exercise.getId(), List.of());
        if (!previous.isEmpty()) {
            var last = previous.getFirst();
            // Never compound automatic progression beyond one set above the level baseline.
            sets = Math.clamp(last.getCompletedSets(), 1, Math.min(5, baseSets + 1));
            boolean difficult = (last.getItemRpe() != null && last.getItemRpe() >= 8)
                    || last.getCompletedSets() < last.getPrescribedSets();
            if (difficult) {
                sets = Math.max(1, sets - 1);
                rest += 30;
                reason = "Volume reduzido: esforço alto ou séries não concluídas na última execução.";
            } else if (previous.size() >= 2 && successful(previous.get(0)) && successful(previous.get(1))
                    && comparableWorkload(previous.get(0), previous.get(1))) {
                sets = Math.min(Math.min(5, baseSets + 1), sets + 1);
                reason = "Progressão limitada a uma série acima da base após duas execuções completas com carga comparável, sem dor e com esforço registrado até 7/10.";
            } else {
                reason = "Volume baseado nas séries realizadas na última execução; sem progressão por falta de duas execuções qualificadas.";
            }
        }
        if (reduced) {
            sets = Math.max(1, Math.min(sets, baseSets) - 1);
            rest = Math.max(rest, preset.rest() + 30);
            reason += " Volume reduzido pelo check-in ou por sessão intensa nas últimas 48 horas.";
        }
        if (recent.contains(exercise.getId())) {
            sets = Math.max(1, sets - 1);
            reason += " Repetição recente: volume adicionalmente reduzido.";
        }
        return new Prescription(sets, preset.reps(), rest, reason);
    }

    private boolean successful(TrainingSessionItem item) {
        return item.getCompletedSets() >= item.getPrescribedSets()
                && item.getCompletedReps() != null
                && item.getCompletedReps().trim().equalsIgnoreCase(item.getPrescribedReps().trim())
                && item.getItemRpe() != null && item.getItemRpe() <= 7
                && item.getPainLevel() != null && item.getPainLevel() == 0;
    }

    private boolean comparableWorkload(TrainingSessionItem first, TrainingSessionItem second) {
        if (first.getPrescribedSets() != second.getPrescribedSets()
                || !first.getPrescribedReps().equalsIgnoreCase(second.getPrescribedReps())) return false;
        if (first.getLoadKg() == null || second.getLoadKg() == null) {
            return first.getExercise().getCategory() != ExerciseCategory.FORCA
                    && first.getLoadKg() == null && second.getLoadKg() == null;
        }
        return first.getLoadKg().compareTo(second.getLoadKg()) == 0;
    }

    int targetSize() { return reduced ? 5 : 7; }

    String summary() {
        String levelName = switch (level) {
            case RECREATIONAL -> "recreativo";
            case AMATEUR -> "amador";
            case COMPETITIVE -> "competitivo";
            case PROFESSIONAL -> "profissional";
        };
        return "Nível " + levelName + ". " + history.size() + " sessões concluídas nos últimos 42 dias. "
                + (readiness == null ? "Sem check-in de hoje: condição atual desconhecida. " : "Check-in de hoje considerado. ")
                + (history.isEmpty() ? "Sem histórico recente: prescrição inicial, sem progressão automática. " : "Seleção considera exercícios e músculos trabalhados nas últimas 48 horas. ")
                + (reduced ? "Volume reduzido e pliometria removida por sinais de recuperação. " : "")
                + (!painful.isEmpty() ? "Exercícios com dor registrada nos últimos 14 dias foram excluídos. " : "")
                + (readiness != null && readiness.getPainLevel() > 0 ? "Há dor no check-in; a área descrita não foi interpretada automaticamente. Revise o treino com um profissional. " : "")
                + "A progressão usa séries, repetições, esforço e dor registrados; cargas não são aumentadas automaticamente.";
    }
}
