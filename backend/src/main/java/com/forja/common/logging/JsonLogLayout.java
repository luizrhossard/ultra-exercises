package com.forja.common.logging;

import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.ThrowableProxyUtil;
import ch.qos.logback.core.LayoutBase;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Layout Logback que emite uma linha JSON por evento de log (sem dependências
 * extras: usa Jackson, já presente via Spring Boot). Campos fixos + todas as
 * entradas do MDC (traceId, http_*). Usado apenas no perfil prod; em dev os
 * logs seguem legíveis (ver logback-spring.xml).
 */
public class JsonLogLayout extends LayoutBase<ILoggingEvent> {

    private static final ObjectMapper JSON = new ObjectMapper();

    private String service = "forja-api";
    private String environment = "dev";

    public void setService(String service) {
        this.service = service;
    }

    public void setEnvironment(String environment) {
        this.environment = environment;
    }

    @Override
    public String doLayout(ILoggingEvent event) {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("timestamp", Instant.ofEpochMilli(event.getTimeStamp()).toString());
        fields.put("level", event.getLevel().toString());
        fields.put("service", service);
        fields.put("environment", environment);
        fields.put("logger", event.getLoggerName());
        fields.put("thread", event.getThreadName());

        // MDC primeiro: traceId e http_* entram como campos de primeira classe.
        Map<String, String> mdc = event.getMDCPropertyMap();
        if (mdc != null) {
            mdc.forEach(fields::put);
        }

        fields.put("message", event.getFormattedMessage());
        if (event.getThrowableProxy() != null) {
            fields.put("stackTrace", ThrowableProxyUtil.asString(event.getThrowableProxy()));
        }

        try {
            return JSON.writeValueAsString(fields) + System.lineSeparator();
        } catch (Exception e) {
            // Fallback seguro: nunca quebra a emissão do log por falha de serialização.
            return "{\"level\":\"ERROR\",\"message\":\"falha ao serializar evento de log\"}"
                    + System.lineSeparator();
        }
    }
}
