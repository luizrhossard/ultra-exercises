package com.forja.service;

import com.forja.domain.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import static org.assertj.core.api.Assertions.*;

class TrainingPersonalizationTest {
    private final Instant now = Instant.parse("2026-11-16T00:00:00Z");
    private final Exercise squat = Exercise.builder().id(1L).name("Agachamento")
            .category(ExerciseCategory.FORCA).muscleGroups(List.of("quadriceps")).build();

    private TrainingSessionItem performance(int prescribed, int completed, Integer rpe, Integer pain) {
        return TrainingSessionItem.builder().exercise(squat).prescribedSets(prescribed)
                .completedSets(completed).prescribedReps("8 reps").completedReps("8 reps")
                .loadKg(java.math.BigDecimal.TEN)
                .itemRpe(rpe).painLevel(pain).build();
    }

    private TrainingSession session(int hoursAgo, TrainingSessionItem item) {
        return TrainingSession.builder().status(SessionStatus.COMPLETED)
                .completedAt(now.minus(hoursAgo, ChronoUnit.HOURS)).items(List.of(item)).build();
    }

    private ReadinessCheckin checkin() {
        return ReadinessCheckin.builder().sleepQuality(4).fatigue(2).stress(2).soreness(2).build();
    }

    private TrainingPersonalization policy(ReadinessCheckin readiness, TrainingSession... sessions) {
        return new TrainingPersonalization(SportLevel.RECREATIONAL, readiness, List.of(sessions), now);
    }

    @Test void coldStartUsesLevelWithoutInventingProgress() {
        assertThat(policy(null).prescribe(squat).sets()).isEqualTo(3);
        var competitive = new TrainingPersonalization(SportLevel.COMPETITIVE, null, List.of(), now);
        assertThat(competitive.prescribe(squat).sets()).isEqualTo(4);
        assertThat(policy(null).summary()).contains("Sem histórico", "condição atual desconhecida");
    }

    @Test void twoRecordedSuccessesAllowOneSetOfProgression() {
        var policy = policy(checkin(), session(72, performance(3, 3, 6, 0)), session(120, performance(3, 3, 7, 0)));
        assertThat(policy.prescribe(squat).sets()).isEqualTo(4);
        assertThat(policy.prescribe(squat).reason()).contains("Progressão");
    }

    @Test void missingEffortOrPainDoesNotAllowProgression() {
        var policy = policy(null, session(72, performance(3, 3, null, null)), session(120, performance(3, 3, 6, 0)));
        assertThat(policy.prescribe(squat).sets()).isEqualTo(3);
    }

    @Test void differentOrUnknownLoadsDoNotAllowStrengthProgression() {
        var last = performance(3, 3, 6, 0);
        last.setLoadKg(java.math.BigDecimal.ONE);
        assertThat(policy(null, session(72, last), session(120, performance(3, 3, 6, 0)))
                .prescribe(squat).sets()).isEqualTo(3);
        last.setLoadKg(null);
        assertThat(policy(null, session(72, last), session(120, performance(3, 3, 6, 0)))
                .prescribe(squat).sets()).isEqualTo(3);
    }

    @Test void advancedExercisesAreExcludedForRecreationalAthletes() {
        squat.setDifficulty(ExerciseDifficulty.AVANCADO);
        assertThat(policy(null).eligible(squat)).isFalse();
    }

    @Test void missedRepetitionsDoNotAllowProgression() {
        var last = performance(3, 3, 6, 0);
        last.setCompletedReps("5 reps");
        assertThat(policy(null, session(72, last), session(120, performance(3, 3, 6, 0)))
                .prescribe(squat).sets()).isEqualTo(3);
    }

    @Test void highEffortReducesSetsAndIncreasesRest() {
        var prescription = policy(null, session(72, performance(3, 3, 9, 0))).prescribe(squat);
        assertThat(prescription.sets()).isEqualTo(2);
        assertThat(prescription.rest()).isEqualTo(150);
    }

    @Test void incompleteSetsReduceNextPrescription() {
        assertThat(policy(null, session(72, performance(4, 2, 6, 0))).prescribe(squat).sets()).isEqualTo(1);
    }

    @Test void fatigueChangesVolumeAndRemovesPlyometrics() {
        var readiness = checkin();
        readiness.setFatigue(5);
        var policy = policy(readiness);
        assertThat(policy.targetSize()).isEqualTo(5);
        assertThat(policy.prescribe(squat).sets()).isEqualTo(2);
        assertThat(policy.eligible(Exercise.builder().id(2L).category(ExerciseCategory.PLIOMETRIA).build())).isFalse();
    }

    @Test void severePainBlocksAutomaticGeneration() {
        var readiness = checkin();
        readiness.setPainLevel(5);
        assertThatThrownBy(() -> policy(readiness)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("revisão");
    }

    @Test void recentlyPainfulExercisesAreExcludedEvenIfUnperformed() {
        assertThat(policy(null, session(72, performance(3, 0, null, 2))).eligible(squat)).isFalse();
        assertThat(policy(null, session(15 * 24, performance(3, 3, 6, 2))).eligible(squat)).isTrue();
    }

    @Test void recentExposureLowersRankingAndVolume() {
        var policy = policy(null, session(24, performance(3, 3, 6, 0)));
        assertThat(policy.adjustment(squat)).isNegative();
        assertThat(policy.prescribe(squat).sets()).isEqualTo(2);
        var alternative = Exercise.builder().id(2L).category(ExerciseCategory.FORCA)
                .muscleGroups(List.of("peitoral")).build();
        assertThat(policy.adjustment(alternative)).isGreaterThan(policy.adjustment(squat));
    }

    @Test void unperformedItemsDoNotImplyExposure() {
        assertThat(policy(null, session(24, performance(3, 0, null, 0))).adjustment(squat)).isZero();
    }

    @Test void highSessionEffortReducesNextWorkout() {
        var session = session(24, performance(3, 3, 6, 0));
        session.setSessionRpe(9);
        assertThat(policy(null, session).targetSize()).isEqualTo(5);
    }

    @Test void progressionCannotCompoundWithoutBound() {
        assertThat(policy(null, session(72, performance(5, 5, 6, 0)), session(120, performance(5, 5, 6, 0)))
                .prescribe(squat).sets()).isEqualTo(4);
    }
}
