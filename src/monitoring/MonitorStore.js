const fs = require("fs");
const path = require("path");

class MonitorStore {
  constructor(filePath = path.join(process.cwd(), "data", "monitors.json")) {
    this.filePath = filePath;
    this.monitors = [];
  }

  async initialize() {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await fs.promises.readFile(this.filePath, "utf8");
      this.monitors = JSON.parse(raw);
      if (!Array.isArray(this.monitors)) this.monitors = [];
    } catch {
      this.monitors = [];
      await this.save();
    }
  }

  async save() {
    await fs.promises.writeFile(this.filePath, JSON.stringify(this.monitors, null, 2), "utf8");
  }

  getAll() {
    return [...this.monitors];
  }

  getByGuild(guildId) {
    return this.monitors.filter((m) => m.guildId === guildId);
  }

  getById(id) {
    return this.monitors.find((m) => m.id === id);
  }

  async add(monitor) {
    this.monitors.push(monitor);
    await this.save();
    return monitor;
  }

  async remove(id) {
    const prev = this.monitors.length;
    this.monitors = this.monitors.filter((m) => m.id !== id);
    await this.save();
    return this.monitors.length < prev;
  }

  async update(id, patch) {
    const monitor = this.monitors.find((m) => m.id === id);
    if (!monitor) return null;
    Object.assign(monitor, patch);
    await this.save();
    return monitor;
  }
}

module.exports = MonitorStore;
