package com.forja.common.exception;

import com.forja.config.TraceIdFilter;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * Centraliza o contrato de erro da API. Nunca expõe stack traces, SQL ou
 * detalhes internos ao cliente (Fase 4 do épico de unificação).
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** TraceId criado pelo TraceIdFilter; presente em toda requisição. */
    private static String currentTraceId() {
        String traceId = MDC.get(TraceIdFilter.MDC_KEY);
        return traceId != null ? traceId : UUID.randomUUID().toString();
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        List<ErrorResponse.FieldError> fields = ex.getBindingResult().getFieldErrors().stream()
                .map(f -> new ErrorResponse.FieldError(f.getField(), f.getDefaultMessage()))
                .toList();
        log.debug("Validação falhou [traceId={}]: {}", currentTraceId(), ex.getMessage());
        return ResponseEntity.badRequest()
                .body(ErrorResponse.of(400, "VALIDATION_ERROR", "Dados inválidos.", fields, currentTraceId()));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<ErrorResponse> handleConstraint(ConstraintViolationException ex) {
        List<ErrorResponse.FieldError> fields = ex.getConstraintViolations().stream()
                .map(v -> new ErrorResponse.FieldError(v.getPropertyPath().toString(), v.getMessage()))
                .toList();
        log.debug("Validação falhou [traceId={}]: {}", currentTraceId(), ex.getMessage());
        return ResponseEntity.badRequest()
                .body(ErrorResponse.of(400, "VALIDATION_ERROR", "Dados inválidos.", fields, currentTraceId()));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MissingServletRequestParameterException.class})
    ResponseEntity<ErrorResponse> handleBadRequest(Exception ex) {
        return ResponseEntity.badRequest()
                .body(ErrorResponse.of(400, "BAD_REQUEST", "Requisição inválida.", List.of(), currentTraceId()));
    }

    /** [UE-42] Query params com tipo/formato inválido (ex.: data fora do ISO) seguem o contrato ErrorResponse. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        log.debug("Parâmetro inválido [traceId={}]: {}", currentTraceId(), ex.getMessage());
        return ResponseEntity.badRequest()
                .body(ErrorResponse.of(400, "BAD_REQUEST", "Parâmetro inválido.", List.of(), currentTraceId()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest()
                .body(ErrorResponse.of(400, "BAD_REQUEST",
                        ex.getMessage() == null ? "Requisição inválida." : ex.getMessage(),
                        List.of(), currentTraceId()));
    }

    @ExceptionHandler(UnauthorizedException.class)
    ResponseEntity<ErrorResponse> handleUnauthorized(UnauthorizedException ex) {
        // INFO sem stack trace: falha esperada de autenticação, útil para monitorar tentativas.
        log.info("Autenticação recusada [traceId={}]", currentTraceId());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ErrorResponse.of(401, "UNAUTHORIZED",
                        ex.getMessage() == null ? "Autenticação necessária." : ex.getMessage(),
                        List.of(), currentTraceId()));
    }

    @ExceptionHandler(NoSuchElementException.class)
    ResponseEntity<ErrorResponse> handleNotFound(NoSuchElementException ex) {
        log.info("Recurso não encontrado [traceId={}]", currentTraceId());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ErrorResponse.of(404, "NOT_FOUND",
                        ex.getMessage() == null ? "Recurso não encontrado." : ex.getMessage(),
                        List.of(), currentTraceId()));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> handleUnexpected(Exception ex) {
        String traceId = currentTraceId();
        log.error("Erro interno [traceId={}]", traceId, ex);
        return ResponseEntity.internalServerError()
                .body(ErrorResponse.of(500, "INTERNAL_ERROR", "Erro interno inesperado.", List.of(), traceId));
    }
}