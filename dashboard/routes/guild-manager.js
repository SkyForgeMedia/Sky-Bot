const { getSettings } = require("@schemas/Guild");

const express = require("express"),
  utils = require("../utils"),
  CheckAuth = require("../auth/CheckAuth"),
  router = express.Router();


function ensureManageAccess(req, res) {
  const guild = req.client.guilds.cache.get(req.params.serverID);
  if (!guild || !req.userInfos.displayedGuilds || !req.userInfos.displayedGuilds.find((g) => g.id === req.params.serverID)) {
    res.render("404", {
      user: req.userInfos,
      currentURL: `${req.client.config.DASHBOARD.baseURL}/${req.originalUrl}`,
    });
    return null;
  }
  return guild;
}

function redirectWithStatus(res, guildId, status, message) {
  const params = new URLSearchParams({ status, message });
  return res.redirect(303, `/manage/${guildId}/moderation?${params.toString()}`);
}

router.get("/:serverID", CheckAuth, async (req, res) => {
  res.redirect(`/manage/${req.params.serverID}/basic`);
});

router.get("/:serverID/basic", CheckAuth, async (req, res) => {
  // Check if the user has the permissions to edit this guild
  const guild = ensureManageAccess(req, res);
  if (!guild) return;

  // Fetch guild informations
  const guildInfos = await utils.fetchGuild(guild.id, req.client, req.user.guilds);

  res.render("manager/basic", {
    guild: guildInfos,
    user: req.userInfos,
    bot: req.client,
    currentURL: `${req.client.config.DASHBOARD.baseURL}/${req.originalUrl}`,
  });
});

router.get("/:serverID/greeting", CheckAuth, async (req, res) => {
  // Check if the user has the permissions to edit this guild
  const guild = ensureManageAccess(req, res);
  if (!guild) return;

  // Fetch guild informations
  const guildInfos = await utils.fetchGuild(guild.id, req.client, req.user.guilds);

  res.render("manager/greeting", {
    guild: guildInfos,
    user: req.userInfos,
    bot: req.client,
    currentURL: `${req.client.config.DASHBOARD.baseURL}/${req.originalUrl}`,
  });
});

