package com.forja.seed;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.forja.domain.Exercise;
import com.forja.domain.ExerciseCategory;
import com.forja.domain.ExerciseSport;
import com.forja.domain.Sport;
import com.forja.repository.ExerciseRepository;
import com.forja.repository.ExerciseSportRepository;
import com.forja.repository.SportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Popula a base com a curadoria completa (esportes, exercícios e os pares
 * exercise_sport com score + rationale) a partir de seed/data.json.
 * Idempotente: pula se já houver dados.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements ApplicationRunner {

    private final SportRepository sports;
    private final ExerciseRepository exercises;
    private final ExerciseSportRepository links;
    private final ObjectMapper json;

    record SportSeed(String code, String name, String description) {
    }

    record LinkSeed(String sport, int score, String why) {
    }

    record ExerciseSeed(String name, String category, String equipment,
                        List<String> muscles, List<String> steps, List<LinkSeed> links) {
    }

    record SeedData(List<SportSeed> sports, List<ExerciseSeed> exercises) {
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws Exception {
        if (sports.count() > 0) {
            log.info("Seed Forja: base já populada — pulando.");
            return;
        }

        var data = json.readValue(
                new ClassPathResource("seed/data.json").getInputStream(), SeedData.class);

        Map<String, Sport> byCode = new HashMap<>();
        for (var s : data.sports()) {
            byCode.put(s.code(), sports.save(Sport.builder()
                    .code(s.code())
                    .name(s.name())
                    .description(s.description())
                    .build()));
        }

        int pairs = 0;
        for (var e : data.exercises()) {
            var exercise = exercises.save(Exercise.builder()
                    .name(e.name())
                    .category(ExerciseCategory.valueOf(e.category()))
                    .equipment(e.equipment())
                    .muscleGroups(new ArrayList<>(e.muscles()))
                    .steps(new ArrayList<>(e.steps()))
                    .build());

            for (var l : e.links()) {
                links.save(ExerciseSport.builder()
                        .exercise(exercise)
                        .sport(byCode.get(l.sport()))
                        .relevanceScore(l.score())
                        .rationale(l.why())
                        .build());
                pairs++;
            }
        }

        log.info("Seed Forja aplicado: {} esportes · {} exercícios · {} pares exercise_sport.",
                byCode.size(), data.exercises().size(), pairs);
    }
}
