package calculation

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"sync"
)

type FileRepository struct {
	path  string
	mu    sync.RWMutex
	items []Calculation
}

func NewFileRepository(path string) (*FileRepository, error) {
	repo := &FileRepository{path: path, items: []Calculation{}}
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return repo, nil
		}
		return nil, err
	}
	if len(data) > 0 {
		if err := json.Unmarshal(data, &repo.items); err != nil {
			return nil, err
		}
	}
	return repo, nil
}

func (r *FileRepository) List() ([]Calculation, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	items := make([]Calculation, len(r.items))
	copy(items, r.items)
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.After(items[j].CreatedAt) })
	return items, nil
}

func (r *FileRepository) Create(item Calculation) (Calculation, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.items = append(r.items, item)
	return item, r.persist()
}

func (r *FileRepository) Update(id string, input UpdateInput) (Calculation, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for i := range r.items {
		if r.items[i].ID == id {
			if input.Favorite != nil {
				r.items[i].Favorite = *input.Favorite
			}
			if input.Saved != nil {
				r.items[i].Saved = *input.Saved
			}
			return r.items[i], r.persist()
		}
	}
	return Calculation{}, ErrNotFound
}

func (r *FileRepository) Delete(id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for i := range r.items {
		if r.items[i].ID == id {
			r.items = append(r.items[:i], r.items[i+1:]...)
			return r.persist()
		}
	}
	return ErrNotFound
}

func (r *FileRepository) persist() error {
	if err := os.MkdirAll(filepath.Dir(r.path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(r.items, "", "  ")
	if err != nil {
		return err
	}
	temp := r.path + ".tmp"
	if err := os.WriteFile(temp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(temp, r.path)
}
