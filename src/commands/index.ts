import type { Command } from "../types";
import { helpCommand } from "./general/help";
import { pingCommand } from "./general/ping";
import { statusCommand } from "./general/status";
import { nodeCommand } from "./general/node";
import { nodesCommand } from "./general/nodes";
import { serversCommand } from "./general/servers";
import { serverInfoCommand } from "./general/server-info";
import { listServersCommand } from "./general/list-servers";
import { createServerCommand } from "./owner/create-server";
import { deleteServerCommand } from "./owner/delete-server";
import { suspendServerCommand } from "./owner/suspend-server";
import { unsuspendServerCommand } from "./owner/unsuspend-server";
import { reinstallServerCommand } from "./owner/reinstall-server";
import { bypassCommand } from "./owner/bypass";
import { adminCommand } from "./owner/admin";
import { manageCommand } from "./shared/manage";

/**
 * `/help` and `/manage` are usable by everyone; every other command is
 * admin-only (enforced centrally in the interaction handler using each
 * command's own `adminOnly` flag).
 */
export const commands: Command[] = [
  helpCommand,
  manageCommand,
  pingCommand,
  statusCommand,
  nodeCommand,
  nodesCommand,
  serversCommand,
  serverInfoCommand,
  listServersCommand,
  createServerCommand,
  deleteServerCommand,
  suspendServerCommand,
  unsuspendServerCommand,
  reinstallServerCommand,
  bypassCommand,
  adminCommand,
];
