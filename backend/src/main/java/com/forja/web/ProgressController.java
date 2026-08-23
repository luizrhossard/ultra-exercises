package com.forja.web;

import com.forja.domain.AppUser;
import com.forja.domain.SessionStatus;
import com.forja.domain.TrainingSession;
import com.forja.domain.TrainingSessionItem;
import com.forja.repository.AppUserRepository;
import com.forja.repository.ReadinessCheckinRepository;
import com.forja.repository.TrainingSessionRepository;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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
import java.util.List;

/**
 * [UE-42] Progresso do atleta: histórico paginado de sessões, resumo semanal e
 * tendência de prontidão. Todo acesso parte do usuário autenticado (JWT) — nunca
 * de identificador recebido pelo cliente. Observabilidade fica no evento http do
 * RequestLoggingFilter (método/path/status/duração) com traceId no MDC; nenhum
 * dado sensível (RPE, dor, notas, payloads) é registrado em logs.
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

    /** Histórico paginado; janela opcional por data de agendamento; ordenação fixa (mais recente primeiro). */
    @GetMapping("/sessions")
    @Transactional(readOnly = true)
    SessionsPageDto sessions(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(MAX_PAGE_SIZE) int size,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Authentication auth) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new IllegalArgumentException("Período inválido: 'from' deve ser anterior ou igual a 'to'.");
        }
        var user = currentUser(auth);
        var zone = ZoneId.systemDefault();
        var start = from != null ? from.atStartOfDay(zone).toInstant() : Instant.EPOCH;
        var end = to != null
                ? to.plusDays(1).atStartOfDay(zone).toInstant()
                : LocalDate.of(2999, 12, 31).atStartOfDay(zone).toInstant();
        Page<TrainingSession> result = sessions.findByUserIdAndScheduledAtGreaterThanEqualAndScheduledAtLessThan(
                user.getId(), start, end,
                PageRequest.of(page, size, Sort.by(Sort.Order.desc("scheduledAt"), Sort.Order.desc("id"))));
        List<SessionItemDto> items = result.getContent().stream().map(ProgressController::toItem).toList();
        return new SessionsPageDto(items, result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages(), result.hasNext());
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

    private AppUser currentUser(Authentication auth) {
        return users.findByEmail(auth.getName()).orElseThrow();
    }
}
