# Forja API — Spring Boot

Backend do Forja: agregador de exercícios mapeados por especificidades esportivas.
Relação N:N `exercise × sport` com `relevance_score` (1–5) + rationale.

## Stack

- Java 21 · Spring Boot 3.3 (Web, Data JPA, Security, Validation)
- PostgreSQL 16 + Flyway (migrations versionadas)
- Auth stateless com JWT (HS256) + BCrypt
- Seed idempotente a partir de `src/main/resources/seed/data.json`

## Rodando

```bash
docker compose up -d db          # sobe o PostgreSQL
./mvnw spring-boot:run           # Flyway migra + DataSeeder popula a base
```

A API responde em `http://localhost:8080`. O build do frontend (Vite) pode ser
servido de `src/main/resources/static` ou do dev server em `:5173` (CORS já liberado).

## Endpoints principais

| Método | Rota                                   | Auth | Descrição                                  |
|--------|----------------------------------------|------|--------------------------------------------|
| POST   | `/api/auth/register` · `/login`        | —    | Cria conta / emite JWT                     |
| GET    | `/api/sports`                          | —    | Catálogo de esportes                       |
| GET    | `/api/exercises/feed?sportIds=1,2`     | —    | Feed ordenado por relevância (hot path)    |
| GET    | `/api/exercises/{id}`                  | —    | Detalhe + rationale por esporte            |
| GET    | `/api/routines`                        | JWT  | Rotinas do usuário                         |
| POST   | `/api/routines/generate`               | JWT  | Gera o treino do dia para um esporte foco  |
| PATCH  | `/api/routines/{id}/items/{exerciseId}`| JWT  | Ajusta séries/descanso                     |
