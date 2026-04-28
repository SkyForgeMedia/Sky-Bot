const { EmbedBuilder } = require("discord.js");
const crypto = require("crypto");
const net = require("net");
const { execFile } = require("child_process");
const fetch = require("node-fetch");
const dgram = require("dgram");
const MonitorStore = require("./MonitorStore");

class MonitorService {
  constructor(client, store = new MonitorStore()) {
    this.client = client;
    this.store = store;
    this.timers = new Map();
  }

  async initialize() {
    await this.store.initialize();
    for (const monitor of this.store.getAll()) {
      this.scheduleMonitor(monitor);
      this.checkAndPublish(monitor.id).catch(() => {});
    }
  }

  getMonitors(guildId) {
    return guildId ? this.store.getByGuild(guildId) : this.store.getAll();
  }

  async createMonitor({ guildId, channelId, name, host, type, check, port, interval, notify }) {
    const id = crypto.randomUUID();
    const monitor = {
      id,
      guildId,
      channelId,
      name,
      host,
      type,
      check,
      port: port || null,
      interval: Math.max(15, Number(interval || 60)),
      notify: Boolean(notify),
      status: "UNKNOWN",
      latency: null,
      lastCheck: null,
      error: null,
      messageId: null,
    };

    const channel = await this.client.channels.fetch(channelId);
    const embed = this.buildEmbed(monitor);
    const sent = await channel.send({ embeds: [embed] });
    monitor.messageId = sent.id;

    await this.store.add(monitor);
    this.scheduleMonitor(monitor);
    await this.checkAndPublish(monitor.id);
    return monitor;
  }

  async removeMonitor(id) {
    const monitor = this.store.getById(id);
    if (!monitor) return false;
    this.clearSchedule(id);
    await this.store.remove(id);
    return true;
  }

  scheduleMonitor(monitor) {
    this.clearSchedule(monitor.id);
    const timer = setInterval(() => {
      this.checkAndPublish(monitor.id).catch((err) => this.client.logger.error("monitor-check", err));
    }, monitor.interval * 1000);
    this.timers.set(monitor.id, timer);
  }

  clearSchedule(id) {
    if (!this.timers.has(id)) return;
    clearInterval(this.timers.get(id));
    this.timers.delete(id);
  }

  async checkAndPublish(id) {
    const monitor = this.store.getById(id);
    if (!monitor) return;

    const previousStatus = monitor.status;
    const result = await this.runCheck(monitor);

    const patch = {
      status: result.status,
      latency: result.latency,
      lastCheck: new Date().toISOString(),
      error: result.error || null,
      minecraft: result.minecraft || null,
    };
    const updated = await this.store.update(id, patch);
    if (!updated) return;

    await this.updateDiscordMessage(updated);

    if (updated.notify && previousStatus && previousStatus !== "UNKNOWN" && previousStatus !== updated.status) {
      await this.sendStatusChangeNotice(updated, previousStatus);
    }
  }

  async updateDiscordMessage(monitor) {
    if (!monitor.channelId || !monitor.messageId) return;
    try {
      const channel = await this.client.channels.fetch(monitor.channelId);
      const message = await channel.messages.fetch(monitor.messageId);
      await message.edit({ embeds: [this.buildEmbed(monitor)] });
    } catch (err) {
      this.client.logger.warn(`Failed to update monitor message ${monitor.id}: ${err.message}`);
    }
  }

  async sendStatusChangeNotice(monitor, oldStatus) {
    try {
      const channel = await this.client.channels.fetch(monitor.channelId);
      await channel.send(`🔔 **${monitor.name}** status changed: \
\`${oldStatus}\` → **${monitor.status}**`);
    } catch (err) {
      this.client.logger.warn(`Failed to send monitor status notice ${monitor.id}: ${err.message}`);
    }
  }

  buildEmbed(monitor) {
    const color = monitor.status === "ONLINE" ? 0x57f287 : monitor.status === "OFFLINE" ? 0xed4245 : 0xfee75c;
    const latency = monitor.latency != null ? `${monitor.latency} ms` : "-";
    const port = monitor.port || (monitor.type === "minecraft" ? 25565 : "-");
    const lastCheck = monitor.lastCheck ? `<t:${Math.floor(new Date(monitor.lastCheck).getTime() / 1000)}:R>` : "never";

    const embed = new EmbedBuilder()
      .setTitle(`📡 Monitor: ${monitor.name}`)
      .setColor(color)
      .addFields(
        { name: "Status", value: monitor.status || "UNKNOWN", inline: true },
        { name: "Latenz", value: latency, inline: true },
        { name: "Check", value: monitor.check.toUpperCase(), inline: true },
        { name: "Host", value: monitor.host, inline: true },
        { name: "Port", value: String(port), inline: true },
        { name: "Letzter Check", value: lastCheck, inline: true }
      )
      .setFooter({ text: `Intervall: ${monitor.interval}s • Typ: ${monitor.type}` })
      .setTimestamp();

    if (monitor.error) embed.addFields({ name: "Fehler", value: `\`${monitor.error}\`` });
    if (monitor.minecraft?.players) {
      embed.addFields({
        name: "Minecraft",
        value: `Spieler: ${monitor.minecraft.players.online}/${monitor.minecraft.players.max}`,
      });
    }

    return embed;
  }

