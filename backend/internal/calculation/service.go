package calculation

import (
	"errors"
	"fmt"
	"math"
	"strings"
	"time"
)

var (
	ErrNotFound = errors.New("calculation not found")
	ErrInvalid  = errors.New("invalid calculation")
)

type Repository interface {
	List() ([]Calculation, error)
	Create(Calculation) (Calculation, error)
	Update(string, UpdateInput) (Calculation, error)
	Delete(string) error
}

type Service struct{ repo Repository }

func NewService(repo Repository) *Service { return &Service{repo: repo} }

func (s *Service) List() ([]Calculation, error) { return s.repo.List() }

func (s *Service) Create(input CreateInput) (Calculation, error) {
	if err := Validate(input); err != nil {
		return Calculation{}, err
	}
	baseTotal := 0.0
	for _, item := range input.Ingredients {
		if item.Kind == "base" {
			baseTotal += item.Amount
		}
	}

	rows := make([]ResultRow, 0, len(input.Ingredients))
	originalTotal := baseTotal
	for _, item := range input.Ingredients {
		grams := item.Amount
		if item.Kind == "additive" {
			grams = baseTotal * item.Amount / 100
			originalTotal += grams
		}
		rows = append(rows, ResultRow{Ingredient: item, OriginalGrams: grams})
	}
	scale := input.Target / originalTotal
	for i := range rows {
		rows[i].ScaledGrams = rows[i].OriginalGrams * scale
	}
	now := time.Now().UTC()
	title := input.Ingredients[0].Name
	if len(input.Ingredients) > 1 {
		title = fmt.Sprintf("%s 외 %d종", title, len(input.Ingredients)-1)
	}
	calculation := Calculation{
		ID: fmt.Sprintf("calc_%d", now.UnixNano()), CreatedAt: now, Date: "방금 전", Title: title,
		Target: input.Target, Ingredients: input.Ingredients, BaseTotal: baseTotal,
		OriginalTotal: originalTotal, Scale: scale, Rows: rows,
	}
	return s.repo.Create(calculation)
}

func (s *Service) Update(id string, input UpdateInput) (Calculation, error) {
	if input.Favorite == nil && input.Saved == nil {
		return Calculation{}, fmt.Errorf("%w: favorite or saved is required", ErrInvalid)
	}
	return s.repo.Update(id, input)
}

func (s *Service) Delete(id string) error { return s.repo.Delete(id) }

func Validate(input CreateInput) error {
	if input.Target <= 0 || math.IsNaN(input.Target) || math.IsInf(input.Target, 0) {
		return fmt.Errorf("%w: target must be greater than zero", ErrInvalid)
	}
	if len(input.Ingredients) == 0 {
		return fmt.Errorf("%w: at least one ingredient is required", ErrInvalid)
	}
	baseTotal := 0.0
	for _, item := range input.Ingredients {
		if strings.TrimSpace(item.Name) == "" {
			return fmt.Errorf("%w: ingredient name is required", ErrInvalid)
		}
		if item.Kind != "base" && item.Kind != "additive" {
			return fmt.Errorf("%w: ingredient kind must be base or additive", ErrInvalid)
		}
		if item.Amount <= 0 || math.IsNaN(item.Amount) || math.IsInf(item.Amount, 0) {
			return fmt.Errorf("%w: ingredient amount must be greater than zero", ErrInvalid)
		}
		if item.Kind == "base" {
			baseTotal += item.Amount
		}
		if item.Kind == "additive" && (item.Amount < MinAdditivePercent || item.Amount > MaxAdditivePercent) {
			return fmt.Errorf("%w: additive must be between %.3f%% and %.0f%%", ErrInvalid, MinAdditivePercent, MaxAdditivePercent)
		}
	}
	if baseTotal <= 0 {
		return fmt.Errorf("%w: at least one base ingredient is required", ErrInvalid)
	}
	return nil
}
