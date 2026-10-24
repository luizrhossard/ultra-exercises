package com.forja.service;

import com.forja.domain.*;
import com.forja.repository.AppUserRepository;
import com.forja.repository.ExerciseSportRepository;
import com.forja.repository.ReadinessCheckinRepository;
import com.forja.repository.RoutineRepository;
import com.forja.repository.SportRepository;
import com.forja.repository.TrainingSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

import static java.util.Comparator.comparingInt;

/**
 * Gera o "treino do dia" cruzando a tabela exercise_sport com os esportes do
 * usuário: o esporte FOCO pesa em dobro e as categorias são balanceadas por
 * cotas (2× força, 1× pliometria, 1× core, 1× condicionamento, 1× específico,
 * 1× mobilidade).
 */
@Service
@RequiredArgsConstructor
public class RoutineGeneratorService {

    private static final int LOW_READINESS_THRESHOLD = 15;

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM");

    /** Presets por categoria: séries, reps e descanso (s). */
    public record Preset(int sets, String reps, int rest) {
    }

    public static final Map<ExerciseCategory, Preset> PRESETS = Map.of(
            ExerciseCategory.FORCA, new Preset(4, "8 reps", 120),
            ExerciseCategory.PLIOMETRIA, new Preset(4, "6 reps", 90),
            ExerciseCategory.CORE, new Preset(3, "40 s", 45),
            ExerciseCategory.CONDICIONAMENTO, new Preset(5, "30 s", 60),
            ExerciseCategory.MOBILIDADE, new Preset(2, "45 s", 30),
            ExerciseCategory.ESPECIFICO, new Preset(3, "3 min", 90));

    private record RunningDose(int sets, int distanceMeters, int contacts, int restSeconds) {
    }

    /** Progressão conservadora dos drills de corrida conforme nível cadastrado no esporte. */
    private static final Map<SportLevel, RunningDose> RUNNING_DOSES = Map.of(
            SportLevel.RECREATIONAL, new RunningDose(2, 10, 8, 90),
            SportLevel.AMATEUR, new RunningDose(3, 12, 10, 75),
            SportLevel.COMPETITIVE, new RunningDose(3, 15, 12, 60),
            SportLevel.PROFESSIONAL, new RunningDose(4, 20, 15, 60));

    private static final Set<String> RUNNING_TECHNIQUE_EXERCISES = Set.of(
            "Skip A — Técnica de Passada",
            "Dribbling de Corrida",
            "Pogos Bilaterais de Baixa Amplitude");

    private static final List<Map.Entry<ExerciseCategory, Integer>> QUOTAS = List.of(
            Map.entry(ExerciseCategory.FORCA, 2),
            Map.entry(ExerciseCategory.PLIOMETRIA, 1),
            Map.entry(ExerciseCategory.CORE, 1),
            Map.entry(ExerciseCategory.CONDICIONAMENTO, 1),
            Map.entry(ExerciseCategory.ESPECIFICO, 1),
            Map.entry(ExerciseCategory.MOBILIDADE, 1));

    /** Rotina de recuperação: tira pliometria/condicionamento e reserva mais espaço à mobilidade. */
    private static final List<Map.Entry<ExerciseCategory, Integer>> LOW_READINESS_QUOTAS = List.of(
            Map.entry(ExerciseCategory.FORCA, 1),
            Map.entry(ExerciseCategory.CORE, 1),
            Map.entry(ExerciseCategory.ESPECIFICO, 1),
            Map.entry(ExerciseCategory.MOBILIDADE, 2));

    private final AppUserRepository users;
    private final SportRepository sports;
    private final ExerciseSportRepository links;
    private final ReadinessCheckinRepository checkins;
    private final RoutineRepository routines;
    private final TrainingSessionRepository sessions;

    public record GenerationResult(Routine routine, Integer readinessScore,
                                   boolean readinessAdjusted, boolean requiresReview,
                                   String reviewRecommendation, String explanation) {
    }

    private record Candidate(Long exerciseId, int total, int focusScore, Exercise exercise) {
    }

    @Transactional
    public Routine generate(String userEmail, Long focusSportId) {
        return generateWithReadiness(userEmail, focusSportId).routine();
    }

    @Transactional
    public GenerationResult generateWithReadiness(String userEmail, Long focusSportId) {
        return generateWithReadiness(userEmail, focusSportId, LocalDate.now());
    }

    @Transactional
    public GenerationResult generateWithReadiness(String userEmail, Long focusSportId, LocalDate requestedDate) {
        LocalDate planDate = requestedDate == null ? LocalDate.now() : requestedDate;
        var user = users.findByEmail(userEmail)
                .orElseThrow(() -> new NoSuchElementException("Usuário não encontrado: " + userEmail));
        var focus = sports.findById(focusSportId)
                .orElseThrow(() -> new NoSuchElementException("Esporte não encontrado: " + focusSportId));
        var checkin = checkins.findByUserIdAndCheckinDate(user.getId(), planDate).orElse(null);
        Integer readinessScore = checkin == null ? null : checkin.getReadinessScore();
        boolean requiresReview = checkin != null && checkin.requiresReview();
        boolean readinessAdjusted = checkin != null
                && (requiresReview || readinessScore <= LOW_READINESS_THRESHOLD);
        boolean recentExecutionConcern = sessions.hasRecentHighEffortOrPain(user.getId(),
                planDate.minusDays(7).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant());
        boolean conservativeAdjustment = readinessAdjusted || recentExecutionConcern;
        var existing = routines.findByUserIdAndPlanDate(user.getId(), planDate);
        if (existing.isPresent()) {
            var routine = existing.get();
            boolean newlyConservative = conservativeAdjustment && !routine.isReadinessAdjusted();
            boolean newReviewSignal = requiresReview && !routine.isRequiresReview();
            boolean scoreChanged = checkin != null && !Objects.equals(routine.getReadinessScore(), readinessScore);
            if (newlyConservative || newReviewSignal || scoreChanged) {
                if (newlyConservative) applyConservativeDose(routine);
                if (checkin != null) routine.setReadinessScore(readinessScore);
                routine.setReadinessAdjusted(routine.isReadinessAdjusted() || conservativeAdjustment);
                routine.setRequiresReview(routine.isRequiresReview() || requiresReview);
                if (newlyConservative || newReviewSignal) {
                    routine.setExplanation("Ajustamos o plano provisório após o check-in: reduzimos séries e ampliamos os intervalos por sinais de recuperação.");
                } else if (scoreChanged) {
                    routine.setExplanation(routine.isReadinessAdjusted()
                            ? "Check-in registrado; mantivemos o ajuste conservador já definido para esta sessão."
                            : "Check-in registrado; os dados não exigiram reduzir esta sessão.");
                }
                routines.save(routine);
            }
            String explanation = routine.getExplanation() == null
                    ? "Recomendação já planejada para hoje; mantivemos a mesma sessão para evitar duplicação."
                    : routine.getExplanation();
            return new GenerationResult(routine, routine.getReadinessScore(), routine.isReadinessAdjusted(),
                    routine.isRequiresReview(), reviewText(routine.isRequiresReview()), explanation);
        }
        SportLevel focusLevel = user.getUserSports().stream()
                .filter(userSport -> userSport.getSport().getId().equals(focusSportId))
                .map(UserSport::getLevel)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(SportLevel.RECREATIONAL);

        String[] trainingDays = user.getTrainingDays() == null ? new String[0] : user.getTrainingDays().split(",");
        boolean availableToday = trainingDays.length == 0
                || Arrays.stream(trainingDays).anyMatch(day -> day.equals(planDate.getDayOfWeek().name()));
        if (!availableToday) {
            String explanation = "Hoje está fora dos dias que você informou como disponíveis; planejamos descanso.";
            if (recentExecutionConcern) explanation += " Também registramos esforço elevado ou dor em sessão recente.";
            var rest = Routine.builder().user(user).sport(focus)
                    .name("Descanso · " + planDate.format(DAY)).planDate(planDate)
                    .readinessScore(readinessScore).readinessAdjusted(conservativeAdjustment)
                    .requiresReview(requiresReview).restDay(true).explanation(explanation).build();
            return new GenerationResult(routines.save(rest), readinessScore, conservativeAdjustment, requiresReview,
                    reviewText(requiresReview), explanation);
        }

        var userSportIds = user.getUserSports().stream()
                .map(us -> us.getSport().getId())
                .toList();

        // score = 2 × relevância no foco + melhor relevância nos demais esportes do usuário
        Map<Long, Candidate> candidates = new LinkedHashMap<>();
        Map<Long, Integer> focusScore = new HashMap<>();
        Map<Long, Integer> otherBest = new HashMap<>();

        for (var pair : links.findBySportIdIn(userSportIds)) {
            long exerciseId = pair.getExercise().getId();
            candidates.putIfAbsent(exerciseId,
                    new Candidate(exerciseId, 0, 0, pair.getExercise()));
            if (pair.getSport().getId().equals(focusSportId)) {
                focusScore.merge(exerciseId, pair.getRelevanceScore(), Math::max);
            } else {
                otherBest.merge(exerciseId, pair.getRelevanceScore(), Math::max);
            }
        }

        Set<Long> recentExerciseIds = new HashSet<>(sessions.findCompletedExerciseIdsSince(user.getId(),
                planDate.minusDays(14).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant(),
                planDate.plusDays(1).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant()));
        var ranked = candidates.values().stream()
                .map(c -> new Candidate(c.exerciseId(),
                        focusScore.getOrDefault(c.exerciseId(), 0) * 2
                                + otherBest.getOrDefault(c.exerciseId(), 0),
                        focusScore.getOrDefault(c.exerciseId(), 0),
                        c.exercise()))
                .filter(c -> c.total() > 0)
                .filter(c -> !blockedByLimitations(user.getTrainingLimitations(), c.exercise()))
                .sorted(Comparator.comparing((Candidate c) -> recentExerciseIds.contains(c.exerciseId()))
                        .thenComparingInt(c -> goalPriority(user.getTrainingGoal(), c.exercise().getCategory()))
                        .thenComparingInt(c -> preferencePriority(user.getTrainingPreferences(), c.exercise()))
                        .thenComparing(comparingInt(Candidate::total).reversed())
                        .thenComparing(comparingInt(Candidate::focusScore).reversed()))
                .toList();

        List<Candidate> equipmentCompatible = ranked.stream()
                .filter(candidate -> equipmentCompatible(user.getAvailableEquipment(), candidate.exercise()))
                .toList();
        List<Candidate> selectionPool = user.getAvailableEquipment() == null || user.getAvailableEquipment().isBlank()
                ? ranked : equipmentCompatible;

        // A prontidão baixa preserva um item de força, core, técnica e até dois de mobilidade.
        List<Candidate> picked = new ArrayList<>();
        Set<Long> used = new HashSet<>();
        List<Map.Entry<ExerciseCategory, Integer>> quotas = conservativeAdjustment
                ? LOW_READINESS_QUOTAS : goalQuotas(user.getTrainingGoal());
        int itemLimit = conservativeAdjustment ? 5 : 7;
        if (user.getSessionDurationMinutes() != null) {
            itemLimit = Math.min(itemLimit, user.getSessionDurationMinutes() <= 30 ? 4
                    : user.getSessionDurationMinutes() <= 45 ? 5 : 7);
        }
        for (var quota : quotas) {
            if (picked.size() >= itemLimit) break;
            int taken = 0;
            for (var c : selectionPool) {
                if (taken >= quota.getValue() || picked.size() >= itemLimit) break;
                if (!used.contains(c.exerciseId()) && c.exercise().getCategory() == quota.getKey()) {
                    picked.add(c);
                    used.add(c.exerciseId());
                    taken++;
                }
            }
        }
        if (!conservativeAdjustment) {
            for (var c : selectionPool) {
                if (picked.size() >= itemLimit) break;
                if (used.add(c.exerciseId())) picked.add(c);
            }
        }

        boolean noSuitableExercises = picked.isEmpty();
        var routine = Routine.builder()
                .user(user)
                .sport(focus)
                .name((noSuitableExercises ? "Descanso" : "Treino " + focus.getName()) + " · " + planDate.format(DAY))
                .planDate(planDate)
                .readinessScore(readinessScore)
                .readinessAdjusted(conservativeAdjustment)
                .requiresReview(requiresReview)
                .restDay(noSuitableExercises)
                .build();

        int position = 0;
        for (var c : picked) {
            boolean runningTechnique = "corrida".equals(focus.getCode())
                    && c.exercise().getCategory() == ExerciseCategory.ESPECIFICO
                    && RUNNING_TECHNIQUE_EXERCISES.contains(c.exercise().getName());
            var preset = runningTechnique
                    ? runningTechniquePreset(c.exercise(), focusLevel)
                    : PRESETS.get(c.exercise().getCategory());
            int sets = conservativeAdjustment
                    ? Math.max(1, (preset.sets() + 1) / 2)
                    : runningTechnique
                            ? preset.sets()
                            : Math.min(5, preset.sets() + (c.focusScore() >= 5 ? 1 : 0));
            int rest = conservativeAdjustment ? (int) Math.ceil(preset.rest() * 1.25) : preset.rest();
            routine.getItems().add(RoutineItem.builder()
                    .routine(routine)
                    .exercise(c.exercise())
                    .position(position++)
                    .sets(sets)
                    .reps(preset.reps())
                    .restTime(rest)
                    .build());
        }

        String recommendation = reviewText(requiresReview);
        String explanation = noSuitableExercises
                ? "Não encontramos exercícios compatíveis com as suas limitações e equipamentos informados. Ajuste o perfil ou planeje descanso."
                : conservativeAdjustment
                ? recentExecutionConcern && !readinessAdjusted
                        ? "Reduzimos o volume e ampliamos os intervalos após esforço elevado ou dor registrada em sessão recente."
                        : "Reduzimos o volume e ampliamos os intervalos por causa do check-in de prontidão."
                : recentExerciseIds.isEmpty()
                        ? "Selecionamos exercícios relacionados ao esporte foco e ao seu nível."
                        : equipmentCompatible.isEmpty() && user.getAvailableEquipment() != null
                                && !user.getAvailableEquipment().isBlank()
                                ? "Não encontramos exercícios compatíveis com os equipamentos informados; usamos as opções esportivas disponíveis."
                                : "Priorizamos objetivo e esporte foco e evitamos repetir exercícios concluídos nos últimos 14 dias quando havia alternativas.";
        routine.setExplanation(explanation);
        return new GenerationResult(routines.save(routine), readinessScore, conservativeAdjustment,
                requiresReview, recommendation, explanation);
    }

