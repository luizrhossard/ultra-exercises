package com.forja.domain;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;

/** Esportes praticados pelo usuário, com nível de prática. */
@Entity
@Table(name = "user_sport")
@IdClass(UserSport.Id.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserSport {

    @jakarta.persistence.Id
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private AppUser user;

    @jakarta.persistence.Id
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sport_id")
    private Sport sport;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private SportLevel level = SportLevel.RECREATIONAL;

    /** Chave composta (user_id, sport_id). */
    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Id implements Serializable {
        private Long user;
        private Long sport;
    }
}
