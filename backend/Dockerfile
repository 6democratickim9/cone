FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /cone-api ./cmd/api

FROM alpine:3.22
WORKDIR /app
COPY --from=build /cone-api /app/cone-api
RUN addgroup -S cone && adduser -S cone -G cone && mkdir -p /data && chown cone:cone /data
USER cone:cone
EXPOSE 8080
ENTRYPOINT ["/app/cone-api"]