    private static String reviewText(boolean requiresReview) {
        return requiresReview
                ? "Seu check-in sinalizou dor, fadiga ou dor muscular elevados. O treino foi reduzido; revise a sessão com um profissional antes de iniciar."
                : null;
    }

    private static void applyConservativeDose(Routine routine) {
        Map<ExerciseCategory, Integer> limits = new EnumMap<>(ExerciseCategory.class);
        LOW_READINESS_QUOTAS.forEach(quota -> limits.put(quota.getKey(), quota.getValue()));
        Map<ExerciseCategory, Integer> selected = new EnumMap<>(ExerciseCategory.class);
        Iterator<RoutineItem> items = routine.getItems().iterator();
        int retained = 0;
        while (items.hasNext()) {
            RoutineItem item = items.next();
            ExerciseCategory category = item.getExercise().getCategory();
            int categoryCount = selected.getOrDefault(category, 0);
            if (retained >= 5 || categoryCount >= limits.getOrDefault(category, 0)) {
                items.remove();
                continue;
            }
            selected.put(category, categoryCount + 1);
            retained++;
            item.setSets(Math.max(1, item.getSets() / 2));
            item.setRestTime((int) Math.ceil(item.getRestTime() * 1.25));
        }
        routine.getItems().sort(Comparator.comparingInt(RoutineItem::getPosition));
        for (int index = 0; index < routine.getItems().size(); index++) {
            routine.getItems().get(index).setPosition(index);
        }
    }

