package com.forja;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * Forja — agregador de exercícios mapeados por especificidades esportivas.
 *
 * <p>O domínio central é a relação N:N reificada {@code exercise_sport},
 * que carrega o {@code relevance_score} (1–5) e o rationale de cada par
 * exercício × esporte. O feed ordena por relevância e o gerador de rotinas
 * pondera o esporte foco em dobro.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class ForjaApplication {

    public static void main(String[] args) {
        SpringApplication.run(ForjaApplication.class, args);
    }
}
