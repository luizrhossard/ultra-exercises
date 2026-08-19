package com.forja.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "training_sessions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TrainingSession {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id") private AppUser user;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "routine_id") private Routine routine;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "sport_id") private Sport sport;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) @Builder.Default private SessionStatus status = SessionStatus.PLANNED;
    @Column(name = "scheduled_at", nullable = false) @Builder.Default private Instant scheduledAt = Instant.now();
    @Column(name = "started_at") private Instant startedAt;
    @Column(name = "completed_at") private Instant completedAt;
    @Column(name = "duration_minutes") private Integer durationMinutes;
    @Column(name = "session_rpe") private Integer sessionRpe;
    @Column(columnDefinition = "text") private String notes;
    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true) @OrderBy("position") @Builder.Default
    private List<TrainingSessionItem> items = new ArrayList<>();
}
