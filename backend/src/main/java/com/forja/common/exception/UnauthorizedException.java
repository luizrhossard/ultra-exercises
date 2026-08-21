package com.forja.common.exception;

/** Falha de autenticação com credenciais inválidas (401 com corpo padronizado). */
public class UnauthorizedException extends RuntimeException {
    public UnauthorizedException(String message) {
        super(message);
    }
}