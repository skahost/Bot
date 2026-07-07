/**
 * Pterodactyl Panel Application API client.
 *
 * IMPORTANT: This talks to the Application API (`/api/application/*`), which
 * requires an admin-issued Application API key. It is NOT the Client API
 * (`/api/client/*`) and the two are not interchangeable.
 *
 * Docs: https://dashflo.net/docs/api/pterodactyl/v1/
 */
import {
  API_MAX_RETRIES,
  API_RETRY_BASE_DELAY_MS,
  API_TIMEOUT_MS,
  env,
} from "../config/env";
import { createLogger } from "../utils/logger";

const logger = createLogger("pterodactyl-api");

export class PterodactylApiError extends Error {
  public readonly status: number | undefined;
  public readonly endpoint: string;

  constructor(message: string, endpoint: string, status?: number) {
    super(message);
    this.name = "PterodactylApiError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

export interface PterodactylAllocation {
  id: number;
  ip: string;
  port: number;
  notes: string | null;
  is_default: boolean;
  assigned: boolean;
}

export interface PterodactylUserAttributes {
  id: number;
  external_id: string | null;
  uuid: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  language: string;
  root_admin: boolean;
  "2fa": boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUserPayload {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  password: string;
}

export interface PterodactylNodeAttributes {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  location_id: number;
  fqdn: string;
  scheme: string;
  memory: number;
  memory_overallocate: number;
  disk: number;
  disk_overallocate: number;
  daemon_listen: number;
  maintenance_mode: boolean;
}

export interface PterodactylServerAttributes {
  id: number;
  uuid: string;
  identifier: string;
  name: string;
  description: string | null;
  suspended: boolean;
  limits: {
    memory: number;
    swap: number;
    disk: number;
    io: number;
    cpu: number;
  };
  feature_limits: {
    databases: number;
    allocations: number;
    backups: number;
  };
  user: number;
  node: number;
  allocation: number;
  nest: number;
  egg: number;
  container: {
    startup_command: string;
    image: string;
    installed: number;
  };
}

export interface PterodactylUtilization {
  object: string;
  attributes: {
    current_state: string;
    is_suspended: boolean;
    resources: {
      memory_bytes: number;
      cpu_absolute: number;
      disk_bytes: number;
      network_rx_bytes: number;
      network_tx_bytes: number;
      uptime: number;
    };
  };
}

export interface PterodactylEggVariable {
  name: string;
  description: string;
  env_variable: string;
  default_value: string;
  user_viewable: boolean;
  user_editable: boolean;
  rules: string;
}

export interface CreateServerPayload {
  name: string;
  user: number;
  egg: number;
  docker_image: string;
  startup: string;
  environment: Record<string, string | number>;
  limits: {
    memory: number;
    swap: number;
    disk: number;
    io: number;
    cpu: number;
  };
  feature_limits: {
    databases: number;
    allocations: number;
    backups: number;
  };
  allocation: {
    default: number;
  };
}

type PaginatedResponse<T> = {
  object: string;
  data: Array<{ object: string; attributes: T }>;
  meta: {
    pagination: {
      total: number;
      count: number;
      per_page: number;
      current_page: number;
      total_pages: number;
    };
  };
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Performs a request against the Pterodactyl Application API with:
 * - Bearer auth + required headers
 * - A hard timeout so a hung panel never hangs the bot
 * - Automatic retry with exponential backoff for transient failures
 *   (429 rate limits, 5xx panel errors, and network-level failures)
 */
async function request<T>(
  endpoint: string,
  options: { method?: string; body?: unknown } = {},
): Promise<{ data: T; responseTimeMs: number }> {
  const url = `${env.pterodactylPanelUrl}/api/application${endpoint}`;
  const method = options.method ?? "GET";

  let lastError: unknown;

  for (let attempt = 0; attempt <= API_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    const start = Date.now();

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${env.pterodactylApiKey}`,
          Accept: "Application/vnd.pterodactyl.v1+json",
          "Content-Type": "application/json",
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      const responseTimeMs = Date.now() - start;
      clearTimeout(timeoutHandle);

      if (response.status === 204) {
        return { data: undefined as T, responseTimeMs };
      }

      const text = await response.text();
      const json = text.length > 0 ? JSON.parse(text) : undefined;

      if (!response.ok) {
        const message =
          json?.errors?.[0]?.detail ??
          `Pterodactyl API returned HTTP ${response.status}`;

        if (isRetryableStatus(response.status) && attempt < API_MAX_RETRIES) {
          lastError = new PterodactylApiError(message, endpoint, response.status);
          logger.warn(
            `Retryable error on ${method} ${endpoint} (attempt ${attempt + 1}/${API_MAX_RETRIES + 1}): ${message}`,
          );
          await sleep(API_RETRY_BASE_DELAY_MS * 2 ** attempt);
          continue;
        }

        throw new PterodactylApiError(message, endpoint, response.status);
      }

      return { data: json as T, responseTimeMs };
    } catch (error) {
      clearTimeout(timeoutHandle);

      if (error instanceof PterodactylApiError) {
        throw error;
      }

      const isAbort = error instanceof Error && error.name === "AbortError";
      lastError = error;

      if (attempt < API_MAX_RETRIES) {
        logger.warn(
          `Network error on ${method} ${endpoint} (attempt ${attempt + 1}/${API_MAX_RETRIES + 1}): ${
            isAbort ? "timed out" : (error as Error).message
          }`,
        );
        await sleep(API_RETRY_BASE_DELAY_MS * 2 ** attempt);
        continue;
      }
    }
  }

  const finalMessage =
    lastError instanceof Error ? lastError.message : "Unknown error contacting Pterodactyl API";
  throw new PterodactylApiError(
    `Failed after ${API_MAX_RETRIES + 1} attempts: ${finalMessage}`,
    endpoint,
  );
}

/** Prevents duplicate in-flight requests to the same endpoint (e.g. rapid double-clicks / command spam). */
const inFlightRequests = new Map<string, Promise<unknown>>();

async function dedupedRequest<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const existing = inFlightRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fn().finally(() => {
    inFlightRequests.delete(key);
  });

  inFlightRequests.set(key, promise);
  return promise;
}

export const pterodactyl = {
  /** Checks whether the panel is reachable and the API key is valid. Used for status dashboards. */
  async ping(): Promise<{ online: boolean; responseTimeMs: number }> {
    try {
      const { responseTimeMs } = await request<PaginatedResponse<PterodactylNodeAttributes>>(
        "/nodes?per_page=1",
      );
      return { online: true, responseTimeMs };
    } catch {
      return { online: false, responseTimeMs: -1 };
    }
  },

  async listNodes(): Promise<PterodactylNodeAttributes[]> {
    const { data } = await dedupedRequest("list-nodes", () =>
      request<PaginatedResponse<PterodactylNodeAttributes>>("/nodes?per_page=100"),
    );
    return data.data.map((entry) => entry.attributes);
  },

  async getNode(nodeId: number): Promise<PterodactylNodeAttributes> {
    const { data } = await request<{ object: string; attributes: PterodactylNodeAttributes }>(
      `/nodes/${nodeId}`,
    );
    return data.attributes;
  },

  async listServersOnNode(nodeId: number): Promise<PterodactylServerAttributes[]> {
    const { data } = await request<PaginatedResponse<PterodactylServerAttributes>>(
      `/servers?filter[node]=${nodeId}&per_page=100`,
    );
    return data.data.map((entry) => entry.attributes);
  },

  async listServers(page = 1): Promise<{
    servers: PterodactylServerAttributes[];
    totalPages: number;
    total: number;
  }> {
    const { data } = await dedupedRequest(`list-servers-${page}`, () =>
      request<PaginatedResponse<PterodactylServerAttributes>>(
        `/servers?per_page=100&page=${page}`,
      ),
    );
    return {
      servers: data.data.map((entry) => entry.attributes),
      totalPages: data.meta.pagination.total_pages,
      total: data.meta.pagination.total,
    };
  },

  async listAllServers(): Promise<PterodactylServerAttributes[]> {
    const first = await this.listServers(1);
    let servers = first.servers;

    for (let page = 2; page <= first.totalPages; page++) {
      const next = await this.listServers(page);
      servers = servers.concat(next.servers);
    }

    return servers;
  },

  async getServer(serverId: number): Promise<PterodactylServerAttributes> {
    const { data } = await request<{ object: string; attributes: PterodactylServerAttributes }>(
      `/servers/${serverId}`,
    );
    return data.attributes;
  },

  async getServerByIdentifier(
    identifier: string,
  ): Promise<PterodactylServerAttributes | undefined> {
    const servers = await this.listAllServers();
    return servers.find(
      (server) =>
        server.identifier === identifier ||
        server.identifier.startsWith(identifier) ||
        server.uuid === identifier ||
        String(server.id) === identifier,
    );
  },

  async createServer(payload: CreateServerPayload): Promise<PterodactylServerAttributes> {
    const { data } = await request<{ object: string; attributes: PterodactylServerAttributes }>(
      "/servers",
      { method: "POST", body: payload },
    );
    return data.attributes;
  },

  async deleteServer(serverId: number, force = false): Promise<void> {
    await request<void>(`/servers/${serverId}${force ? "/force" : ""}`, {
      method: "DELETE",
    });
  },

  async suspendServer(serverId: number): Promise<void> {
    await request<void>(`/servers/${serverId}/suspend`, { method: "POST" });
  },

  async unsuspendServer(serverId: number): Promise<void> {
    await request<void>(`/servers/${serverId}/unsuspend`, { method: "POST" });
  },

  async reinstallServer(serverId: number): Promise<void> {
    await request<void>(`/servers/${serverId}/reinstall`, { method: "POST" });
  },

  async listLocations(): Promise<Array<{ id: number; short: string; long: string }>> {
    const { data } = await request<PaginatedResponse<{ id: number; short: string; long: string }>>(
      "/locations?per_page=100",
    );
    return data.data.map((entry) => entry.attributes);
  },

  async listNests(): Promise<Array<{ id: number; name: string }>> {
    const { data } = await request<PaginatedResponse<{ id: number; name: string }>>(
      "/nests?per_page=100",
    );
    return data.data.map((entry) => entry.attributes);
  },

  async listEggs(nestId: number): Promise<
    Array<{ id: number; name: string; docker_image: string; startup: string }>
  > {
    const { data } = await request<
      PaginatedResponse<{ id: number; name: string; docker_image: string; startup: string }>
    >(`/nests/${nestId}/eggs?per_page=100`);
    return data.data.map((entry) => entry.attributes);
  },

  /**
   * Fetches a single egg with its declared environment variables included.
   * Pterodactyl requires every variable the egg defines to be present in the
   * server creation payload's `environment` map (missing required variables,
   * e.g. `SERVER_JARFILE` on Minecraft eggs, cause a 422 "field is required"
   * error) — this is what lets /create-server fill them in with defaults.
   */
  async getEggWithVariables(
    nestId: number,
    eggId: number,
  ): Promise<PterodactylEggVariable[]> {
    const { data } = await request<{
      object: string;
      attributes: {
        id: number;
        relationships?: {
          variables?: {
            object: string;
            data: Array<{ object: string; attributes: PterodactylEggVariable }>;
          };
        };
      };
    }>(`/nests/${nestId}/eggs/${eggId}?include=variables`);

    return (data.attributes.relationships?.variables?.data ?? []).map(
      (entry) => entry.attributes,
    );
  },

  /** Every egg across every nest, tagged with its parent nest id. Used so /create-server can offer a single flat egg picker. */
  async listAllEggs(): Promise<
    Array<{ id: number; nestId: number; name: string; docker_image: string; startup: string }>
  > {
    const nests = await this.listNests();
    const results: Array<{
      id: number;
      nestId: number;
      name: string;
      docker_image: string;
      startup: string;
    }> = [];

    for (const nest of nests) {
      const eggs = await this.listEggs(nest.id);
      for (const egg of eggs) {
        results.push({ ...egg, nestId: nest.id });
      }
    }

    return results;
  },

  async listAllocations(nodeId: number): Promise<PterodactylAllocation[]> {
    const { data } = await request<PaginatedResponse<PterodactylAllocation>>(
      `/nodes/${nodeId}/allocations?per_page=100`,
    );
    return data.data.map((entry) => entry.attributes);
  },

  /** Only allocations not already bound to a server, i.e. usable for a new server. */
  async listAvailableAllocations(nodeId: number): Promise<PterodactylAllocation[]> {
    const allocations = await this.listAllocations(nodeId);
    return allocations.filter((allocation) => !allocation.assigned);
  },

  async listUsers(): Promise<PterodactylUserAttributes[]> {
    const { data } = await dedupedRequest("list-users", () =>
      request<PaginatedResponse<PterodactylUserAttributes>>("/users?per_page=100"),
    );
    return data.data.map((entry) => entry.attributes);
  },

  /**
   * Looks up a panel user by exact email (case-insensitive). Pterodactyl's
   * `filter[email]` query param can match loosely, so we re-verify the exact
   * match client-side to avoid false positives / duplicate-account bugs.
   */
  async getUserByEmail(email: string): Promise<PterodactylUserAttributes | undefined> {
    const normalized = email.trim().toLowerCase();
    const { data } = await request<PaginatedResponse<PterodactylUserAttributes>>(
      `/users?filter[email]=${encodeURIComponent(normalized)}&per_page=50`,
    );
    return data.data
      .map((entry) => entry.attributes)
      .find((user) => user.email.toLowerCase() === normalized);
  },

  async createUser(payload: CreateUserPayload): Promise<PterodactylUserAttributes> {
    const { data } = await request<{ object: string; attributes: PterodactylUserAttributes }>(
      "/users",
      { method: "POST", body: payload },
    );
    return data.attributes;
  },

  async getUser(userId: number): Promise<PterodactylUserAttributes | undefined> {
    try {
      const { data } = await request<{ object: string; attributes: PterodactylUserAttributes }>(
        `/users/${userId}`,
      );
      return data.attributes;
    } catch {
      return undefined;
    }
  },
};

export interface ServerUtilization {
  state: string;
  isSuspended: boolean;
  memoryBytes: number;
  cpuAbsolute: number;
  diskBytes: number;
  uptimeMs: number;
}

/**
 * Live resource usage for a single server, from the Client API's resources
 * endpoint (`/api/client/servers/{identifier}/resources`). The Application
 * API has no equivalent, so this — like power signals — requires
 * PTERODACTYL_CLIENT_API_KEY. Returns `undefined` (never throws) whenever
 * the client key is missing or the daemon/panel can't answer, so callers can
 * fall back to "Unknown" instead of failing the whole command.
 */
export async function getServerUtilization(
  serverIdentifier: string,
): Promise<ServerUtilization | undefined> {
  if (!env.pterodactylClientApiKey) {
    return undefined;
  }

  const url = `${env.pterodactylPanelUrl}/api/client/servers/${serverIdentifier}/resources`;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.pterodactylClientApiKey}`,
        Accept: "Application/vnd.pterodactyl.v1+json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return undefined;
    }

    const json = (await response.json()) as PterodactylUtilization;
    const resources = json.attributes.resources;

    return {
      state: json.attributes.current_state,
      isSuspended: json.attributes.is_suspended,
      memoryBytes: resources.memory_bytes,
      cpuAbsolute: resources.cpu_absolute,
      diskBytes: resources.disk_bytes,
      uptimeMs: resources.uptime,
    };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * Power actions (start/stop/restart/kill) are only exposed by Pterodactyl's
 * Client API (`/api/client/servers/{identifier}/power`) — the Application
 * API has no power-control endpoint. This helper calls the Client API using
 * a dedicated client key (`PTERODACTYL_CLIENT_API_KEY`) so every other
 * server-management action in this bot can stay on the Application API as
 * requested, while power control still works against a real panel.
 */
export async function sendPowerSignal(
  serverIdentifier: string,
  signal: "start" | "stop" | "restart" | "kill",
): Promise<void> {
  if (!env.pterodactylClientApiKey) {
    throw new PterodactylApiError(
      "Power actions require PTERODACTYL_CLIENT_API_KEY to be configured. The Application API does not support start/stop/restart/kill.",
      "/power",
    );
  }

  const url = `${env.pterodactylPanelUrl}/api/client/servers/${serverIdentifier}/power`;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.pterodactylClientApiKey}`,
        Accept: "Application/vnd.pterodactyl.v1+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ signal }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      let message = `Pterodactyl Client API returned HTTP ${response.status}`;
      try {
        const json = JSON.parse(text);
        message = json?.errors?.[0]?.detail ?? message;
      } catch {
        // response body wasn't JSON; keep default message
      }
      throw new PterodactylApiError(message, "/power", response.status);
    }
  } catch (error) {
    if (error instanceof PterodactylApiError) {
      throw error;
    }
    const isAbort = error instanceof Error && error.name === "AbortError";
    throw new PterodactylApiError(
      isAbort ? "Power signal request timed out" : (error as Error).message,
      "/power",
    );
  } finally {
    clearTimeout(timeoutHandle);
  }
}