router.post("/:serverID/basic", CheckAuth, async (req, res) => {
  // Check if the user has the permissions to edit this guild
  const guild = ensureManageAccess(req, res);
  if (!guild) return;

  const settings = await getSettings(guild);
  const data = req.body;

  // BASIC CONFIGURATION
  if (Object.prototype.hasOwnProperty.call(data, "basicUpdate")) {
    if (data.prefix && data.prefix !== settings.prefix) {
      settings.prefix = data.prefix;
    }

    data.flag_translation = data.flag_translation === "on" ? true : false;
    if (data.flag_translation !== (settings.flag_translation.enabled || false)) {
      settings.flag_translation.enabled = data.flag_translation;
    }

    data.invite_tracking = data.invite_tracking === "on" ? true : false;
    if (data.invite_tracking !== (settings.invite.tracking || false)) {
      settings.invite.tracking = data.invite_tracking;
    }
  }

  // STATISTICS CONFIGURATION
  if (Object.prototype.hasOwnProperty.call(data, "statsUpdate")) {
    data.ranking = data.ranking === "on" ? true : false;
    if (data.ranking !== (settings.stats.enabled || false)) {
      settings.stats.enabled = data.ranking;
    }

    if (data.levelup_message && data.levelup_message !== settings.stats.xp.message) {
      settings.stats.xp.message = data.levelup_message;
    }

    data.levelup_channel = guild.channels.cache.find((ch) => "#" + ch.name === data.levelup_channel)?.id || null;
    if (data.levelup_channel !== settings.stats.xp.channel) {
      settings.stats.xp.channel = data.levelup_channel;
    }
  }

  // TICKET CONFIGURATION
  if (Object.prototype.hasOwnProperty.call(data, "ticketUpdate")) {
    if (data.limit && data.limit != settings.ticket.limit) {
      settings.ticket.limit = data.limit;
    }

    data.channel = guild.channels.cache.find((ch) => "#" + ch.name === data.channel)?.id;
    if (data.channel !== settings.ticket.log_channel) {
      settings.ticket.log_channel = data.channel;
    }
  }

  // MODERATION CONFIGURATION
  if (Object.prototype.hasOwnProperty.call(data, "modUpdate")) {
    if (data.max_warnings && data.max_warnings != settings.max_warn.limit) {
      settings.max_warn.limit = data.max_warnings;
    }

    if (data.max_warn_action !== settings.max_warn.action) {
      settings.max_warn.action = data.max_warn_action;
    }

    data.modlog_channel = guild.channels.cache.find((ch) => "#" + ch.name === data.modlog_channel)?.id || null;
    if (data.modlog_channel !== settings.modlog_channel) {
      settings.modlog_channel = data.modlog_channel;
    }
  }

  // AUTOMOD CONFIGURATION
  if (Object.prototype.hasOwnProperty.call(data, "automodUpdate")) {
    if (data.max_strikes && data.max_strikes !== settings.automod.strikes) {
      settings.automod.strikes = data.max_strikes;
    }

    if (data.automod_action && data.automod_action !== settings.automod.action) {
      settings.automod.action = data.automod_action;
    }

    if (data.max_lines && data.max_lines !== settings.automod.max_lines) {
      settings.automod.max_lines = data.max_lines;
    }

    data.anti_attachments = data.anti_attachments === "on" ? true : false;
    if (data.anti_attachments !== (settings.automod.anti_attachments || false)) {
      settings.automod.anti_attachments = data.anti_attachments;
    }

    data.anti_invites = data.anti_invites === "on" ? true : false;
    if (data.anti_invites !== (settings.automod.anti_invites || false)) {
      settings.automod.anti_invites = data.anti_invites;
    }

    data.anti_links = data.anti_links === "on" ? true : false;
    if (data.anti_links !== (settings.automod.anti_links || false)) {
      settings.automod.anti_links = data.anti_links;
    }

    data.anti_spam = data.anti_spam === "on" ? true : false;
    if (data.anti_spam !== (settings.automod.anti_spam || false)) {
      settings.automod.anti_spam = data.anti_spam;
    }

    data.anti_ghostping = data.anti_ghostping === "on" ? true : false;
    if (data.anti_ghostping !== (settings.automod.anti_ghostping || false)) {
      settings.automod.anti_ghostping = data.anti_ghostping;
    }

    data.anti_massmention = data.anti_massmention === "on" ? true : false;
    if (data.anti_massmention !== (settings.automod.anti_massmention || false)) {
      settings.automod.anti_massmention = data.anti_massmention;
    }

    if (data.channels?.length) {
      if (typeof data.channels === "string") data.channels = [data.channels];
      settings.automod.wh_channels = data.channels
        .map((ch) => guild.channels.cache.find((c) => "#" + c.name === ch)?.id)
        .filter((c) => c);
    }
  }

  await settings.save();
  res.redirect(303, `/manage/${guild.id}/basic`);
});

