package com.forja.web;

import com.forja.domain.ExerciseCategory;
import com.forja.repository.ExerciseRepository;
import com.forja.service.ExerciseFeedService;
import com.forja.service.ExerciseFeedService.FeedItem;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/exercises")
@RequiredArgsConstructor
public class ExerciseController {

    private final ExerciseFeedService feedService;
    private final ExerciseRepository exercises;

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

    record ExerciseDetailDto(Long id, String name, ExerciseCategory category,
                             String equipment, List<String> muscles, List<String> steps,
                             List<LinkDto> links) {
    }

    @GetMapping("/{id}")
    ResponseEntity<ExerciseDetailDto> detail(@PathVariable Long id) {
        return exercises.findById(id)
                .map(ex -> ResponseEntity.ok(new ExerciseDetailDto(
                        ex.getId(),
                        ex.getName(),
                        ex.getCategory(),
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
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
