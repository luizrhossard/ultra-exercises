package com.forja.web;

import com.forja.domain.AppUser;
import com.forja.domain.SessionStatus;
import com.forja.domain.TrainingSession;
import com.forja.domain.TrainingSessionItem;
import com.forja.repository.AppUserRepository;
import com.forja.repository.ReadinessCheckinRepository;
import com.forja.repository.TrainingSessionRepository;
import com.forja.repository.TrainingSessionSpecs;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * [UE-42] Progresso do atleta: histórico paginado de sessões, resumo semanal e
 * tendência de prontidão. [UE-30] Histórico ganha filtros avançados (período,
 * exercício, grupo muscular, intensidade, busca textual), estatísticas por
 * período e lista de exercícios treinados. Todo acesso parte do usuário
 * autenticado (JWT) — nunca de identificador recebido pelo cliente.
 * Observabilidade fica no evento http do RequestLoggingFilter (método/path/
 * status/duração) com traceId no MDC; nenhum dado sensível (RPE, dor, notas,
 * payloads) é registrado em logs.
 */
@RestController
@RequestMapping("/api/progress")
@RequiredArgsConstructor
@Validated
public class ProgressController {

    static final int DEFAULT_PAGE_SIZE = 20;
    static final int MAX_PAGE_SIZE = 50;
    static final int DEFAULT_TREND_DAYS = 30;
    static final int MIN_TREND_DAYS = 7;
    static final int MAX_TREND_DAYS = 90;
    /** Limite de janela das estatísticas por período. */
    static final long MAX_STATS_DAYS = 366;

    private final TrainingSessionRepository sessions;
    private final ReadinessCheckinRepository checkins;
    private final AppUserRepository users;

    record SessionItemDto(Long id, String routineName, String sportName, SessionStatus status,
                          Instant scheduledAt, Instant completedAt, Integer durationMinutes,
                          Integer sessionRpe, Integer maxPainLevel, BigDecimal totalVolumeKg,
                          int exerciseCount, int setCount) {}

    record SessionsPageDto(List<SessionItemDto> items, int page, int size, long totalItems,
                           int totalPages, boolean hasNext) {}

    record WeekBlockDto(long sessionsCompleted, long totalDurationMinutes, BigDecimal totalVolumeKg,
                        Double averageRpe, Double averageReadiness) {}

    record WeeklySummaryDto(LocalDate periodStart, LocalDate periodEnd,
                            WeekBlockDto current, WeekBlockDto previous) {}

    record ReadinessPointDto(LocalDate date, int readiness) {}

    record ReadinessTrendDto(int periodDays, List<ReadinessPointDto> items) {}

    record HistoryExerciseDto(Long id, String name) {}

    record HistoryStatsDto(long totalSessions, long completedSessions, long totalDurationMinutes,
                           BigDecimal totalVolumeKg, Double averageRpe) {}

    record EvolutionPointDto(LocalDate date, BigDecimal maxLoadKg) {}

    record ExerciseEvolutionDto(Long exerciseId, int months, List<EvolutionPointDto> items) {}

    record VolumeBucketDto(LocalDate periodStart, BigDecimal totalVolumeKg) {}

    record VolumeTrendDto(String granularity, int months, List<VolumeBucketDto> items) {}

    record PerformanceBlockDto(long sessionsCompleted, long totalDurationMinutes,
                               BigDecimal totalVolumeKg, Double averageRpe) {}

    record PerformanceComparisonDto(int days, PerformanceBlockDto current, PerformanceBlockDto previous) {}

    /** Faixa de RPE por intensidade: LEVE 1–4 · MODERADA 5–7 · ALTA 8–10. */
    private record RpeBand(int min, int max) {}

