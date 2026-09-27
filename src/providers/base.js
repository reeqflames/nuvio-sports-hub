export class SportsProvider {
  constructor({ id, name, kind = "metadata", enabled = true }) {
    this.id = id;
    this.name = name;
    this.kind = kind;
    this.enabled = enabled;
  }

  async health() {
    return { id: this.id, name: this.name, kind: this.kind, enabled: this.enabled, ok: true };
  }
}
