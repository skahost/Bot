import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type AutocompleteInteraction,
} from "discord.js";
import type { Command } from "../../types";
import { pterodactyl, PterodactylApiError } from "../../services/pterodactyl";
import { formatMiB } from "../../utils/format";
import { createLogger } from "../../utils/logger";
import { EMOJIS } from "../../config/emojis";
import { generateSecurePassword } from "../../utils/password";
import { isValidEmail, sanitizePanelUsername } from "../../utils/panel-account";
import { env } from "../../config/env";

const logger = createLogger("command:create-server");

const AUTOCOMPLETE_LIMIT = 25;

function matches(query: string, ...haystacks: string[]): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return haystacks.some((value) => value.toLowerCase().includes(needle));
}

async function autocompleteNode(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused();
  const nodes = await pterodactyl.listNodes();

  const choices = nodes
    .filter((node) => matches(focused, node.name, String(node.id)))
    .slice(0, AUTOCOMPLETE_LIMIT)
    .map((node) => ({
      name: `${node.name} (${node.fqdn})`.slice(0, 100),
      value: node.id,
    }));

  await interaction.respond(choices);
}

async function autocompleteEgg(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused();
  const eggs = await pterodactyl.listAllEggs();

  const choices = eggs
    .filter((egg) => matches(focused, egg.name))
    .slice(0, AUTOCOMPLETE_LIMIT)
    .map((egg) => ({
      name: egg.name.slice(0, 100),
      value: egg.id,
    }));

  await interaction.respond(choices);
}

async function autocompleteAllocation(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused();
  const nodeId = interaction.options.getInteger("node");

  if (!nodeId) {
    await interaction.respond([]);
    return;
  }

  try {
    const allocations = await pterodactyl.listAvailableAllocations(nodeId);

    const choices = allocations
      .filter((allocation) =>
        matches(focused, `${allocation.ip}:${allocation.port}`, allocation.notes ?? ""),
      )
      .slice(0, AUTOCOMPLETE_LIMIT)
      .map((allocation) => ({
        name: `${allocation.ip}:${allocation.port}${allocation.notes ? ` (${allocation.notes})` : ""}`.slice(
          0,
          100,
        ),
        value: allocation.id,
      }));

    await interaction.respond(choices);
  } catch {
    await interaction.respond([]);
  }
}

/** Try to send a DM; returns true on success, false if DMs are blocked. */
async function tryDm(user: { send: (opts: object) => Promise<unknown> }, opts: object): Promise<boolean> {
  try {
    await user.send(opts);
    return true;
  } catch {
    return false;
  }
}

