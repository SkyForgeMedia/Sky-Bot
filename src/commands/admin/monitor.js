const { ApplicationCommandOptionType, ChannelType } = require("discord.js");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "monitor",
  description: "Server monitoring (Linux/Minecraft) with auto-updating embeds",
  category: "ADMIN",
  userPermissions: ["ManageGuild"],
  botPermissions: ["SendMessages", "EmbedLinks", "ReadMessageHistory"],
  command: {
    enabled: false,
  },
  slashCommand: {
    enabled: true,
    ephemeral: true,
    options: [
      {
        name: "add",
        description: "Add a server monitor",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          { name: "name", description: "Display name", type: ApplicationCommandOptionType.String, required: true },
          { name: "host", description: "Domain or IP", type: ApplicationCommandOptionType.String, required: true },
          {
            name: "type",
            description: "Server type",
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
              { name: "Linux", value: "linux" },
              { name: "Minecraft", value: "minecraft" },
            ],
          },
          {
            name: "check",
            description: "Check type",
            type: ApplicationCommandOptionType.String,
            required: false,
            choices: [
              { name: "ICMP Ping", value: "icmp" },
              { name: "TCP Port", value: "tcp" },
            ],
          },
          { name: "port", description: "TCP port (optional)", type: ApplicationCommandOptionType.Integer, required: false },
          {
            name: "interval",
            description: "Check interval in seconds (min 15)",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "channel",
            description: "Channel for live embed",
            type: ApplicationCommandOptionType.Channel,
            channelTypes: [ChannelType.GuildText],
            required: false,
          },
          {
            name: "notify",
            description: "Notify on status changes",
            type: ApplicationCommandOptionType.Boolean,
            required: false,
          },
        ],
      },
      {
        name: "remove",
        description: "Remove a monitor by ID",
        type: ApplicationCommandOptionType.Subcommand,
        options: [{ name: "id", description: "Monitor ID", type: ApplicationCommandOptionType.String, required: true }],
      },
      {
        name: "list",
        description: "List monitors in this guild",
        type: ApplicationCommandOptionType.Subcommand,
      },
    ],
  },

  async interactionRun(interaction) {
    const sub = interaction.options.getSubcommand();
    const monitorService = interaction.client.monitorService;

    if (!monitorService) {
      return interaction.followUp("Monitor service is not initialized.");
    }

    if (sub === "add") {
      const type = interaction.options.getString("type", true);
      const check = interaction.options.getString("check") || (type === "minecraft" ? "tcp" : "icmp");
      const channel = interaction.options.getChannel("channel") || interaction.channel;

      const monitor = await monitorService.createMonitor({
        guildId: interaction.guildId,
        channelId: channel.id,
        name: interaction.options.getString("name", true),
        host: interaction.options.getString("host", true),
        type,
        check,
        port: interaction.options.getInteger("port"),
        interval: interaction.options.getInteger("interval") || 60,
        notify: interaction.options.getBoolean("notify") || false,
      });

      return interaction.followUp(
        `✅ Monitor erstellt: **${monitor.name}** (ID: \`${monitor.id}\`) in <#${monitor.channelId}>`
      );
    }

    if (sub === "remove") {
      const id = interaction.options.getString("id", true);
      const monitor = monitorService.getMonitors(interaction.guildId).find((m) => m.id === id);
      if (!monitor) return interaction.followUp("Monitor nicht gefunden.");

      await monitorService.removeMonitor(id);
      return interaction.followUp(`🗑️ Monitor \`${id}\` entfernt.`);
    }

    if (sub === "list") {
      const monitors = monitorService.getMonitors(interaction.guildId);
      if (monitors.length === 0) return interaction.followUp("Keine Monitore eingerichtet.");

      const lines = monitors
        .map(
          (m) =>
            `• \`${m.id}\` **${m.name}** — ${m.host}${m.port ? `:${m.port}` : ""} | ${m.type}/${m.check} | ${m.status}`
        )
        .join("\n");
      return interaction.followUp(`Aktive Monitore:\n${lines}`);
    }

    return interaction.followUp("Ungültiges Subcommand.");
  },
};
