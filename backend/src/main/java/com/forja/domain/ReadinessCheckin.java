package com.forja.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "readiness_checkins", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "checkin_date"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ReadinessCheckin {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private AppUser user;

    @Column(name = "checkin_date", nullable = false)
    private LocalDate checkinDate;
    @Column(name = "sleep_quality", nullable = false) private int sleepQuality;
    @Column(nullable = false) private int fatigue;
    @Column(nullable = false) private int stress;
    @Column(nullable = false) private int soreness;
    @Column(name = "pain_area", length = 80) private String painArea;
    @Column(name = "pain_level", nullable = false) private int painLevel;
    @Column(columnDefinition = "text") private String notes;
    @Column(name = "created_at", nullable = false, updatable = false) @Builder.Default private Instant createdAt = Instant.now();
    @Column(name = "updated_at", nullable = false) @Builder.Default private Instant updatedAt = Instant.now();

    /** [UE-42] Score de prontidão derivado (6–30); mesma fórmula exibida no check-in diário. */
    public int getReadinessScore() {
        return sleepQuality * 2 + (6 - fatigue) * 2 + (6 - stress) + (6 - soreness);
    }
}
