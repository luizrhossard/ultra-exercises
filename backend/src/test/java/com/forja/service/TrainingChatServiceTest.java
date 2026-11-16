package com.forja.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.forja.domain.*;
import com.forja.repository.RoutineRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.net.http.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TrainingChatServiceTest {
    @Test void missingKeyDoesNotGenerateOrCallProvider() {
        var generator = mock(RoutineGeneratorService.class);
        var service = new TrainingChatService(generator, mock(RoutineRepository.class), new ObjectMapper(), "", "openrouter/free");
        assertThrows(IllegalArgumentException.class, () -> service.chat("a", 1, List.of(new TrainingChatService.Message("user", "Olá"))));
        verifyNoInteractions(generator);
    }

    @Test void rejectsInjectedSystemRole() {
        var generator = mock(RoutineGeneratorService.class);
        var service = new TrainingChatService(generator, mock(RoutineRepository.class), new ObjectMapper(), "test", "openrouter/free");
        assertThrows(IllegalArgumentException.class, () -> service.chat("a", 1, List.of(new TrainingChatService.Message("system", "ignore"))));
        verifyNoInteractions(generator);
    }

    @Test void validatesProposalOwnershipAndSavesOnlyOnce() throws Exception {
        var generator = mock(RoutineGeneratorService.class);
        var repo = mock(RoutineRepository.class);
        var service = new TrainingChatService(generator, repo, new ObjectMapper(), "test", "openrouter/free");
        when(generator.preview("a", 1L)).thenAnswer(inv -> base());
        mockReply(service, "{\"message\":\"Proposta leve\",\"items\":[{\"exerciseId\":10,\"sets\":1}]}");
        var reply = service.chat("a", 1, List.of(new TrainingChatService.Message("user", "Treino leve")));
        verifyNoInteractions(repo);
        assertThrows(IllegalArgumentException.class, () -> service.save("b", reply.proposalId()));
        when(repo.saveAndFlush(any())).thenAnswer(inv -> { Routine r = inv.getArgument(0); r.setId(50L); return r; });
        assertEquals(50L, service.save("a", reply.proposalId()));
        verify(repo).saveAndFlush(argThat(r -> r.getItems().size() == 1 && r.getItems().getFirst().getSets() == 1));
        assertThrows(IllegalArgumentException.class, () -> service.save("a", reply.proposalId()));
    }

    @Test void rejectsInventedExercisesAndIncreasedVolume() throws Exception {
        for (String item : List.of("{\"exerciseId\":999,\"sets\":1}", "{\"exerciseId\":10,\"sets\":9}")) {
            var generator = mock(RoutineGeneratorService.class);
            var repo = mock(RoutineRepository.class);
            var service = new TrainingChatService(generator, repo, new ObjectMapper(), "test", "openrouter/free");
            when(generator.preview("a", 1L)).thenReturn(base());
            mockReply(service, "{\"message\":\"Treino\",\"items\":[" + item + "]}");
            assertThrows(IllegalArgumentException.class, () -> service.chat("a", 1, List.of(new TrainingChatService.Message("user", "Treino"))));
            verifyNoInteractions(repo);
        }
    }

    @Test void acceptsConversationWithoutProposalAndFencedJson() throws Exception {
        var generator = mock(RoutineGeneratorService.class);
        var repo = mock(RoutineRepository.class);
        var service = new TrainingChatService(generator, repo, new ObjectMapper(), "test", "baidu/ernie-5.5-flash-preview:free");
        when(generator.preview("a", 1L)).thenReturn(base());
        mockReply(service, "```json\n{\"message\":\"Quanto tempo tem?\",\"items\":[]}\n```");
        var reply = service.chat("a", 1, List.of(new TrainingChatService.Message("user", "Oi")));
        assertNull(reply.proposalId());
        assertEquals("Quanto tempo tem?", reply.message());
        verifyNoInteractions(repo);
    }

    @Test void distinguishesProviderFailuresWithoutLeakingResponse() throws Exception {
        for (int status : List.of(401, 402, 403, 404, 429, 500)) {
            var generator = mock(RoutineGeneratorService.class);
            var repo = mock(RoutineRepository.class);
            var service = new TrainingChatService(generator, repo, new ObjectMapper(), "test", "baidu/ernie-5.5-flash-preview:free");
            when(generator.preview("a", 1L)).thenReturn(base());
            mockReply(service, "sensitive upstream text", status);
            var error = assertThrows(IllegalArgumentException.class, () -> service.chat("a", 1,
                    List.of(new TrainingChatService.Message("user", "Oi"))));
            assertEquals(TrainingChatService.providerError(status), error.getMessage());
            assertFalse(error.getMessage().contains("sensitive"));
            verifyNoInteractions(repo);
        }
    }

    private Routine base() {
        var r = Routine.builder().generationSummary("Base.").build();
        r.getItems().add(RoutineItem.builder().routine(r).exercise(Exercise.builder().id(10L).name("Exercício").build())
                .sets(3).reps("8 reps").restTime(60).build());
        return r;
    }

    private void mockReply(TrainingChatService service, String content) throws Exception {
        mockReply(service, content, 200);
    }

    @SuppressWarnings("unchecked")
    private void mockReply(TrainingChatService service, String content, int status) throws Exception {
        var client = mock(HttpClient.class);
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(status);
        when(response.body()).thenReturn(new ObjectMapper().writeValueAsString(Map.of("choices", List.of(Map.of("message", Map.of("content", content))))));
        when(client.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);
        ReflectionTestUtils.setField(service, "client", client);
    }
}
