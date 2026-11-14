package com.forja.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "routines")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Routine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private AppUser user;

    /** Esporte foco que originou a rotina. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sport_id")
    private Sport sport;

    @Column(nullable = false, length = 120)
    private String name;

    /** Data local para a qual esta recomendação foi planejada. */
    @Column(name = "plan_date")
    private LocalDate planDate;

    @Column(name = "readiness_score")
    private Integer readinessScore;

    @Column(name = "readiness_adjusted", nullable = false)
    @Builder.Default
    private boolean readinessAdjusted = false;

    @Column(name = "requires_review", nullable = false)
    @Builder.Default
    private boolean requiresReview = false;

    @Column(name = "explanation", columnDefinition = "text")
    private String explanation;

    @Column(name = "rest_day", nullable = false)
    @Builder.Default
    private boolean restDay = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    /** [UE-29] Token público de leitura para QR/link de compartilhamento; nulo até ser gerado. */
    @Column(name = "share_token", length = 32, unique = true)
    private String shareToken;

    @OneToMany(mappedBy = "routine", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position")
    @Builder.Default
    private List<RoutineItem> items = new ArrayList<>();
}
