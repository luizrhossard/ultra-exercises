package com.forja.common.logging;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.LoggingEvent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

import static org.assertj.core.api.Assertions.assertThat;

class JsonLogLayoutTest {

    private final JsonLogLayout layout = new JsonLogLayout();
    private final ObjectMapper json = new ObjectMapper();
    // Contexto real do Logback (via SLF4J): garante MDCAdapter inicializado nos eventos.
    private final LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();

    @BeforeEach
    void setUp() {
        MDC.clear();
    }

    @AfterEach
    void tearDown() {
        MDC.clear();
    }

    private LoggingEvent event(Level level, String message, Throwable throwable) {
        return new LoggingEvent("com.forja.Foo", context.getLogger("com.forja.Foo"),
                level, message, throwable, new Object[0]);
    }

    @Test
    void emitsValidJsonWithCoreFields() throws Exception {
        MDC.put("traceId", "trace-abc-123");
        LoggingEvent event = event(Level.INFO, "POST /api/routines -> 201", null);

        JsonNode node = json.readTree(layout.doLayout(event));

        assertThat(node.get("level").asText()).isEqualTo("INFO");
        assertThat(node.get("message").asText()).isEqualTo("POST /api/routines -> 201");
        assertThat(node.get("service").asText()).isEqualTo("forja-api");
        assertThat(node.get("environment").asText()).isEqualTo("dev");
        assertThat(node.get("logger").asText()).isEqualTo("com.forja.Foo");
        assertThat(node.get("traceId").asText()).isEqualTo("trace-abc-123");
        assertThat(node.has("timestamp")).isTrue();
        assertThat(node.has("stackTrace")).isFalse();
    }

    @Test
    void mergesMdcFieldsIntoOutput() throws Exception {
        MDC.put("http_method", "POST");
        MDC.put("http_path", "/api/auth/login");
        MDC.put("http_status", "200");
        MDC.put("duration_ms", "42");
        LoggingEvent event = event(Level.INFO, "ok", null);

        JsonNode node = json.readTree(layout.doLayout(event));

        assertThat(node.get("http_method").asText()).isEqualTo("POST");
        assertThat(node.get("http_path").asText()).isEqualTo("/api/auth/login");
        assertThat(node.get("http_status").asText()).isEqualTo("200");
        assertThat(node.get("duration_ms").asText()).isEqualTo("42");
    }

    @Test
    void escapesSpecialCharactersInMessage() throws Exception {
        LoggingEvent event = event(Level.WARN, "mensagem com \"aspas\" e \\ barra", null);

        String raw = layout.doLayout(event);
        JsonNode node = json.readTree(raw);

        assertThat(node.get("message").asText()).isEqualTo("mensagem com \"aspas\" e \\ barra");
    }

    @Test
    void includesStackTraceForErrors() throws Exception {
        LoggingEvent event = event(Level.ERROR, "Erro interno", new IllegalStateException("boom"));

        JsonNode node = json.readTree(layout.doLayout(event));

        assertThat(node.get("stackTrace").asText()).contains("IllegalStateException").contains("boom");
    }

    @Test
    void respectsConfiguredServiceAndEnvironment() throws Exception {
        layout.setService("outro-servico");
        layout.setEnvironment("staging");

        JsonNode node = json.readTree(layout.doLayout(event(Level.DEBUG, "x", null)));

        assertThat(node.get("service").asText()).isEqualTo("outro-servico");
        assertThat(node.get("environment").asText()).isEqualTo("staging");
    }
}
