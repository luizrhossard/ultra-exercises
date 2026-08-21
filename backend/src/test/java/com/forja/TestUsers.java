package com.forja;

import com.jayway.jsonpath.JsonPath;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** Helper para registrar usuários reais via API e extrair o token JWT. */
public final class TestUsers {

    private TestUsers() {
    }

    public static String register(MockMvc mvc, String email) throws Exception {
        var result = mvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content("{\"email\":\"%s\",\"password\":\"senha12345\",\"name\":\"Atleta\"}"
                                .formatted(email)))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isCreated())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.token");
    }
}