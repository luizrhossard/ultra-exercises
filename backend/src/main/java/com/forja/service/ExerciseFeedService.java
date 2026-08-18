package com.forja.service;

import com.forja.domain.ExerciseCategory;
import com.forja.domain.ExerciseSport;
import com.forja.repository.ExerciseSportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

import static java.util.Comparator.comparingInt;
import static java.util.stream.Collectors.groupingBy;

/**
 * Monta o feed de exercícios para um conjunto de esportes, ranqueado pela
 * relação N:N: a relevância de um exercício é o MAIOR score entre os esportes
 * do usuário (desempate: quantos esportes têm score >= 4).
 */
@Service
@RequiredArgsConstructor
public class ExerciseFeedService {

    private final ExerciseSportRepository links;

    public record FeedItem(
            Long exerciseId,
            String name,
            ExerciseCategory category,
            String equipment,
            List<String> muscles,
            int bestScore,
            int strongCount,
            Map<String, Integer> scoreBySport,
            Map<String, String> rationaleBySport) {
    }

    @Transactional(readOnly = true)
    public List<FeedItem> feed(Collection<Long> sportIds, String query, ExerciseCategory category) {
        if (sportIds.isEmpty()) return List.of();

        var byExercise = links.findBySportIdIn(sportIds).stream()
                .collect(groupingBy(p -> p.getExercise().getId()));

        return byExercise.values().stream()
                .map(this::toItem)
                .filter(item -> category == null || item.category() == category)
                .filter(item -> matchesQuery(item, query))
                .sorted(comparingInt(FeedItem::bestScore).reversed()
                        .thenComparing(comparingInt(FeedItem::strongCount).reversed())
                        .thenComparing(FeedItem::name))
                .toList();
    }

    private FeedItem toItem(List<ExerciseSport> pairs) {
        var exercise = pairs.get(0).getExercise();
        int best = 0;
        int strong = 0;
        Map<String, Integer> bySport = new LinkedHashMap<>();
        Map<String, String> rationales = new LinkedHashMap<>();

        for (var pair : pairs) {
            int score = pair.getRelevanceScore();
            best = Math.max(best, score);
            if (score >= 4) strong++;
            bySport.put(pair.getSport().getCode(), score);
            if (pair.getRationale() != null) {
                rationales.put(pair.getSport().getCode(), pair.getRationale());
            }
        }

        return new FeedItem(
                exercise.getId(),
                exercise.getName(),
                exercise.getCategory(),
                exercise.getEquipment(),
                List.copyOf(exercise.getMuscleGroups()),
                best,
                strong,
                bySport,
                rationales);
    }

    private boolean matchesQuery(FeedItem item, String query) {
        if (query == null || query.isBlank()) return true;
        String q = query.toLowerCase().trim();
        return item.name().toLowerCase().contains(q)
                || item.muscles().stream().anyMatch(m -> m.toLowerCase().contains(q))
                || (item.equipment() != null && item.equipment().toLowerCase().contains(q));
    }
}
