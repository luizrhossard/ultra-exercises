package com.forja.service;

import com.forja.domain.Exercise;
import com.forja.domain.ExerciseCategory;
import com.forja.domain.ExerciseSport;
import com.forja.domain.Sport;
import com.forja.repository.ExerciseSportRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExerciseFeedServiceTest {

    @Mock ExerciseSportRepository links;

    ExerciseFeedService service;

    @BeforeEach
    void setUp() {
        service = new ExerciseFeedService(links);
    }

    private Sport sport(long id, String code) {
        return Sport.builder().id(id).code(code).name(code).build();
    }

    private Exercise exercise(long id, String name, ExerciseCategory cat, String equipment, List<String> muscles) {
        return Exercise.builder().id(id).name(name).category(cat).equipment(equipment).muscleGroups(muscles).build();
    }

    private ExerciseSport link(Exercise ex, Sport sp, int score) {
        return ExerciseSport.builder().exercise(ex).sport(sp).relevanceScore(score).build();
    }

    @Test
    void emptySportsReturnsEmptyFeed() {
        assertThat(service.feed(List.of(), null, null)).isEmpty();
    }

    @Test
    void ranksByBestScoreThenStrongCount() {
        Sport fut = sport(1L, "futebol");
        Sport cor = sport(2L, "corrida");
        Exercise low = exercise(1L, "Agachamento", ExerciseCategory.FORCA, null, List.of("quadriceps"));
        Exercise high = exercise(2L, "Salto", ExerciseCategory.PLIOMETRIA, null, List.of("panturrilhas"));
        Exercise strong = exercise(3L, "Prancha", ExerciseCategory.CORE, null, List.of("core"));

        when(links.findBySportIdIn(any())).thenReturn(List.of(
                link(low, fut, 3), link(low, cor, 4),      // best 4, strong 1
                link(high, fut, 5),                          // best 5, strong 1
                link(strong, fut, 4), link(strong, cor, 4))); // best 4, strong 2

        var feed = service.feed(List.of(1L, 2L), null, null);

        assertThat(feed).extracting(ExerciseFeedService.FeedItem::exerciseId)
                .containsExactly(2L, 3L, 1L);
    }

    @Test
    void filtersByQueryOnNameMuscleAndEquipment() {
        Sport fut = sport(1L, "futebol");
        Exercise agach = exercise(1L, "Agachamento Búlgaro", ExerciseCategory.FORCA, "Halteres", List.of("quadriceps"));
        Exercise salto = exercise(2L, "Salto na Caixa", ExerciseCategory.PLIOMETRIA, "Caixa", List.of("panturrilhas"));

        when(links.findBySportIdIn(any())).thenReturn(List.of(link(agach, fut, 5), link(salto, fut, 5)));

        assertThat(service.feed(List.of(1L), "agachamento", null))
                .extracting(ExerciseFeedService.FeedItem::exerciseId).containsExactly(1L);
        assertThat(service.feed(List.of(1L), "PANTURRILHAS", null))
                .extracting(ExerciseFeedService.FeedItem::exerciseId).containsExactly(2L);
        assertThat(service.feed(List.of(1L), "caixa", null))
                .extracting(ExerciseFeedService.FeedItem::exerciseId).containsExactly(2L);
        assertThat(service.feed(List.of(1L), "inexistente", null)).isEmpty();
    }

    @Test
    void filtersByCategory() {
        Sport fut = sport(1L, "futebol");
        Exercise agach = exercise(1L, "Agachamento", ExerciseCategory.FORCA, null, List.of("quadriceps"));
        Exercise salto = exercise(2L, "Salto", ExerciseCategory.PLIOMETRIA, null, List.of("panturrilhas"));

        when(links.findBySportIdIn(any())).thenReturn(List.of(link(agach, fut, 5), link(salto, fut, 5)));

        assertThat(service.feed(List.of(1L), null, ExerciseCategory.FORCA))
                .extracting(ExerciseFeedService.FeedItem::exerciseId).containsExactly(1L);
        assertThat(service.feed(List.of(1L), null, ExerciseCategory.PLIOMETRIA))
                .extracting(ExerciseFeedService.FeedItem::exerciseId).containsExactly(2L);
    }
}