    private static int goalPriority(String goal, ExerciseCategory category) {
        if (goal == null || goal.isBlank()) return 0;
        String normalized = goal.toLowerCase(Locale.ROOT);
        if ((normalized.contains("força") || normalized.contains("strength")) && category == ExerciseCategory.FORCA) return 0;
        if ((normalized.contains("condicion") || normalized.contains("resist") || normalized.contains("corrida"))
                && category == ExerciseCategory.CONDICIONAMENTO) return 0;
        if ((normalized.contains("mobilidade") || normalized.contains("flexibilidade"))
                && category == ExerciseCategory.MOBILIDADE) return 0;
        if ((normalized.contains("desempenho") || normalized.contains("performance") || normalized.contains("esport"))
                && (category == ExerciseCategory.ESPECIFICO || category == ExerciseCategory.FORCA)) return 0;
        return 1;
    }

    private static boolean blockedByLimitations(String limitations, Exercise exercise) {
        if (limitations == null || limitations.isBlank()) return false;
        String exerciseName = exercise.getName().toLowerCase(Locale.ROOT);
        return Arrays.stream(limitations.toLowerCase(Locale.ROOT).split("[,;\\n]"))
                .map(String::trim)
                .filter(term -> term.startsWith("evitar ") || term.startsWith("nao fazer ")
                        || term.startsWith("não fazer ") || term.startsWith("sem "))
                .map(term -> term.replaceFirst("^(evitar|nao fazer|não fazer|sem)\\s+", "").trim())
                .filter(term -> !term.isBlank())
                .anyMatch(exerciseName::contains);
    }

