package com.forja.service;

import com.forja.domain.*;
import com.forja.repository.AppUserRepository;
import com.forja.repository.ExerciseSportRepository;
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
 * <p>
 * [UE-50] O {@link SportLevel} do usuário no esporte foco filtra dificuldades
 * bloqueadas, soma um bônus de dificuldade ao ranking, ajusta cotas/tamanho e
 * define a dosagem — ver {@link SportLevelPolicy} e
 * docs/features/routine-generator-sport-level.md.
 */
@Service
@RequiredArgsConstructor
public class RoutineGeneratorService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM");

    /** Presets por categoria: séries, reps e descanso (s). */
    public record Preset(int sets, String reps, int rest) {
    }

    /**
     * Dosagem padrão (nível AMATEUR) — usada quando não há contexto de nível,
     * p.ex. ao adicionar um exercício manualmente a uma rotina.
     */
    public static final Map<ExerciseCategory, Preset> PRESETS = Arrays.stream(ExerciseCategory.values())
            .collect(java.util.stream.Collectors.toUnmodifiableMap(c -> c, c -> {
                var p = SportLevelPolicy.preset(SportLevel.AMATEUR, c);
                return new Preset(p.sets(), p.reps(), p.rest());
            }));

    private final AppUserRepository users;
    private final SportRepository sports;
    private final ExerciseSportRepository links;
    private final RoutineRepository routines;

    private record Candidate(Long exerciseId, int total, int focusScore, Exercise exercise) {
    }

    /** Nível do usuário no esporte foco; sem vínculo, assume RECREATIONAL (progressão segura). */
    static SportLevel levelFor(AppUser user, Long focusSportId) {
        return user.getUserSports().stream()
                .filter(us -> us.getSport().getId().equals(focusSportId))
                .map(UserSport::getLevel)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(SportLevel.RECREATIONAL);
    }

    @Transactional
    public Routine generate(String userEmail, Long focusSportId) {
        var user = users.findByEmail(userEmail)
                .orElseThrow(() -> new NoSuchElementException("Usuário não encontrado: " + userEmail));
        var focus = sports.findById(focusSportId)
                .orElseThrow(() -> new NoSuchElementException("Esporte não encontrado: " + focusSportId));

        var level = levelFor(user, focusSportId);

        var userSportIds = user.getUserSports().stream()
                .map(us -> us.getSport().getId())
                .toList();

        // relevância = 2 × relevância no foco + melhor relevância nos demais esportes do usuário
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

        // total = relevância + bônus de dificuldade do nível; dificuldades bloqueadas saem do ranking
        var ranked = candidates.values().stream()
                .map(c -> {
                    int relevance = focusScore.getOrDefault(c.exerciseId(), 0) * 2
                            + otherBest.getOrDefault(c.exerciseId(), 0);
                    var bonus = SportLevelPolicy.difficultyBonus(level, c.exercise().getDifficulty());
                    if (relevance <= 0 || bonus.isEmpty()) return null;
                    return new Candidate(c.exerciseId(), relevance + bonus.getAsInt(),
                            focusScore.getOrDefault(c.exerciseId(), 0), c.exercise());
                })
                .filter(Objects::nonNull)
                .sorted(comparingInt(Candidate::total).reversed()
                        .thenComparing(comparingInt(Candidate::focusScore).reversed())
                        .thenComparing(Candidate::exerciseId))
                .toList();

        // cotas por categoria (ajustadas ao nível) + preenchimento até o tamanho do nível
        int maxItems = SportLevelPolicy.maxItems(level);
        List<Candidate> picked = new ArrayList<>();
        Set<Long> used = new HashSet<>();
        for (var quota : SportLevelPolicy.quotas(level)) {
            int taken = 0;
            for (var c : ranked) {
                if (taken >= quota.getValue() || picked.size() >= maxItems) break;
                if (!used.contains(c.exerciseId()) && c.exercise().getCategory() == quota.getKey()) {
                    picked.add(c);
                    used.add(c.exerciseId());
                    taken++;
                }
            }
        }
        for (var c : ranked) {
            if (picked.size() >= maxItems) break;
            if (used.add(c.exerciseId())) picked.add(c);
        }

        var routine = Routine.builder()
                .user(user)
                .sport(focus)
                .name("Treino " + focus.getName() + " · " + LocalDate.now().format(DAY))
                .build();

        int position = 0;
        for (var c : picked) {
            var category = c.exercise().getCategory();
            var preset = SportLevelPolicy.preset(level, category);
            routine.getItems().add(RoutineItem.builder()
                    .routine(routine)
                    .exercise(c.exercise())
                    .position(position++)
                    .sets(SportLevelPolicy.sets(level, category, c.focusScore()))
                    .reps(preset.reps())
                    .restTime(preset.rest())
                    .build());
        }

        return routines.save(routine);
    }
}
