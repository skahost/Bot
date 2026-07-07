import type {
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  SlashCommandBuilder,
} from "discord.js";

export type SlashCommandData =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder;

export interface Command {
  data: SlashCommandData;
  /**
   * Whether only admins (configured OWNER_IDS or a Discord member with the
   * Administrator permission in the guild) may run this command. Enforced
   * centrally in the interaction handler. Commands with `adminOnly: false`
   * (currently only `/help` and `/manage`) are usable by every user.
   */
  adminOnly: boolean;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  /** Optional handler for options with `.setAutocomplete(true)`. Gated by the same adminOnly check as execute. */
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

export interface ButtonHandler {
  /** Prefix of the customId this handler responds to, e.g. "manage:". */
  prefix: string;
  execute: (interaction: ButtonInteraction) => Promise<void>;
}
