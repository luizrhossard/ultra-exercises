package com.forja.domain;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;

/**
 * Associação N:N reificada entre exercício e esporte — o coração do produto.
 * Carrega o {@code relevanceScore} (1–5) e o {@code rationale}
 * ("por que este exercício ajuda neste esporte").
 */
@Entity
@Table(name = "exercise_sport")
@IdClass(ExerciseSport.Id.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExerciseSport {

    @jakarta.persistence.Id
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exercise_id")
    private Exercise exercise;

    @jakarta.persistence.Id
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sport_id")
    private Sport sport;

    @Column(name = "relevance_score", nullable = false)
    private int relevanceScore;

    @Column(columnDefinition = "text")
    private String rationale;

    /** Chave composta (exercise_id, sport_id). */
    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Id implements Serializable {
        private Long exercise;
        private Long sport;
    }
}
