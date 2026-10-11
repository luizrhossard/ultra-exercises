package com.forja.service;

import com.forja.domain.*;
import com.forja.repository.AppUserRepository;
import com.forja.repository.ExerciseSportRepository;
import com.forja.repository.ReadinessCheckinRepository;
import com.forja.repository.RoutineRepository;
import com.forja.repository.SportRepository;
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

    public record GenerationResult(Routine routine, Integer readinessScore,
                                   boolean readinessAdjusted, boolean requiresReview,
                                   String reviewRecommendation) {
    }

    private record Candidate(Long exerciseId, int total, int focusScore, Exercise exercise) {
    }

    @Transactional
    public Routine generate(String userEmail, Long focusSportId) {
        return generateWithReadiness(userEmail, focusSportId).routine();
    }

    @Transactional
    public GenerationResult generateWithReadiness(String userEmail, Long focusSportId) {
        var user = users.findByEmail(userEmail)
                .orElseThrow(() -> new NoSuchElementException("Usuário não encontrado: " + userEmail));
        var focus = sports.findById(focusSportId)
                .orElseThrow(() -> new NoSuchElementException("Esporte não encontrado: " + focusSportId));
        var checkin = checkins.findByUserIdAndCheckinDate(user.getId(), LocalDate.now()).orElse(null);
        Integer readinessScore = checkin == null ? null : checkin.getReadinessScore();
        boolean requiresReview = checkin != null && checkin.requiresReview();
        boolean readinessAdjusted = checkin != null
                && (requiresReview || readinessScore <= LOW_READINESS_THRESHOLD);
        SportLevel focusLevel = user.getUserSports().stream()
                .filter(userSport -> userSport.getSport().getId().equals(focusSportId))
                .map(UserSport::getLevel)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(SportLevel.RECREATIONAL);

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

        var ranked = candidates.values().stream()
                .map(c -> new Candidate(c.exerciseId(),
                        focusScore.getOrDefault(c.exerciseId(), 0) * 2
                                + otherBest.getOrDefault(c.exerciseId(), 0),
                        focusScore.getOrDefault(c.exerciseId(), 0),
                        c.exercise()))
                .filter(c -> c.total() > 0)
                .sorted(comparingInt(Candidate::total).reversed()
                        .thenComparing(comparingInt(Candidate::focusScore).reversed()))
                .toList();

        // A prontidão baixa preserva um item de força, core, técnica e até dois de mobilidade.
        List<Candidate> picked = new ArrayList<>();
        Set<Long> used = new HashSet<>();
        List<Map.Entry<ExerciseCategory, Integer>> quotas = readinessAdjusted
                ? LOW_READINESS_QUOTAS : QUOTAS;
        int itemLimit = readinessAdjusted ? 5 : 7;
        for (var quota : quotas) {
            int taken = 0;
            for (var c : ranked) {
                if (taken >= quota.getValue()) break;
                if (!used.contains(c.exerciseId()) && c.exercise().getCategory() == quota.getKey()) {
                    picked.add(c);
                    used.add(c.exerciseId());
                    taken++;
                }
            }
        }
        if (!readinessAdjusted) {
            for (var c : ranked) {
                if (picked.size() >= itemLimit) break;
                if (used.add(c.exerciseId())) picked.add(c);
            }
        }

        var routine = Routine.builder()
                .user(user)
                .sport(focus)
                .name("Treino " + focus.getName() + " · " + LocalDate.now().format(DAY))
                .build();

        int position = 0;
        for (var c : picked) {
            boolean runningTechnique = "corrida".equals(focus.getCode())
                    && c.exercise().getCategory() == ExerciseCategory.ESPECIFICO
                    && RUNNING_TECHNIQUE_EXERCISES.contains(c.exercise().getName());
            var preset = runningTechnique
                    ? runningTechniquePreset(c.exercise(), focusLevel)
                    : PRESETS.get(c.exercise().getCategory());
            int sets = readinessAdjusted
                    ? Math.max(1, (preset.sets() + 1) / 2)
                    : runningTechnique
                            ? preset.sets()
                            : Math.min(5, preset.sets() + (c.focusScore() >= 5 ? 1 : 0));
            int rest = readinessAdjusted ? (int) Math.ceil(preset.rest() * 1.25) : preset.rest();
            routine.getItems().add(RoutineItem.builder()
                    .routine(routine)
                    .exercise(c.exercise())
                    .position(position++)
                    .sets(sets)
                    .reps(preset.reps())
                    .restTime(rest)
                    .build());
        }

        String recommendation = requiresReview
                ? "Seu check-in sinalizou dor, fadiga ou dor muscular elevados. O treino foi reduzido; revise a sessão com um profissional antes de iniciar."
                : null;
        return new GenerationResult(routines.save(routine), readinessScore, readinessAdjusted,
                requiresReview, recommendation);
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
