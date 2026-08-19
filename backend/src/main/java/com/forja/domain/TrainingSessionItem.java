package com.forja.domain;

import jakarta.persistence.*;
import lombok.*;
import java.io.Serializable;
import java.math.BigDecimal;

@Entity
@Table(name = "training_session_items")
@IdClass(TrainingSessionItem.Id.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TrainingSessionItem {
    @jakarta.persistence.Id @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "session_id")
    private TrainingSession session;
    @jakarta.persistence.Id @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "exercise_id")
    private Exercise exercise;
    @Column(nullable = false) private int position;
    @Column(name = "prescribed_sets", nullable = false) private int prescribedSets;
    @Column(name = "prescribed_reps", nullable = false, length = 40) private String prescribedReps;
    @Column(name = "prescribed_rest_time", nullable = false) private int prescribedRestTime;
    @Column(name = "completed_sets") private Integer completedSets;
    @Column(name = "completed_reps", length = 40) private String completedReps;
    @Column(name = "load_kg", precision = 6, scale = 2) private BigDecimal loadKg;
    @Column(name = "item_rpe") private Integer itemRpe;
    @Column(name = "pain_level") private Integer painLevel;
    @Column(columnDefinition = "text") private String notes;

    @Getter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
    public static class Id implements Serializable { private Long session; private Long exercise; }
}