  async runCheck(monitor) {
    try {
      if (monitor.type === "minecraft") {
        const mcCheck = ["icmp", "tcp"].includes(monitor.check) ? monitor.check : "tcp";
        return await this.checkMinecraft(monitor.host, monitor.port || 25565, mcCheck);
      }

      if (monitor.check === "icmp") {
        return await this.checkIcmp(monitor.host);
      }

      if (monitor.check === "udp") {
        return await this.checkUdp(monitor.host, monitor.port || 53);
      }

      if (monitor.check === "http") {
        return await this.checkHttp(monitor.host, false);
      }

      if (monitor.check === "https") {
        return await this.checkHttp(monitor.host, true);
      }

      return await this.checkTcp(monitor.host, monitor.port || 22);
    } catch (err) {
      return {
        status: "OFFLINE",
        latency: null,
        error: err.message || "Unknown error",
      };
    }
  }

  checkIcmp(host) {
    return new Promise((resolve) => {
      const started = Date.now();
      execFile("ping", ["-c", "1", "-W", "2", host], { timeout: 3000 }, (error, stdout = "") => {
        if (error) {
          return resolve({ status: "OFFLINE", latency: null, error: "ICMP timeout/unreachable" });
        }

        const match = stdout.match(/time=([\d.]+)/);
        const latency = match ? Math.round(Number(match[1])) : Date.now() - started;
        resolve({ status: "ONLINE", latency, error: null });
      });
    });
  }

  checkTcp(host, port) {
    return new Promise((resolve) => {
      const started = Date.now();
      const socket = new net.Socket();
      let completed = false;

      const done = (payload) => {
        if (completed) return;
        completed = true;
        socket.destroy();
        resolve(payload);
      };

      socket.setTimeout(3000);
      socket.once("connect", () => done({ status: "ONLINE", latency: Date.now() - started, error: null }));
      socket.once("timeout", () => done({ status: "OFFLINE", latency: null, error: "TCP timeout" }));
      socket.once("error", (err) => done({ status: "OFFLINE", latency: null, error: err.code || err.message }));
      socket.connect(Number(port), host);
    });
  }

  checkUdp(host, port) {
    return new Promise((resolve) => {
      const socket = dgram.createSocket("udp4");
      const started = Date.now();
      let done = false;

      const finish = (payload) => {
        if (done) return;
        done = true;
        socket.close();
        resolve(payload);
      };

      const timeout = setTimeout(() => {
        finish({ status: "UNKNOWN", latency: null, error: "No UDP response" });
      }, 3000);

      socket.on("message", () => {
        clearTimeout(timeout);
        finish({ status: "ONLINE", latency: Date.now() - started, error: null });
      });

      socket.on("error", (err) => {
        clearTimeout(timeout);
        finish({ status: "OFFLINE", latency: null, error: err.code || err.message });
      });

      const probe = Buffer.from("ping");
      socket.send(probe, Number(port), host, (err) => {
        if (err) {
          clearTimeout(timeout);
          finish({ status: "OFFLINE", latency: null, error: err.code || err.message });
        }
      });
    });
  }

  async checkHttp(host, secure = false) {
    const started = Date.now();
    const base = host.startsWith("http://") || host.startsWith("https://") ? host : `${secure ? "https" : "http"}://${host}`;
    const url = base.endsWith("/") ? base : `${base}/`;

    try {
      const response = await fetch(url, { timeout: 4000, redirect: "follow" });
      const latency = Date.now() - started;
      if (response.status >= 200 && response.status < 500) {
        return { status: "ONLINE", latency, error: null };
      }
      return { status: "UNKNOWN", latency, error: `HTTP ${response.status}` };
    } catch (err) {
      return { status: "OFFLINE", latency: null, error: err.code || err.message || "HTTP request failed" };
    }
  }

  async checkMinecraft(host, port, check = "tcp") {
    const base = check === "icmp" ? await this.checkIcmp(host) : await this.checkTcp(host, port);
    if (base.status !== "ONLINE") return base;

    try {
      const response = await fetch(`https://api.mcsrvstat.us/2/${host}:${port}`, { timeout: 4000 });
      if (!response.ok) return base;
      const data = await response.json();
      if (!data.online) return { ...base, status: "OFFLINE", error: "Minecraft offline" };
      return {
        ...base,
        minecraft: {
          players: data.players || null,
          version: data.version || null,
        },
      };
    } catch {
      return base;
    }
  }
}

module.exports = MonitorService;
