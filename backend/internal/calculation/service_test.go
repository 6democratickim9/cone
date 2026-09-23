package calculation

import (
	"encoding/json"
	"math"
	"path/filepath"
	"testing"
)

type memoryRepository struct{ items []Calculation }

func (m *memoryRepository) List() ([]Calculation, error) { return m.items, nil }
func (m *memoryRepository) Create(item Calculation) (Calculation, error) {
	m.items = append(m.items, item)
	return item, nil
}
func (m *memoryRepository) Update(string, UpdateInput) (Calculation, error) {
	return Calculation{}, nil
}
func (m *memoryRepository) Delete(string) error { return nil }

func TestCreateScalesToTarget(t *testing.T) {
	service := NewService(&memoryRepository{})
	got, err := service.Create(CreateInput{Target: 500, Ingredients: []Ingredient{
		{ID: 1, Name: "장석", Amount: 3, Kind: "base"},
		{ID: 2, Name: "석회석", Amount: 4, Kind: "base"},
		{ID: 3, Name: "규석", Amount: 3, Kind: "base"},
		{ID: 4, Name: "아연", Amount: 11, Kind: "additive"},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if math.Abs(got.OriginalTotal-11.1) > 0.000001 {
		t.Fatalf("original total = %f", got.OriginalTotal)
	}
	total := 0.0
	for _, row := range got.Rows {
		total += row.ScaledGrams
	}
	if math.Abs(total-500) > 0.000001 {
		t.Fatalf("scaled total = %f", total)
	}
	if math.Abs(got.Rows[3].ScaledGrams-49.5495495) > 0.0001 {
		t.Fatalf("additive = %f", got.Rows[3].ScaledGrams)
	}
}

func TestRejectsMissingBase(t *testing.T) {
	service := NewService(&memoryRepository{})
	_, err := service.Create(CreateInput{Target: 100, Ingredients: []Ingredient{{ID: 1, Name: "아연", Amount: 5, Kind: "additive"}}})
	if err == nil {
		t.Fatal("expected validation error")
	}
}

func TestRejectsOutOfRangeAdditive(t *testing.T) {
	err := Validate(CreateInput{Target: 100, Ingredients: []Ingredient{{ID: 1, Name: "장석", Amount: 100, Kind: "base"}, {ID: 2, Name: "아연", Amount: 41, Kind: "additive"}}})
	if err == nil {
		t.Fatal("expected validation error")
	}
}

func TestEmptyFileRepositorySerializesAsArray(t *testing.T) {
	repo, err := NewFileRepository(filepath.Join(t.TempDir(), "calculations.json"))
	if err != nil {
		t.Fatal(err)
	}
	items, err := repo.List()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(items)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "[]" {
		t.Fatalf("empty list JSON = %s, want []", data)
	}
}
