package calculation

import "time"

const (
	MinAdditivePercent = 0.005
	MaxAdditivePercent = 40.0
)

type Ingredient struct {
	ID     int64   `json:"id"`
	Name   string  `json:"name"`
	Amount float64 `json:"amount"`
	Kind   string  `json:"kind"`
}

type ResultRow struct {
	Ingredient
	OriginalGrams float64 `json:"originalGrams"`
	ScaledGrams   float64 `json:"scaledGrams"`
}

type Calculation struct {
	ID            string       `json:"id"`
	CreatedAt     time.Time    `json:"createdAt"`
	Date          string       `json:"date"`
	Title         string       `json:"title"`
	Target        float64      `json:"target"`
	Ingredients   []Ingredient `json:"ingredients"`
	BaseTotal     float64      `json:"baseTotal"`
	OriginalTotal float64      `json:"originalTotal"`
	Scale         float64      `json:"scale"`
	Rows          []ResultRow  `json:"rows"`
	Favorite      bool         `json:"favorite"`
	Saved         bool         `json:"saved"`
}

type CreateInput struct {
	Target      float64      `json:"target"`
	Ingredients []Ingredient `json:"ingredients"`
}

type UpdateInput struct {
	Favorite *bool `json:"favorite,omitempty"`
	Saved    *bool `json:"saved,omitempty"`
}
