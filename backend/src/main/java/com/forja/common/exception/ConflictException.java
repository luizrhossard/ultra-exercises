package com.forja.common.exception;

/** Conflito de negócio (ex.: e-mail já cadastrado) -> 409 com corpo padronizado. */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}