    private static int preferencePriority(String preferences, Exercise exercise) {
        if (preferences == null || preferences.isBlank()) return 1;
        String exerciseName = exercise.getName().toLowerCase(Locale.ROOT);
        boolean preferred = Arrays.stream(preferences.toLowerCase(Locale.ROOT).split("[,;\\n]"))
                .map(String::trim)
                .filter(term -> term.startsWith("prefiro ") || term.startsWith("preferir ") || term.startsWith("priorizar ")
                        || term.startsWith("priorize ") || term.startsWith("gosto de "))
                .map(term -> term.replaceFirst("^(prefiro|preferir|priorizar|priorize|gosto de)\\s+", "").trim())
                .filter(term -> !term.isBlank())
                .anyMatch(exerciseName::contains);
        return preferred ? 0 : 1;
    }

    private static List<Map.Entry<ExerciseCategory, Integer>> goalQuotas(String goal) {
        if (goal == null) return QUOTAS;
        String normalized = goal.toLowerCase(Locale.ROOT);
        if (normalized.contains("força") || normalized.contains("strength")) {
            return List.of(Map.entry(ExerciseCategory.FORCA, 3), Map.entry(ExerciseCategory.CORE, 1),
                    Map.entry(ExerciseCategory.CONDICIONAMENTO, 1), Map.entry(ExerciseCategory.ESPECIFICO, 1),
                    Map.entry(ExerciseCategory.MOBILIDADE, 1));
        }
        if (normalized.contains("condicion") || normalized.contains("resist") || normalized.contains("corrida")) {
            return List.of(Map.entry(ExerciseCategory.CONDICIONAMENTO, 2), Map.entry(ExerciseCategory.ESPECIFICO, 2),
                    Map.entry(ExerciseCategory.FORCA, 1), Map.entry(ExerciseCategory.CORE, 1),
                    Map.entry(ExerciseCategory.MOBILIDADE, 1));
        }
        if (normalized.contains("mobilidade") || normalized.contains("flexibilidade")) {
            return List.of(Map.entry(ExerciseCategory.MOBILIDADE, 2), Map.entry(ExerciseCategory.CORE, 1),
                    Map.entry(ExerciseCategory.FORCA, 1), Map.entry(ExerciseCategory.ESPECIFICO, 1),
                    Map.entry(ExerciseCategory.PLIOMETRIA, 1), Map.entry(ExerciseCategory.CONDICIONAMENTO, 1));
        }
        return QUOTAS;
    }

    private static boolean equipmentCompatible(String available, Exercise exercise) {
        if (available == null || available.isBlank()) return true;
        String availableNormalized = available.toLowerCase(Locale.ROOT);
        boolean bodyweightOnly = availableNormalized.contains("nenhum")
                || availableNormalized.contains("sem equipamento") || availableNormalized.contains("peso corporal");
        String equipment = exercise.getEquipment();
        if (equipment == null || equipment.isBlank()) return true;
        String normalized = equipment.toLowerCase(Locale.ROOT);
        if (bodyweightOnly) return normalized.contains("peso corporal") || normalized.contains("bodyweight")
                || normalized.contains("sem equipamento") || normalized.contains("nenhum");
        return Arrays.stream(available.toLowerCase(Locale.ROOT).split(","))
                .map(String::trim).filter(term -> !term.isBlank())
                .anyMatch(normalized::contains);
    }

    private static Preset runningTechniquePreset(Exercise exercise, SportLevel level) {
        RunningDose dose = RUNNING_DOSES.get(level);
        String reps = switch (exercise.getName()) {
            case "Skip A — Técnica de Passada", "Dribbling de Corrida" -> dose.distanceMeters() + " m";
            case "Pogos Bilaterais de Baixa Amplitude" -> dose.contacts() + " contatos";
            default -> throw new IllegalArgumentException("Drill de corrida sem dosagem: " + exercise.getName());
        };
        return new Preset(dose.sets(), reps, dose.restSeconds());
    }
}