router.post("/:serverID/greeting", CheckAuth, async (req, res) => {
  // Check if the user has the permissions to edit this guild
  const guild = ensureManageAccess(req, res);
  if (!guild) return;

  const settings = await getSettings(guild);
  const data = req.body;

  if (Object.prototype.hasOwnProperty.call(data, "welcomeDisable")) {
    settings.welcome.enabled = false;
  }

  if (
    Object.prototype.hasOwnProperty.call(data, "welcomeEnable") ||
    Object.prototype.hasOwnProperty.call(data, "welcomeUpdate")
  ) {
    if (data.content !== settings.welcome.content) {
      settings.welcome.content = data.content;
    }

    data.content = data.content.replace(/\r?\n/g, "\\n");
    if (data.content && data.content !== settings.welcome.content) {
      settings.welcome.content = data.content;
    }

    if (data.description !== settings.welcome.embed.description) {
      settings.welcome.embed.description = data.description;
    }

    data.description = data.description?.replaceAll(/\r\n/g, "\\n");
    if (data.description && data.description !== settings.welcome.embed?.description) {
      settings.welcome.embed.description = data.description;
    }

    if (data.footer !== settings.welcome.embed.footer) {
      settings.welcome.embed.footer = data.footer;
    }

    if (data.footer && data.footer !== settings.welcome.embed?.footer) {
      settings.welcome.embed.footer = data.footer;
    }

    if (data.hexcolor !== settings.welcome.embed.hexcolor) {
      settings.welcome.embed.hexcolor = data.hexcolor;
    }

    if (data.hexcolor && data.hexcolor !== settings.welcome.embed?.color) {
      settings.welcome.embed.color = data.hexcolor;
    }

    if (data.image !== settings.welcome.embed.image) {
      settings.welcome.embed.image = data.image;
    }

    if (data.image && data.image !== settings.welcome.embed?.image) {
      settings.welcome.embed.image = data.image;
    }

    data.thumbnail = data.thumbnail === "on" ? true : false;
    if (data.thumbnail !== (settings.welcome.embed?.thumbnail || false)) {
      settings.welcome.embed.thumbnail = data.thumbnail;
    }

    data.channel = guild.channels.cache.find((ch) => "#" + ch.name === data.channel)?.id;
    if (data.channel !== settings.welcome.channel) {
      settings.welcome.channel = data.channel;
    }

    if (!settings.welcome.enabled) settings.welcome.enabled = true;
  }

  if (Object.prototype.hasOwnProperty.call(data, "farewellDisable")) {
    settings.farewell.enabled = false;
  }

  if (
    Object.prototype.hasOwnProperty.call(data, "farewellEnable") ||
    Object.prototype.hasOwnProperty.call(data, "farewellUpdate")
  ) {
    if (data.content !== settings.farewell.content) {
      settings.farewell.content = data.content;
    }

    data.content = data.content.replace(/\r?\n/g, "\\n");
    if (data.content && data.content !== settings.farewell.content) {
      settings.farewell.content = data.content;
    }

    if (data.description !== settings.farewell.description) {
      settings.farewell.description = data.description;
    }

    data.description = data.description?.replaceAll(/\r\n/g, "\\n");
    if (data.description && data.description !== settings.farewell.embed?.description) {
      settings.farewell.embed.description = data.description;
    }

    if (data.footer !== settings.farewell.footer) {
      settings.farewell.footer = data.footer;
    }

    if (data.footer && data.footer !== settings.farewell.embed?.footer) {
      settings.farewell.embed.footer = data.footer;
    }

    if (data.hexcolor !== settings.farewell.hexcolor) {
      settings.farewell.hexcolor = data.hexcolor;
    }

    if (data.hexcolor && data.hexcolor !== settings.farewell.embed?.color) {
      settings.farewell.embed.color = data.hexcolor;
    }

    if (data.image !== settings.farewell.image) {
      settings.farewell.image = data.image;
    }

    if (data.image && data.image !== settings.farewell.embed?.image) {
      settings.farewell.embed.image = data.image;
    }

    data.thumbnail = data.thumbnail === "on" ? true : false;
    if (data.thumbnail !== (settings.farewell.embed?.thumbnail || false)) {
      settings.farewell.embed.thumbnail = data.thumbnail;
    }

    data.channel = guild.channels.cache.find((ch) => "#" + ch.name === data.channel)?.id;
    if (data.channel !== settings.farewell.channel) {
      settings.farewell.channel = data.channel;
    }

    if (!settings.farewell.enabled) settings.farewell.enabled = true;
  }

  await settings.save();
  res.redirect(303, `/manage/${guild.id}/greeting`);
});

router.get("/:serverID/features", CheckAuth, async (req, res) => {
  const guild = ensureManageAccess(req, res);
  if (!guild) return;

  const guildInfos = await utils.fetchGuild(guild.id, req.client, req.user.guilds);
  const textChannels = guild.channels.cache
    .filter((ch) => ch.type === 0)
    .sort((a, b) => a.position - b.position)
    .map((ch) => ch)
    .slice(0, 150);
  const roles = guild.roles.cache
    .filter((role) => role.name !== "@everyone")
    .sort((a, b) => b.position - a.position)
    .map((role) => role)
    .slice(0, 150);

  res.render("manager/features", {
    guild: guildInfos,
    user: req.userInfos,
    bot: req.client,
    textChannels,
    roles,
    status: req.query.status,
    message: req.query.message,
    currentURL: `${req.client.config.DASHBOARD.baseURL}/${req.originalUrl}`,
  });
});

