name: ako
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: ako
      POSTGRES_PASSWORD: ako
      POSTGRES_DB: ako
    ports:
      - "5432:5432"
    volumes:
      - dbdata:/var/lib/postgresql/data
      - ./db:/docker-entrypoint-initdb.d

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  nats:
    image: nats:2
    ports:
      - "4222:4222"
      - "8222:8222"

  api:
    image: node:20-alpine
    working_dir: /app
    command: sh -c "npm ci && npm run dev"
    environment:
      DATABASE_URL: postgresql://ako:ako@db:5432/ako
      REDIS_URL: redis://redis:6379
      NATS_URL: nats://nats:4222
      PORT: 8080
    ports:
      - "8080:8080"
    volumes:
      - ./services/api:/app
    depends_on:
      - db
      - redis
      - nats

  realtime:
    image: node:20-alpine
    working_dir: /app
    command: sh -c "npm ci && npm run dev"
    environment:
      NATS_URL: nats://nats:4222
      REDIS_URL: redis://redis:6379
      PORT: 8090
    ports:
      - "8090:8090"
    volumes:
      - ./services/realtime:/app
    depends_on:
      - redis
      - nats

  web:
    image: node:20-alpine
    working_dir: /app
    command: sh -c "npm ci && npm run dev"
    environment:
      NEXT_PUBLIC_API_BASE: http://localhost:8080/api/v1
      NEXT_PUBLIC_RT_BASE: ws://localhost:8090
    ports:
      - "3000:3000"
    volumes:
      - ./apps/web:/app
    depends_on:
      - api
      - realtime

volumes:
  dbdata:
