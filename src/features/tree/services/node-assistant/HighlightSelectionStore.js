class HighlightSelectionStore {
  constructor() {
    this.sources = new Map();
  }

  addSources(sources = []) {
    if (!Array.isArray(sources)) return { added: false, size: this.size() };

    let added = false;

    sources.forEach((source) => {
      if (!source) return;
      const { id, text } = source;
      if (typeof text !== 'string') return;
      const normalized = text.trim();
      if (!normalized) return;

      const sourceId = typeof id === 'string' && id.trim()
        ? id
        : `${normalized}-${Math.random().toString(36).slice(2, 10)}`;

      if (!this.sources.has(sourceId)) {
        added = true;
      }
      this.sources.set(sourceId, normalized);
    });

    return { added, size: this.size() };
  }

  removeByIds(ids = []) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { removed: false, size: this.size() };
    }

    let removed = false;
    ids.forEach((id) => {
      if (this.sources.delete(id)) {
        removed = true;
      }
    });

    return { removed, size: this.size() };
  }

  getTexts() {
    const unique = new Set();
    this.sources.forEach((text) => {
      if (typeof text !== 'string') return;
      const trimmed = text.trim();
      if (trimmed) {
        unique.add(trimmed);
      }
    });
    return Array.from(unique.values());
  }

  clear() {
    this.sources.clear();
  }

  size() {
    return this.sources.size;
  }
}

export default HighlightSelectionStore;
