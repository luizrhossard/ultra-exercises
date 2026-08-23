package com.forja.web;

import com.forja.TestUsers;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** [UE-29] Compartilhamento público de rotina: geração de link e leitura por token. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql(scripts = "/cleanup.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class ShareFlowIntegrationTest {

    @Autowired
    MockMvc mvc;

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private long seedRoutineWithItems(String token) throws Exception {
        mvc.perform(put("/api/me")
                        .header("Authorization", bearer(token))
                        .contentType("application/json")
                        .content("{\"name\":\"Atleta\",\"sports\":[{\"code\":\"futebol\"}]}"))
                .andExpect(status().isOk());
        String routine = mvc.perform(post("/api/routines/generate")
                        .header("Authorization", bearer(token))
                        .contentType("application/json").content("{\"sportId\":1}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(routine, "$.id")).longValue();
    }

    @Test
    void shareLinkIsGeneratedOnceAndReadPublicly() throws Exception {
        String token = TestUsers.register(mvc, "share-a@forja.com");
        long routineId = seedRoutineWithItems(token);

        // Sem autenticação não gera link.
        mvc.perform(post("/api/routines/" + routineId + "/share"))
                .andExpect(status().isUnauthorized());

        // Outro usuário não pode gerar link da rotina alheia (ownership).
        String tokenB = TestUsers.register(mvc, "share-b@forja.com");
        mvc.perform(post("/api/routines/" + routineId + "/share")
                        .header("Authorization", bearer(tokenB)))
                .andExpect(status().isNotFound());

        // Dono gera o link; segunda chamada devolve a mesma URL (idempotente).
        String first = mvc.perform(post("/api/routines/" + routineId + "/share")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").isNotEmpty())
                .andReturn().getResponse().getContentAsString();
        String url = JsonPath.read(first, "$.url");

        String second = mvc.perform(post("/api/routines/" + routineId + "/share")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        org.assertj.core.api.Assertions.assertThat(JsonPath.<String>read(second, "$.url"))
                .isEqualTo(url);
        String shareToken = url.substring(url.lastIndexOf('/') + 1);

        // Leitura pública sem JWT expõe apenas a prescrição, sem dados do atleta.
        mvc.perform(get("/api/share/" + shareToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").isNotEmpty())
                .andExpect(jsonPath("$.sportName").value("Futebol"))
                .andExpect(jsonPath("$.items.length()").value(org.hamcrest.Matchers.greaterThan(0)))
                .andExpect(jsonPath("$.items[0].exerciseName").isNotEmpty())
                .andExpect(jsonPath("$.email").doesNotExist());

        // Token desconhecido → 404 no contrato padrão com traceId.
        mvc.perform(get("/api/share/nao-existe-123"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.traceId").isNotEmpty());
    }
}