router.post("/:serverID/features", CheckAuth, async (req, res) => {
  const guild = ensureManageAccess(req, res);
  if (!guild) return;

  const settings = await getSettings(guild);
  const data = req.body;

  try {
    if (Object.prototype.hasOwnProperty.call(data, "autoroleSave")) {
      if (!data.autorole_id || data.autorole_id === "none") {
        settings.autorole = null;
      } else {
        settings.autorole = data.autorole_id;
      }
      await settings.save();
      const msg = settings.autorole ? "Autorole wurde gespeichert." : "Autorole wurde deaktiviert.";
      return res.redirect(303, `/manage/${guild.id}/features?status=success&message=${encodeURIComponent(msg)}`);
    }

    if (Object.prototype.hasOwnProperty.call(data, "suggestionSave")) {
      settings.suggestions.enabled = data.suggestion_enabled === "on";
      settings.suggestions.channel_id = data.suggestion_channel_id || null;
      settings.suggestions.approved_channel = data.suggestion_approved_channel || null;
      settings.suggestions.rejected_channel = data.suggestion_rejected_channel || null;

      if (data.suggestion_staff_roles?.length) {
        const selectedRoles = Array.isArray(data.suggestion_staff_roles)
          ? data.suggestion_staff_roles
          : [data.suggestion_staff_roles];
        settings.suggestions.staff_roles = selectedRoles.filter((id) => guild.roles.cache.has(id));
      } else {
        settings.suggestions.staff_roles = [];
      }

      await settings.save();
      return res.redirect(
        303,
        `/manage/${guild.id}/features?status=success&message=${encodeURIComponent("Suggestion Einstellungen gespeichert.")}`
      );
    }

    if (Object.prototype.hasOwnProperty.call(data, "ticketCategoryAdd")) {
      const categoryName = data.ticket_category_name?.trim();
      if (!categoryName) {
        return res.redirect(
          303,
          `/manage/${guild.id}/features?status=danger&message=${encodeURIComponent("Kategorie-Name fehlt.")}`
        );
      }

      if (settings.ticket.categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase())) {
        return res.redirect(
          303,
          `/manage/${guild.id}/features?status=warning&message=${encodeURIComponent("Kategorie existiert bereits.")}`
        );
      }

      const selectedRoles = data.ticket_staff_roles
        ? Array.isArray(data.ticket_staff_roles)
          ? data.ticket_staff_roles
          : [data.ticket_staff_roles]
        : [];

      settings.ticket.categories.push({
        name: categoryName,
        staff_roles: selectedRoles.filter((id) => guild.roles.cache.has(id)),
      });
      await settings.save();
      return res.redirect(
        303,
        `/manage/${guild.id}/features?status=success&message=${encodeURIComponent("Ticket Kategorie hinzugefügt.")}`
      );
    }

    if (Object.prototype.hasOwnProperty.call(data, "ticketCategoryRemove")) {
      const categoryName = data.ticket_category_remove;
      if (!categoryName) {
        return res.redirect(
          303,
          `/manage/${guild.id}/features?status=danger&message=${encodeURIComponent(
            "Bitte Kategorie zum Entfernen wählen."
          )}`
        );
      }

      settings.ticket.categories = settings.ticket.categories.filter((c) => c.name !== categoryName);
      await settings.save();
      return res.redirect(
        303,
        `/manage/${guild.id}/features?status=success&message=${encodeURIComponent("Ticket Kategorie entfernt.")}`
      );
    }

    return res.redirect(
      303,
      `/manage/${guild.id}/features?status=warning&message=${encodeURIComponent("Keine gültige Aktion erkannt.")}`
    );
  } catch (err) {
    return res.redirect(
      303,
      `/manage/${guild.id}/features?status=danger&message=${encodeURIComponent(err.message || "Änderung fehlgeschlagen")}`
    );
  }
});