    /** Histórico paginado com filtros opcionais; ordenação fixa (mais recente primeiro). */
    @GetMapping("/sessions")
    @Transactional(readOnly = true)
    SessionsPageDto sessions(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(MAX_PAGE_SIZE) int size,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) @Size(max = 80) String q,
            @RequestParam(required = false) @Positive Long exerciseId,
            @RequestParam(required = false) @Size(max = 40) String muscle,
            @RequestParam(required = false) @Pattern(regexp = "(?i)leve|moderada|alta") String intensity,
            Authentication auth) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new IllegalArgumentException("Período inválido: 'from' deve ser anterior ou igual a 'to'.");
        }
        var user = currentUser(auth);
        var zone = ZoneId.systemDefault();
        var band = rpeBand(intensity);
        var spec = historySpec(user.getId(), q, exerciseId, muscle, band, from, to, zone);
        Page<TrainingSession> result = sessions.findAll(spec,
                PageRequest.of(page, size, Sort.by(Sort.Order.desc("scheduledAt"), Sort.Order.desc("id"))));
        List<SessionItemDto> items = result.getContent().stream().map(ProgressController::toItem).toList();
        return new SessionsPageDto(items, result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages(), result.hasNext());
    }

    /** Exercícios distintos presentes no histórico do atleta (fonte do filtro de exercício). */
    @GetMapping("/history-exercises")
    @Transactional(readOnly = true)
    List<HistoryExerciseDto> historyExercises(Authentication auth) {
        var user = currentUser(auth);
        return sessions.findDistinctExerciseOptions(user.getId()).stream()
                .map(row -> new HistoryExerciseDto(((Number) row[0]).longValue(), (String) row[1]))
                .toList();
    }

    /** Estatísticas resumidas do período, respeitando os mesmos filtros do histórico. */
    @GetMapping("/history-stats")
    @Transactional(readOnly = true)
    HistoryStatsDto historyStats(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) @Size(max = 80) String q,
            @RequestParam(required = false) @Positive Long exerciseId,
            @RequestParam(required = false) @Size(max = 40) String muscle,
            @RequestParam(required = false) @Pattern(regexp = "(?i)leve|moderada|alta") String intensity,
            Authentication auth) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new IllegalArgumentException("Período inválido: 'from' deve ser anterior ou igual a 'to'.");
        }
        if (from != null && to != null && ChronoUnit.DAYS.between(from, to) > MAX_STATS_DAYS) {
            throw new IllegalArgumentException("Período máximo de 1 ano.");
        }
        var user = currentUser(auth);
        var zone = ZoneId.systemDefault();
        var band = rpeBand(intensity);
        List<TrainingSession> matched = sessions
                .findAll(historySpec(user.getId(), q, exerciseId, muscle, band, from, to, zone));

        var completed = matched.stream().filter(s -> s.getStatus() == SessionStatus.COMPLETED).toList();
        long duration = completed.stream()
                .map(TrainingSession::getDurationMinutes)
                .filter(java.util.Objects::nonNull)
                .mapToLong(Integer::longValue).sum();
        BigDecimal volume = BigDecimal.ZERO;
        double rpeSum = 0;
        long rpeCount = 0;
        for (var s : completed) {
            volume = volume.add(volumeOf(s.getItems()));
            if (s.getSessionRpe() != null) { rpeSum += s.getSessionRpe(); rpeCount++; }
        }
        return new HistoryStatsDto(matched.size(), completed.size(), duration,
                volume.setScale(2, RoundingMode.HALF_UP),
                rpeCount == 0 ? null : round1(rpeSum / rpeCount));
    }

    /** [UE-27] Evolução de carga máxima por sessão para um exercício treinado pelo atleta. */
    @GetMapping("/exercise-evolution")
    @Transactional(readOnly = true)
    ExerciseEvolutionDto exerciseEvolution(
            @RequestParam @Positive Long exerciseId,
            @RequestParam(defaultValue = "6") @Min(1) @Max(12) int months,
            Authentication auth) {
        var user = currentUser(auth);
        var zone = ZoneId.systemDefault();
        var completed = completedBetween(user.getId(), LocalDate.now().minusMonths(months),
                LocalDate.now().plusDays(1), zone);
        var byDate = new java.util.TreeMap<LocalDate, BigDecimal>();
        for (var s : completed) {
            BigDecimal max = null;
            for (var item : s.getItems()) {
                if (item.getExercise().getId().equals(exerciseId) && item.getLoadKg() != null) {
                    max = max == null ? item.getLoadKg() : max.max(item.getLoadKg());
                }
            }
            if (max != null) {
                byDate.merge(sessionDate(s, zone), max, BigDecimal::max);
            }
        }
        var items = byDate.entrySet().stream()
                .map(e -> new EvolutionPointDto(e.getKey(), e.getValue().setScale(2, RoundingMode.HALF_UP)))
                .toList();
        return new ExerciseEvolutionDto(exerciseId, months, items);
    }

    /** [UE-27] Volume total de treinos concluídos agrupado por semana ou mês. */
    @GetMapping("/volume-trend")
    @Transactional(readOnly = true)
    VolumeTrendDto volumeTrend(
            @RequestParam(defaultValue = "week") @Pattern(regexp = "(?i)week|month") String granularity,
            @RequestParam(defaultValue = "6") @Min(1) @Max(12) int months,
            Authentication auth) {
        var user = currentUser(auth);
        var zone = ZoneId.systemDefault();
        boolean monthly = granularity.equalsIgnoreCase("month");
        var completed = completedBetween(user.getId(), LocalDate.now().minusMonths(months),
                LocalDate.now().plusDays(1), zone);
        var byBucket = new java.util.TreeMap<LocalDate, BigDecimal>();
        for (var s : completed) {
            var d = sessionDate(s, zone);
            var bucketStart = monthly ? d.withDayOfMonth(1) : d.with(DayOfWeek.MONDAY);
            byBucket.merge(bucketStart, volumeOf(s.getItems()), BigDecimal::add);
        }
        var items = byBucket.entrySet().stream()
                .map(e -> new VolumeBucketDto(e.getKey(), e.getValue().setScale(2, RoundingMode.HALF_UP)))
                .toList();
        return new VolumeTrendDto(monthly ? "month" : "week", months, items);
    }

    /** [UE-27] Comparativo dos últimos N dias contra o período anterior equivalente. */
    @GetMapping("/performance-comparison")
    @Transactional(readOnly = true)
    PerformanceComparisonDto performanceComparison(
            @RequestParam(defaultValue = "30") @Min(7) @Max(90) int days,
            Authentication auth) {
        var user = currentUser(auth);
        var zone = ZoneId.systemDefault();
        var end = LocalDate.now().plusDays(1); // limite exclusivo
        var current = performanceBlock(user.getId(), end.minusDays(days), end, zone);
        var previous = performanceBlock(user.getId(), end.minusDays(days * 2L), end.minusDays(days), zone);
        return new PerformanceComparisonDto(days, current, previous);
    }

    /** Semana atual (seg–dom) e a anterior, para variação na interface. */
    @GetMapping("/weekly-summary")
    @Transactional(readOnly = true)
    WeeklySummaryDto weeklySummary(Authentication auth) {
        var user = currentUser(auth);
        var weekStart = LocalDate.now().with(DayOfWeek.MONDAY);
        return new WeeklySummaryDto(weekStart, weekStart.plusDays(6),
                weekBlock(user.getId(), weekStart), weekBlock(user.getId(), weekStart.minusWeeks(1)));
    }

    /** Série temporal de prontidão; somente dias com check-in, sem inventar valores. */
    @GetMapping("/readiness-trend")
    @Transactional(readOnly = true)
    ReadinessTrendDto readinessTrend(
            @RequestParam(defaultValue = "30") @Min(MIN_TREND_DAYS) @Max(MAX_TREND_DAYS) int days,
            Authentication auth) {
        var user = currentUser(auth);
        var today = LocalDate.now();
        List<ReadinessPointDto> points = checkins
                .findByUserIdAndCheckinDateBetweenOrderByCheckinDateAsc(
                        user.getId(), today.minusDays(days - 1L), today)
                .stream()
                .map(c -> new ReadinessPointDto(c.getCheckinDate(), c.getReadinessScore()))
                .toList();
        return new ReadinessTrendDto(days, points);
    }

    // ---- helpers ----

    /** Compõe os filtros opcionais do histórico; partes nulas são ignoradas. */
    private Specification<TrainingSession> historySpec(Long userId, String q, Long exerciseId,
                                                       String muscle, RpeBand band,
                                                       LocalDate from, LocalDate to, ZoneId zone) {
        List<Specification<TrainingSession>> parts = new ArrayList<>();
        parts.add(TrainingSessionSpecs.ownedBy(userId));
        parts.add(TrainingSessionSpecs.scheduledBetween(
                from != null ? from.atStartOfDay(zone).toInstant() : null,
                to != null ? to.plusDays(1).atStartOfDay(zone).toInstant() : null));
        parts.add(TrainingSessionSpecs.matchesText(normalize(q)));
        parts.add(exerciseId != null ? TrainingSessionSpecs.hasExercise(exerciseId) : null);
        parts.add(normalize(muscle) != null ? TrainingSessionSpecs.hasMuscle(normalize(muscle)) : null);
        parts.add(band != null ? TrainingSessionSpecs.rpeBetween(band.min(), band.max()) : null);
        return parts.stream().filter(Objects::nonNull)
                .reduce(Specification::and)
                .orElse((root, query, cb) -> cb.conjunction());
    }

    /** Sessões concluídas com completed_at na janela [from, to). */
    private List<TrainingSession> completedBetween(Long userId, LocalDate fromInclusive,
                                                   LocalDate toExclusiveEnd, ZoneId zone) {
        return sessions.findByUserIdAndStatusAndCompletedAtGreaterThanEqualAndCompletedAtLessThan(
                userId, SessionStatus.COMPLETED,
                fromInclusive.atStartOfDay(zone).toInstant(),
                toExclusiveEnd.atStartOfDay(zone).toInstant());
    }

    /** Data de referência da sessão: conclusão quando existir, senão agendamento. */
    private static LocalDate sessionDate(TrainingSession s, ZoneId zone) {
        var instant = s.getCompletedAt() != null ? s.getCompletedAt() : s.getScheduledAt();
        return instant.atZone(zone).toLocalDate();
    }

    private PerformanceBlockDto performanceBlock(Long userId, LocalDate fromInclusive,
                                                 LocalDate toExclusiveEnd, ZoneId zone) {
        var completed = completedBetween(userId, fromInclusive, toExclusiveEnd, zone);
        long duration = 0;
        double rpeSum = 0;
        long rpeCount = 0;
        BigDecimal volume = BigDecimal.ZERO;
        for (var s : completed) {
            if (s.getDurationMinutes() != null) duration += s.getDurationMinutes();
            if (s.getSessionRpe() != null) { rpeSum += s.getSessionRpe(); rpeCount++; }
            volume = volume.add(volumeOf(s.getItems()));
        }
        return new PerformanceBlockDto(completed.size(), duration,
                volume.setScale(2, RoundingMode.HALF_UP),
                rpeCount == 0 ? null : round1(rpeSum / rpeCount));
    }

    private WeekBlockDto weekBlock(Long userId, LocalDate weekStart) {
        var zone = ZoneId.systemDefault();
        var from = weekStart.atStartOfDay(zone).toInstant();
        var to = weekStart.plusDays(7).atStartOfDay(zone).toInstant();
        var completed = sessions.findByUserIdAndStatusAndCompletedAtGreaterThanEqualAndCompletedAtLessThan(
                userId, SessionStatus.COMPLETED, from, to);
        long duration = 0;
        double rpeSum = 0;
        long rpeCount = 0;
        BigDecimal volume = BigDecimal.ZERO;
        for (var s : completed) {
            if (s.getDurationMinutes() != null) duration += s.getDurationMinutes();
            if (s.getSessionRpe() != null) { rpeSum += s.getSessionRpe(); rpeCount++; }
            volume = volume.add(volumeOf(s.getItems()));
        }
        var weekCheckins = checkins.findByUserIdAndCheckinDateBetweenOrderByCheckinDateAsc(
                userId, weekStart, weekStart.plusDays(6));
        double readinessSum = 0;
        for (var c : weekCheckins) readinessSum += c.getReadinessScore();
        return new WeekBlockDto(completed.size(), duration, volume.setScale(2, RoundingMode.HALF_UP),
                rpeCount == 0 ? null : round1(rpeSum / rpeCount),
                weekCheckins.isEmpty() ? null : round1(readinessSum / weekCheckins.size()));
    }

    private static SessionItemDto toItem(TrainingSession s) {
        Integer maxPain = null;
        int setCount = 0;
        for (var item : s.getItems()) {
            Integer done = item.getCompletedSets() != null ? item.getCompletedSets() : item.getPrescribedSets();
            setCount += done;
            if (item.getPainLevel() != null && (maxPain == null || item.getPainLevel() > maxPain)) {
                maxPain = item.getPainLevel();
            }
        }
        return new SessionItemDto(s.getId(), s.getRoutine() == null ? null : s.getRoutine().getName(),
                s.getSport().getName(), s.getStatus(), s.getScheduledAt(), s.getCompletedAt(),
                s.getDurationMinutes(), s.getSessionRpe(), maxPain,
                volumeOf(s.getItems()).setScale(2, RoundingMode.HALF_UP), s.getItems().size(), setCount);
    }

    /** Soma loadKg × completedSets dos pares preenchidos; ignora o que não foi executado. */
    private static BigDecimal volumeOf(List<TrainingSessionItem> items) {
        var total = BigDecimal.ZERO;
        for (var item : items) {
            if (item.getLoadKg() != null && item.getCompletedSets() != null) {
                total = total.add(item.getLoadKg().multiply(BigDecimal.valueOf(item.getCompletedSets())));
            }
        }
        return total;
    }

    private static Double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private static String normalize(String value) {
        if (value == null) return null;
        var trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static RpeBand rpeBand(String intensity) {
        if (intensity == null) return null;
        return switch (intensity.toLowerCase()) {
            case "leve" -> new RpeBand(1, 4);
            case "moderada" -> new RpeBand(5, 7);
            case "alta" -> new RpeBand(8, 10);
            default -> null;
        };
    }

    private AppUser currentUser(Authentication auth) {
        return users.findByEmail(auth.getName()).orElseThrow();
    }
}
