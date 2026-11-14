package com.forja.web;

import com.forja.domain.*;
import com.forja.repository.AppUserRepository;
import com.forja.repository.SportRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Perfil do atleta e modalidades usadas pelo motor de recomendações. */
@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class ProfileController {
    private final AppUserRepository users;
    private final SportRepository sports;

    record SportSelection(@NotBlank String code, SportLevel level) {}
    record ProfileRequest(@Size(max = 80) String name,
                          @NotEmpty @Size(max = 8) List<@Valid SportSelection> sports,
                          @Size(max = 80) String goal,
                          @Size(max = 7) List<@Pattern(regexp = "MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY") String> availableDays,
                          @Min(15) @Max(240) Integer sessionDurationMinutes,
                          @Size(max = 500) String equipment,
                          @Size(max = 500) String preferences,
                          @Size(max = 1000) String limitations) {}
    record SportDto(String code, String name, SportLevel level) {}
    record ProfileDto(String email, String name, List<SportDto> sports, String goal,
                      List<String> availableDays, Integer sessionDurationMinutes,
                      String equipment, String preferences, String limitations) {}

    @GetMapping
    @Transactional(readOnly = true)
    ProfileDto mine(Authentication auth) { return toDto(currentUser(auth)); }

    @PutMapping
    @Transactional
    ProfileDto update(@Valid @RequestBody ProfileRequest request, Authentication auth) {
        var user = currentUser(auth);
        Set<String> codes = new LinkedHashSet<>();
        for (var choice : request.sports()) {
            if (!codes.add(choice.code())) throw new IllegalArgumentException("Esporte repetido: " + choice.code());
        }
        var selected = codes.stream().map(code -> sports.findByCode(code)
                        .orElseThrow(() -> new IllegalArgumentException("Esporte inválido: " + code)))
                .toList();
        user.setName(request.name() == null ? null : request.name().trim());
        if (request.goal() != null) user.setTrainingGoal(request.goal().trim());
        if (request.availableDays() != null) {
            var days = new LinkedHashSet<>(request.availableDays());
            user.setTrainingDays(String.join(",", days));
        }
        if (request.sessionDurationMinutes() != null) user.setSessionDurationMinutes(request.sessionDurationMinutes());
        if (request.equipment() != null) user.setAvailableEquipment(request.equipment().trim());
        if (request.preferences() != null) user.setTrainingPreferences(request.preferences().trim());
        if (request.limitations() != null) user.setTrainingLimitations(request.limitations().trim());
        user.getUserSports().clear();
        for (var sport : selected) {
            var choice = request.sports().stream().filter(s -> s.code().equals(sport.getCode())).findFirst().orElseThrow();
            user.getUserSports().add(UserSport.builder().user(user).sport(sport)
                    .level(choice.level() == null ? SportLevel.COMPETITIVE : choice.level()).build());
        }
        return toDto(users.save(user));
    }

    private AppUser currentUser(Authentication auth) {
        return users.findByEmail(auth.getName()).orElseThrow();
    }
    private static ProfileDto toDto(AppUser user) {
        var days = user.getTrainingDays() == null || user.getTrainingDays().isBlank()
                ? List.<String>of()
                : List.of(user.getTrainingDays().split(","));
        return new ProfileDto(user.getEmail(), user.getName(), user.getUserSports().stream()
                .map(link -> new SportDto(link.getSport().getCode(), link.getSport().getName(), link.getLevel()))
                .toList(), user.getTrainingGoal(), days, user.getSessionDurationMinutes(),
                user.getAvailableEquipment(), user.getTrainingPreferences(), user.getTrainingLimitations());
    }
}
