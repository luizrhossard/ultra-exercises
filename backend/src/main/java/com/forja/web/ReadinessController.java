package com.forja.web;

import com.forja.domain.AppUser;
import com.forja.domain.ReadinessCheckin;
import com.forja.repository.AppUserRepository;
import com.forja.repository.ReadinessCheckinRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;

/** Check-in diário: não diagnostica; sinaliza quando a sessão deve ser revista por um profissional. */
@RestController
@RequestMapping("/api/readiness")
@RequiredArgsConstructor
public class ReadinessController {
    private final ReadinessCheckinRepository checkins;
    private final AppUserRepository users;

    record CheckinRequest(
            @Min(1) @Max(5) int sleepQuality,
            @Min(1) @Max(5) int fatigue,
            @Min(1) @Max(5) int stress,
            @Min(1) @Max(5) int soreness,
            @Size(max = 80) String painArea,
            @Min(0) @Max(10) int painLevel,
            @Size(max = 2000) String notes) {}

    record CheckinDto(LocalDate date, int sleepQuality, int fatigue, int stress, int soreness,
                      String painArea, int painLevel, String notes, int readinessScore,
                      boolean requiresReview) {}

    @GetMapping("/today")
    @Transactional(readOnly = true)
    CheckinDto today(Authentication auth) {
        var user = currentUser(auth);
        return checkins.findByUserIdAndCheckinDate(user.getId(), LocalDate.now())
                .map(ReadinessController::toDto)
                .orElse(null);
    }

    @PutMapping("/today")
    @Transactional
    CheckinDto saveToday(@Valid @RequestBody CheckinRequest request, Authentication auth) {
        var user = currentUser(auth);
        var checkin = checkins.findByUserIdAndCheckinDate(user.getId(), LocalDate.now())
                .orElseGet(() -> ReadinessCheckin.builder().user(user).checkinDate(LocalDate.now()).build());
        checkin.setSleepQuality(request.sleepQuality());
        checkin.setFatigue(request.fatigue());
        checkin.setStress(request.stress());
        checkin.setSoreness(request.soreness());
        checkin.setPainArea(blankToNull(request.painArea()));
        checkin.setPainLevel(request.painLevel());
        checkin.setNotes(blankToNull(request.notes()));
        checkin.setUpdatedAt(Instant.now());
        return toDto(checkins.save(checkin));
    }

    private AppUser currentUser(Authentication auth) {
        return users.findByEmail(auth.getName()).orElseThrow();
    }

    private static CheckinDto toDto(ReadinessCheckin c) {
        int score = c.getSleepQuality() * 2 + (6 - c.getFatigue()) * 2 + (6 - c.getStress())
                + (6 - c.getSoreness());
        boolean requiresReview = c.getPainLevel() >= 5 || c.getFatigue() >= 5 || c.getSoreness() >= 5;
        return new CheckinDto(c.getCheckinDate(), c.getSleepQuality(), c.getFatigue(), c.getStress(), c.getSoreness(),
                c.getPainArea(), c.getPainLevel(), c.getNotes(), score, requiresReview);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
