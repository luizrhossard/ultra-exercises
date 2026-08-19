package com.forja.domain;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;

/** Item de rotina. {@code reps} é String de propósito: "8 reps", "40 s", "AMRAP"… */
@Entity
@Table(name = "routine_items")
@IdClass(RoutineItem.Id.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoutineItem {

    @jakarta.persistence.Id
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "routine_id")
    private Routine routine;

    @jakarta.persistence.Id
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exercise_id")
    private Exercise exercise;

    @Column(nullable = false)
    private int position;

    @Column(nullable = false)
    private int sets;

    @Column(nullable = false, length = 24)
    private String reps;

    @Column(name = "rest_time", nullable = false)
    private int restTime;

    /** Chave composta (routine_id, exercise_id). */
    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Id implements Serializable {
        private Long routine;
        private Long exercise;
    }
}
