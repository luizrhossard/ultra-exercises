package com.forja.web;

import com.forja.domain.Exercise;
import com.forja.domain.ExerciseCategory;
import com.forja.domain.ExerciseDifficulty;
import com.forja.repository.ExerciseRepository;
import com.forja.service.ExerciseFeedService;
import com.forja.service.ExerciseFeedService.FeedItem;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/exercises")
@RequiredArgsConstructor
public class ExerciseController {

    private final ExerciseFeedService feedService;
    private final ExerciseRepository exercises;

    /**
     * Catálogo completo com filtros opcionais. [UE-49]
     * Ex.: GET /api/exercises?difficulty=AVANCADO&category=FORCA&q=terra
     */
    @GetMapping
    @Transactional(readOnly = true)
    List<ExerciseSummaryDto> list(@RequestParam(required = false) ExerciseDifficulty difficulty,
                                  @RequestParam(required = false) ExerciseCategory category,
                                  @RequestParam(required = false) String q) {
        return exercises.findAll().stream()
                .filter(ex -> difficulty == null || ex.getDifficulty() == difficulty)
                .filter(ex -> category == null || ex.getCategory() == category)
                .filter(ex -> matches(ex, q))
                .sorted(Comparator.comparing(Exercise::getName))
                .map(ex -> new ExerciseSummaryDto(
                        ex.getId(),
                        ex.getName(),
                        ex.getCategory(),
                        ex.getDifficulty(),
                        ex.getEquipment(),
                        List.copyOf(ex.getMuscleGroups())))
                .toList();
    }

    record ExerciseSummaryDto(Long id, String name, ExerciseCategory category,
                              ExerciseDifficulty difficulty, String equipment, List<String> muscles) {
    }

    private boolean matches(Exercise ex, String query) {
        if (query == null || query.isBlank()) return true;
        String q = query.toLowerCase(Locale.ROOT).trim();
        return ex.getName().toLowerCase(Locale.ROOT).contains(q)
                || ex.getMuscleGroups().stream().anyMatch(m -> m.toLowerCase(Locale.ROOT).contains(q))
                || (ex.getEquipment() != null && ex.getEquipment().toLowerCase(Locale.ROOT).contains(q));
    }

    /**
     * Feed ranqueado pela relação N:N.
     * Ex.: GET /api/exercises/feed?sportIds=1,3&category=FORCA&q=agachamento
     */
    @GetMapping("/feed")
    List<FeedItem> feed(@RequestParam List<Long> sportIds,
                        @RequestParam(required = false) String q,
                        @RequestParam(required = false) ExerciseCategory category) {
        return feedService.feed(sportIds, q, category);
    }

    record LinkDto(String sportCode, String sportName, int score, String rationale) {
    }

    record ExerciseDetailDto(Long id, String name, ExerciseCategory category, ExerciseDifficulty difficulty,
                             String equipment, List<String> muscles, List<String> steps,
                             List<LinkDto> links) {
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    ResponseEntity<ExerciseDetailDto> detail(@PathVariable Long id) {
        return exercises.findById(id)
                .map(ex -> ResponseEntity.ok(new ExerciseDetailDto(
                        ex.getId(),
                        ex.getName(),
                        ex.getCategory(),
                        ex.getDifficulty(),
                        ex.getEquipment(),
                        List.copyOf(ex.getMuscleGroups()),
                        List.copyOf(ex.getSteps()),
                        ex.getSportLinks().stream()
                                .sorted((a, b) -> Integer.compare(b.getRelevanceScore(), a.getRelevanceScore()))
                                .map(l -> new LinkDto(
                                        l.getSport().getCode(),
                                        l.getSport().getName(),
                                        l.getRelevanceScore(),
                                        l.getRationale()))
                                .toList())))
                .orElseThrow(() -> new NoSuchElementException("Exercício não encontrado: " + id));
    }
}
