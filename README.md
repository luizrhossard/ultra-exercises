# ultra-exercises
Agendamento de Treinos Esportivos

Este projeto é composto por duas partes principais: o **Frontend** (React + Vite) e o **Backend** (Spring Boot + PostgreSQL).

---

## 🚀 Como Rodar o Projeto Locally

### 1. Requisitos Prévios
Certifique-se de ter instalado:
*   [Node.js](https://nodejs.org/) (LTS)
*   [Java JDK 21+](https://adoptium.net/) (JDK 25 é suportado)
*   [Docker Desktop](https://www.docker.com/products/docker-desktop/) (para o banco de dados)
*   [Maven](https://maven.apache.org/) instalado globalmente (`mvn`)

---

### 2. Rodando o Banco de Dados (PostgreSQL via Docker)

O banco de dados roda via Docker. O mapeamento da porta no host foi alterado para **`5433`** para evitar conflitos caso você já tenha o PostgreSQL instalado localmente na porta padrão `5432`.

Acesse a pasta `backend/` e execute:
```powershell
docker compose up -d db
```

---

### 3. Rodando o Backend (API Spring Boot)

O servidor de backend está configurado para iniciar na porta **`8085`** (evitando conflito com a porta `8080`).

Acesse a pasta `backend/` e execute:
```powershell
mvn spring-boot:run
```

A API estará disponível em `http://localhost:8085`. O Flyway executará as migrações automaticamente ao iniciar e aplicará o seed inicial de dados.

---

### 4. Rodando o Frontend (React + Vite)

O frontend roda na porta **`3000`**.

Na pasta raiz do projeto (`ultra-exercises/`), execute:
```powershell
# Instalar dependências (apenas na primeira vez)
npm install

# Iniciar o servidor de desenvolvimento
npm run dev
```

Acesse o aplicativo no seu navegador em: `http://localhost:3000`