export const createServerCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("create-server")
    .setDescription("[Owner] Create a new server on the panel")
    .addStringOption((option) =>
      option.setName("name").setDescription("Server name").setRequired(true),
    )
    .addUserOption((option) =>
      option
        .setName("username")
        .setDescription("Discord user this server is for (@mention or pick from list)")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("email")
        .setDescription("Their email (used for their panel account/login)")
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("node")
        .setDescription("Node to deploy the server on")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("egg")
        .setDescription("Egg to install")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("allocation")
        .setDescription("Allocation (IP:port) on the selected node")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addIntegerOption((option) =>
      option.setName("memory").setDescription("Memory limit in MB").setRequired(true),
    )
    .addIntegerOption((option) =>
      option.setName("disk").setDescription("Disk limit in MB").setRequired(true),
    )
    .addIntegerOption((option) =>
      option.setName("cpu").setDescription("CPU limit percentage (100 = 1 core)").setRequired(true),
    )
    .addStringOption((option) =>
      option.setName("docker-image").setDescription("Docker image (defaults to the egg's default image)").setRequired(false),
    )
    .addStringOption((option) =>
      option.setName("startup").setDescription("Startup command override (defaults to the egg's default startup)").setRequired(false),
    ),
  adminOnly: true,
  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);

    switch (focusedOption.name) {
      case "node":
        await autocompleteNode(interaction);
        return;
      case "egg":
        await autocompleteEgg(interaction);
        return;
      case "allocation":
        await autocompleteAllocation(interaction);
        return;
      default:
        await interaction.respond([]);
    }
  },
  async execute(interaction) {
    // Ephemeral so the panel stays clean — full details go to DM
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const name = interaction.options.getString("name", true);
    const targetUser = interaction.options.getUser("username", true);
    const discordUsername = targetUser.username;
    const email = interaction.options.getString("email", true).trim();
    const nodeId = interaction.options.getInteger("node", true);
    const eggId = interaction.options.getInteger("egg", true);
    const allocationId = interaction.options.getInteger("allocation", true);
    const memory = interaction.options.getInteger("memory", true);
    const disk = interaction.options.getInteger("disk", true);
    const cpu = interaction.options.getInteger("cpu", true);
    const dockerImageOverride = interaction.options.getString("docker-image");
    const startupOverride = interaction.options.getString("startup");

    if (memory <= 0 || disk <= 0 || cpu <= 0) {
      await interaction.editReply({
        content: `${EMOJIS.cross} Memory, disk, and CPU limits must all be positive numbers.`,
      });
      return;
    }

    if (!isValidEmail(email)) {
      await interaction.editReply({
        content: `${EMOJIS.cross} \`${email}\` is not a valid email address.`,
      });
      return;
    }

    try {
      // --- Resolve egg (across all nests) ---
      const eggs = await pterodactyl.listAllEggs();
      const egg = eggs.find((candidate) => candidate.id === eggId);

      if (!egg) {
        await interaction.editReply({
          content: `${EMOJIS.cross} No egg with ID \`${eggId}\` was found on this panel. Please re-select an egg from the autocomplete list.`,
        });
        return;
      }

      // --- Validate the allocation actually belongs to the chosen node and is free ---
      const availableAllocations = await pterodactyl.listAvailableAllocations(nodeId);
      const allocation = availableAllocations.find((candidate) => candidate.id === allocationId);

      if (!allocation) {
        await interaction.editReply({
          content: `${EMOJIS.cross} That allocation is no longer available on the selected node (it may have just been claimed by another server). Please re-select an allocation from the autocomplete list.`,
        });
        return;
      }

      // --- Find or create the panel user by email ---
      let panelUser = await pterodactyl.getUserByEmail(email);
      let generatedPassword: string | undefined;
      let userWasCreated = false;

      if (!panelUser) {
        generatedPassword = generateSecurePassword();
        const username = sanitizePanelUsername(discordUsername);

        try {
          panelUser = await pterodactyl.createUser({
            email,
            username,
            first_name: discordUsername.slice(0, 191) || username,
            last_name: "Server Owner",
            password: generatedPassword,
          });
          userWasCreated = true;
        } catch (creationError) {
          const message =
            creationError instanceof PterodactylApiError
              ? creationError.message
              : "Unexpected error creating the panel user.";
          logger.error("Failed to auto-create panel user", creationError);
          await interaction.editReply({
            content: `${EMOJIS.cross} Failed to create a panel account for \`${email}\`: ${message}`,
          });
          return;
        }
      }

      // --- Build the environment map from the egg's declared variables ---
      const eggVariables = await pterodactyl.getEggWithVariables(egg.nestId, eggId);
      const environment: Record<string, string> = {};
      for (const variable of eggVariables) {
        environment[variable.env_variable] = variable.default_value ?? "";
      }

      // --- Create the server ---
      const server = await pterodactyl.createServer({
        name,
        user: panelUser.id,
        egg: eggId,
        docker_image: dockerImageOverride || egg.docker_image,
        startup: startupOverride || egg.startup,
        environment,
        limits: { memory, swap: 0, disk, io: 500, cpu },
        feature_limits: { databases: 0, allocations: 1, backups: 0 },
        allocation: { default: allocationId },
      });

      logger.info("Server created", {
        executedBy: interaction.user.id,
        serverId: server.id,
        serverIdentifier: server.identifier,
        serverName: server.name,
        panelUserId: panelUser.id,
        panelUserEmail: panelUser.email,
        panelUserCreated: userWasCreated,
        discordUsername,
        nodeId,
        eggId,
        allocationId,
      });

      // --- DM the target user their credentials ---
      const credEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`${EMOJIS.crateRare} A server has been created for you`)
        .addFields(
          { name: `${EMOJIS.mail} Login Email`, value: panelUser.email, inline: true },
          { name: `${EMOJIS.user} Username`, value: panelUser.username, inline: true },
          ...(userWasCreated && generatedPassword
            ? [{ name: `${EMOJIS.key} Password`, value: `\`${generatedPassword}\``, inline: true }]
            : []),
          { name: "Server Name", value: server.name, inline: false },
          {
            name: `${EMOJIS.panel} Panel Link`,
            value: `[Open Panel](${env.pterodactylPanelUrl})`,
            inline: false,
          },
        )
        .setFooter({
          text: userWasCreated
            ? "This is your account password — please change it after logging in. Do not share it."
            : "This server was added to your existing panel account.",
        })
        .setTimestamp();

      const targetDmDelivered = await tryDm(targetUser, { embeds: [credEmbed] });

      // --- DM the admin who ran the command the full server summary ---
      const confirmEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`${EMOJIS.crateRare} Server Created`)
        .addFields(
          { name: "Name", value: server.name, inline: true },
          { name: "Identifier", value: server.identifier, inline: true },
          { name: "Egg", value: egg.name, inline: true },
          { name: "Memory", value: formatMiB(server.limits.memory), inline: true },
          { name: "Disk", value: formatMiB(server.limits.disk), inline: true },
          { name: "CPU", value: `${server.limits.cpu}%`, inline: true },
          { name: "Owner Email", value: panelUser.email, inline: true },
          {
            name: "Panel Account",
            value: userWasCreated ? "Newly created" : "Existing account",
            inline: true,
          },
        )
        .setFooter({ text: "The server is now installing — use /server-info to check progress" })
        .setTimestamp();

      const adminDmDelivered = await tryDm(await interaction.user.createDM(), { embeds: [confirmEmbed] });

      // --- Ephemeral reply in channel (no embed visible to others) ---
      const lines: string[] = [];
      if (adminDmDelivered) {
        lines.push(`${EMOJIS.success} Server created! ${EMOJIS.notification} Check your DMs for the full summary.`);
      } else {
        lines.push(`${EMOJIS.warning} Server created, but your DMs are closed — here's the summary:`);
      }

      if (!targetDmDelivered) {
        lines.push(
          `${EMOJIS.cross} Could not DM ${targetUser} (their DMs may be closed). ${
            userWasCreated
              ? "Please share their login credentials with them manually and ask them to change the password."
              : "Please let them know the new server was created."
          }`,
        );
      } else {
        lines.push(`${EMOJIS.notification} Credentials sent to ${targetUser} via DM.`);
      }

      if (adminDmDelivered) {
        await interaction.editReply({ content: lines.join("\n") });
      } else {
        await interaction.editReply({ content: lines.join("\n"), embeds: [confirmEmbed] });
      }
    } catch (error) {
      logger.error("Failed to create server", error);
      const message =
        error instanceof PterodactylApiError
          ? error.message
          : "Unexpected error contacting the panel.";
      await interaction.editReply({ content: `${EMOJIS.cross} Failed to create server: ${message}` });
    }
  },
};
