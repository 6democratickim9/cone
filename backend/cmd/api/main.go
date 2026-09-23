package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"cone/backend/internal/calculation"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	repo, err := calculation.NewFileRepository(env("DATA_FILE", "data/calculations.json"))
	if err != nil {
		logger.Error("repository initialization failed", "error", err)
		os.Exit(1)
	}

	service := calculation.NewService(repo)
	handler := calculation.NewHandler(service, logger)
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", handler.Health)
	mux.HandleFunc("GET /api/calculations", handler.List)
	mux.HandleFunc("POST /api/calculations", handler.Create)
	mux.HandleFunc("PATCH /api/calculations/{id}", handler.Update)
	mux.HandleFunc("DELETE /api/calculations/{id}", handler.Delete)

	server := &http.Server{
		Addr:              env("ADDR", ":8080"),
		Handler:           requestLogger(cors(mux), logger),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		logger.Info("CONE API listening", "address", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		logger.Error("graceful shutdown failed", "error", err)
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "http://localhost:5173" || origin == "http://127.0.0.1:5173" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func requestLogger(next http.Handler, logger *slog.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		next.ServeHTTP(w, r)
		logger.Info("request", "method", r.Method, "path", r.URL.Path, "duration_ms", time.Since(started).Milliseconds())
	})
}
