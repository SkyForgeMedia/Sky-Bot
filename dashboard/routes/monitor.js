const express = require("express");
const CheckAuth = require("../auth/CheckAuth");

const router = express.Router();

router.get("/", CheckAuth, async (req, res) => {
  const allowedGuildIds = (req.userInfos.displayedGuilds || []).map((g) => g.id);
  const requestedGuildId = req.query.guildId || req.userInfos.displayedGuilds?.[0]?.id;
  const guildId = allowedGuildIds.includes(requestedGuildId) ? requestedGuildId : req.userInfos.displayedGuilds?.[0]?.id;
  const guild = guildId ? req.client.guilds.cache.get(guildId) : null;

  const monitors = guildId && req.client.monitorService ? req.client.monitorService.getMonitors(guildId) : [];
  const channels = guild
    ? guild.channels.cache
        .filter((ch) => ch.type === 0)
        .sort((a, b) => a.rawPosition - b.rawPosition)
        .map((ch) => ch)
    : [];

  res.render("monitor", {
    user: req.userInfos,
    guild,
    selectedGuildId: guildId,
    guilds: req.userInfos.displayedGuilds || [],
    monitors,
    channels,
    status: req.query.status,
    message: req.query.message,
    currentURL: `${req.client.config.DASHBOARD.baseURL}/${req.originalUrl}`,
  });
});

router.post("/add", CheckAuth, async (req, res) => {
  const { guild_id, channel_id, name, host, type, check, port, interval, notify } = req.body;
  const service = req.client.monitorService;
  const allowedGuildIds = (req.userInfos.displayedGuilds || []).map((g) => g.id);

  if (!allowedGuildIds.includes(guild_id)) {
    return res.redirect("/dashboard/monitor?status=danger&message=No+permission+for+this+guild");
  }

  if (!service) {
    return res.redirect("/dashboard/monitor?status=danger&message=Monitor+service+not+initialized");
  }

  try {
    await service.createMonitor({
      guildId: guild_id,
      channelId: channel_id,
      name,
      host,
      type,
      check: check || (type === "minecraft" ? "tcp" : "icmp"),
      port: port ? Number(port) : null,
      interval: interval ? Number(interval) : 60,
      notify: notify === "on",
    });

    return res.redirect(
      `/dashboard/monitor?guildId=${guild_id}&status=success&message=Monitor+wurde+erstellt`
    );
  } catch (err) {
    return res.redirect(
      `/dashboard/monitor?guildId=${guild_id}&status=danger&message=${encodeURIComponent(err.message)}`
    );
  }
});

router.post("/remove", CheckAuth, async (req, res) => {
  const { guild_id, monitor_id } = req.body;
  const service = req.client.monitorService;
  const allowedGuildIds = (req.userInfos.displayedGuilds || []).map((g) => g.id);

  if (!allowedGuildIds.includes(guild_id)) {
    return res.redirect("/dashboard/monitor?status=danger&message=No+permission+for+this+guild");
  }

  if (!service) {
    return res.redirect("/dashboard/monitor?status=danger&message=Monitor+service+not+initialized");
  }

  await service.removeMonitor(monitor_id);
  return res.redirect(`/dashboard/monitor?guildId=${guild_id}&status=success&message=Monitor+entfernt`);
});

router.get("/data", CheckAuth, async (req, res) => {
  const guildId = req.query.guildId;
  const allowedGuildIds = (req.userInfos.displayedGuilds || []).map((g) => g.id);
  if (!guildId || !allowedGuildIds.includes(guildId) || !req.client.monitorService) return res.json([]);
  return res.json(req.client.monitorService.getMonitors(guildId));
});

module.exports = router;
