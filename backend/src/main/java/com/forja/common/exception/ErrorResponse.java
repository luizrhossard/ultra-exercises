package com.forja.common.exception;

import java.time.Instant;
import java.util.List;

/** Contrato padronizado de erro da API (docs/architecture/backend-current-state.md, Fase 5). */
public record ErrorResponse(
        Instant timestamp,
        int status,
        String error,
        String message,
        List<FieldError> fields,
        String traceId) {

    public record FieldError(String field, String message) {
    }

    public static ErrorResponse of(int status, String error, String message) {
        return new ErrorResponse(Instant.now(), status, error, message, List.of(), null);
    }

    public static ErrorResponse of(int status, String error, String message, List<FieldError> fields) {
        return new ErrorResponse(Instant.now(), status, error, message, fields, null);
    }

    public static ErrorResponse of(int status, String error, String message, List<FieldError> fields, String traceId) {
        return new ErrorResponse(Instant.now(), status, error, message, fields, traceId);
    }
}