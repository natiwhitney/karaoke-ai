# AI-Oke

## Introduction

This project uses Docker Compose to manage the application and its dependencies. This guide will help you set up your environment, including adding a `.env` file with a Genius API key and building the project using Docker Compose.

## Installation and Setup

### Prerequisites

- Docker
- Docker Compose

### Steps


1. Create a `.env` file in the root directory and add the following environment variables:
    ```env
    GENIUS_TOKEN=your_genius_token
    OLLAMA_HOST=http://localhost:11434
    ```

2. Build and start the containers:
    ```sh
    docker-compose up --build
    ```

3. Access the frontend application at `http://localhost`.

### Notes

- Ensure that the `GENIUS_TOKEN` and `OLLAMA_HOST` environment variables are correctly set in the `.env` file.
- The `frontend` service will be available on port 80.
- The `api` service will have access to the `downloads` and `temp` directories as specified in the `docker-compose.yml` file.