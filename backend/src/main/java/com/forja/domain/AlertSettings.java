package com.forja.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "alert_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AlertSettings {

    /** O próprio userId é a chave — uma linha por atleta. */
    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = true;

    @Column(name = "max_sessions_per_week", nullable = false)
    @Builder.Default
    private int maxSessionsPerWeek = 5;

    @Column(name = "min_rest_hours", nullable = false)
    @Builder.Default
    private int minRestHours = 48;
}