router.get("/:serverID/moderation", CheckAuth, async (req, res) => {
  const guild = ensureManageAccess(req, res);
  if (!guild) return;

  const guildInfos = await utils.fetchGuild(guild.id, req.client, req.user.guilds);
  const members = await guild.members.fetch();
  const displayedMembers = members
    .filter((member) => !member.user.bot)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .first(100);

  const roles = guild.roles.cache
    .filter((role) => role.name !== "@everyone" && role.editable)
    .sort((a, b) => b.position - a.position)
    .map((role) => role)
    .slice(0, 100);

  res.render("manager/moderation", {
    guild: guildInfos,
    user: req.userInfos,
    bot: req.client,
    members: displayedMembers,
    roles,
    status: req.query.status,
    message: req.query.message,
    currentURL: `${req.client.config.DASHBOARD.baseURL}/${req.originalUrl}`,
  });
});

router.post("/:serverID/moderation", CheckAuth, async (req, res) => {
  const guild = ensureManageAccess(req, res);
  if (!guild) return;

  const data = req.body;

  try {
    if (data.memberRoleAdd || data.memberRoleRemove || data.memberTimeout || data.memberUntimeout || data.memberKick || data.memberBan || data.memberNick) {
      if (!data.member_id) {
        return redirectWithStatus(res, guild.id, "danger", "Bitte ein Mitglied auswählen.");
      }
    }

    if (data.memberRoleAdd || data.memberRoleRemove) {
      const member = await guild.members.fetch(data.member_id);
      if (!data.role_id) {
        return redirectWithStatus(res, guild.id, "danger", "Bitte eine Rolle auswählen.");
      }

      if (data.memberRoleAdd) {
        await member.roles.add(data.role_id, `Dashboard action by ${req.userInfos.tag}`);
        return redirectWithStatus(res, guild.id, "success", `Rolle wurde ${member.user.tag} hinzugefügt.`);
      }

      await member.roles.remove(data.role_id, `Dashboard action by ${req.userInfos.tag}`);
      return redirectWithStatus(res, guild.id, "success", `Rolle wurde bei ${member.user.tag} entfernt.`);
    }

    if (data.memberTimeout) {
      const member = await guild.members.fetch(data.member_id);
      const durationMinutes = Number(data.timeout_minutes || 10);
      await member.timeout(durationMinutes * 60 * 1000, `Dashboard timeout by ${req.userInfos.tag}`);
      return redirectWithStatus(res, guild.id, "success", `${member.user.tag} wurde für ${durationMinutes} Minuten getimeoutet.`);
    }

    if (data.memberUntimeout) {
      const member = await guild.members.fetch(data.member_id);
      await member.timeout(null, `Dashboard untimeout by ${req.userInfos.tag}`);
      return redirectWithStatus(res, guild.id, "success", `Timeout für ${member.user.tag} wurde entfernt.`);
    }

    if (data.memberKick) {
      const member = await guild.members.fetch(data.member_id);
      await member.kick(`Dashboard kick by ${req.userInfos.tag}`);
      return redirectWithStatus(res, guild.id, "success", `${member.user.tag} wurde gekickt.`);
    }

    if (data.memberBan) {
      const member = await guild.members.fetch(data.member_id);
      const deleteMessageSeconds = Number(data.delete_message_seconds || 0);
      await member.ban({
        deleteMessageSeconds,
        reason: `Dashboard ban by ${req.userInfos.tag}`,
      });
      return redirectWithStatus(res, guild.id, "success", `${member.user.tag} wurde gebannt.`);
    }

    if (data.memberUnban) {
      if (!data.unban_user_id) {
        return redirectWithStatus(res, guild.id, "danger", "Bitte User-ID zum Entbannen angeben.");
      }
      await guild.members.unban(data.unban_user_id, `Dashboard unban by ${req.userInfos.tag}`);
      return redirectWithStatus(res, guild.id, "success", `User ${data.unban_user_id} wurde entbannt.`);
    }

    if (data.memberNick) {
      const member = await guild.members.fetch(data.member_id);
      await member.setNickname(data.nickname || null, `Dashboard nickname update by ${req.userInfos.tag}`);
      return redirectWithStatus(res, guild.id, "success", `Nickname für ${member.user.tag} wurde aktualisiert.`);
    }

    return redirectWithStatus(res, guild.id, "warning", "Keine gültige Aktion erkannt.");
  } catch (err) {
    return redirectWithStatus(res, guild.id, "danger", err.message || "Aktion konnte nicht ausgeführt werden.");
  }
});

module.exports = router;
