package com.forja.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Spec OpenAPI 3 gerada em /v3/api-docs + Swagger UI em /swagger-ui.html (springdoc). */
@Configuration
public class OpenApiConfig {

    @Bean
    OpenAPI forjaOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Forja API")
                        .version("0.1.0")
                        .description("""
                                API oficial do agregador de exercícios esportivos (ADR-001 — Java/Spring).

                                Públicos: autenticação e catálogo (sports/exercises).
                                Privados (Bearer JWT obtido em /api/auth/login|register): perfil, readiness, rotinas e sessões.
                                Erros seguem o contrato ErrorResponse (timestamp, status, error, message, fields, traceId).
                                """))
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"))
                .components(new Components().addSecuritySchemes("bearerAuth",
                        new SecurityScheme()
                                .name("bearerAuth")
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")));
    }
}