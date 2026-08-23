package com.forja.web;

import com.forja.domain.AlertSettings;
import com.forja.domain.AppUser;
import com.forja.domain.SessionStatus;
import com.forja.domain.TrainingSession;
import com.forja.repository.AlertSettingsRepository;
import com.forja.repository.AppUserRepository;
import com.forja.repository.TrainingSessionRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * [UE-28 · onda 1] Alertas inteligentes de descanso, calculados no servidor a
 * partir do histórico real do atleta: frequência semanal excessiva e descanso
 * insuficiente entre sessões consecutivas que repetem o mesmo grupo muscular.
 * Push/e-mail ficam para uma onda futura. Nada aqui diagnostica — apenas
 * sinaliza, respeitando a sensibilidade configurada pelo atleta.
 */
@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
public class AlertsController {

    private static final int FREQUENCY_WINDOW_DAYS = 7;
    private static final int LOOKBACK_DAYS = 14;

    private final TrainingSessionRepository sessions;
    private final AlertSettingsRepository settingsRepo;
    private final AppUserRepository users;

    record AlertDto(String type, String message) {}

    record AlertsResponseDto(boolean enabled, int maxSessionsPerWeek, int minRestHours,
                             List<AlertDto> alerts) {}

    record SettingsDto(boolean enabled, int maxSessionsPerWeek, int minRestHours) {}

    record SettingsRequest(@NotNull Boolean enabled,
                           @Min(1) @Max(14) Integer maxSessionsPerWeek,
                           @Min(0) @Max(96) Integer minRestHours) {}

    @GetMapping("/settings")
    @Transactional(readOnly = true)
    SettingsDto settings(Authentication auth) {
        return toDto(settingsFor(currentUser(auth)));
    }

    @PutMapping("/settings")
    @Transactional
    SettingsDto updateSettings(@Valid @RequestBody SettingsRequest request, Authentication auth) {
        var s = settingsFor(currentUser(auth));
        s.setEnabled(request.enabled());
        if (request.maxSessionsPerWeek() != null) s.setMaxSessionsPerWeek(request.maxSessionsPerWeek());
        if (request.minRestHours() != null) s.setMinRestHours(request.minRestHours());
        return toDto(settingsRepo.save(s));
    }

    /** Avalia os alertas vigentes conforme a sensibilidade configurada. */
    @GetMapping
    @Transactional(readOnly = true)
    AlertsResponseDto alerts(Authentication auth) {
        var user = currentUser(auth);
        var s = settingsFor(user);
        List<AlertDto> alerts = s.isEnabled()
                ? evaluate(user.getId(), s, ZoneId.systemDefault())
                : List.of();
        return new AlertsResponseDto(s.isEnabled(), s.getMaxSessionsPerWeek(), s.getMinRestHours(), alerts);
    }

    // ---- helpers ----

    private AlertSettings settingsFor(AppUser user) {
        return settingsRepo.findById(user.getId())
                .orElseGet(() -> AlertSettings.builder().userId(user.getId()).build());
    }

    private static SettingsDto toDto(AlertSettings s) {
        return new SettingsDto(s.isEnabled(), s.getMaxSessionsPerWeek(), s.getMinRestHours());
    }

    private List<AlertDto> evaluate(Long userId, AlertSettings settings, ZoneId zone) {
        var now = Instant.now();
        var completed = completedBetween(userId,
                LocalDate.now(zone).minusDays(LOOKBACK_DAYS),
                LocalDate.now(zone).plusDays(1), zone);

        record Info(Instant t, Set<String> muscles) {}
        List<Info> infos = completed.stream()
                .sorted(Comparator.comparing(TrainingSession::getCompletedAt).reversed())
                .map(s -> {
                    Set<String> muscles = new HashSet<>();
                    for (var item : s.getItems()) muscles.addAll(item.getExercise().getMuscleGroups());
                    return new Info(s.getCompletedAt() == null ? s.getScheduledAt() : s.getCompletedAt(), muscles);
                })
                .toList();

        List<AlertDto> alerts = new ArrayList<>();

        // Frequência: sessões concluídas na janela móvel de 7 dias.
        long last7 = infos.stream()
                .filter(i -> Duration.between(i.t(), now).toHours() < FREQUENCY_WINDOW_DAYS * 24L)
                .count();
        if (last7 > settings.getMaxSessionsPerWeek()) {
            alerts.add(new AlertDto("FREQUENCY",
                    ("Você treinou %d vezes nos últimos 7 dias (seu limite: %d). Considere um dia de recuperação.")
                            .formatted(last7, settings.getMaxSessionsPerWeek())));
        }

        // Descanso por grupo muscular entre sessões consecutivas que repetem o músculo.
        Map<String, Double> shortestGap = new LinkedHashMap<>();
        for (int i = 0; i < infos.size() - 1; i++) {
            for (int j = i + 1; j < infos.size(); j++) {
                double gapH = Duration.between(infos.get(j).t(), infos.get(i).t()).toMinutes() / 60.0;
                if (gapH >= settings.getMinRestHours()) break; // gaps só crescem para pares mais antigos
                for (String m : infos.get(i).muscles()) {
                    if (infos.get(j).muscles().contains(m)) {
                        shortestGap.merge(m, gapH, Math::min);
                    }
                }
            }
        }
        shortestGap.entrySet().stream()
                .sorted(Map.Entry.comparingByValue())
                .forEach(e -> alerts.add(new AlertDto("MUSCLE_REST",
                        ("Grupo '%s' treinado com apenas %.0fh de descanso desde a última vez (mínimo configurado: %dh).")
                                .formatted(e.getKey(), e.getValue(), settings.getMinRestHours()))));
        return alerts;
    }

    private List<TrainingSession> completedBetween(Long userId, LocalDate fromInclusive,
                                                   LocalDate toExclusiveEnd, ZoneId zone) {
        return sessions.findByUserIdAndStatusAndCompletedAtGreaterThanEqualAndCompletedAtLessThan(
                userId, SessionStatus.COMPLETED,
                fromInclusive.atStartOfDay(zone).toInstant(),
                toExclusiveEnd.atStartOfDay(zone).toInstant());
    }

    private AppUser currentUser(Authentication auth) {
        return users.findByEmail(auth.getName()).orElseThrow();
    }
}
