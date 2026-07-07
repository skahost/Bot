/**
 * Custom Discord emoji used throughout the bot's embeds and messages.
 * These reference emoji uploaded to a Discord server the bot is a member
 * of (Discord allows any bot to render emoji from a server it can see).
 */
export const EMOJIS = {
  // ── Custom server emoji (do not modify IDs) ──────────────────────────────
  online:     "<a:online:1523387954305826956>",
  reload:     "<:reload:1523389077108555787>",
  crateRare:  "<:crate_rare:1523389095261503549>",
  cross:      "<:cross:1523389118598615201>",
  check:      "<:check:1523389147618873524>",
  back:       "<:Back:1523389179902431255>",
  next:       "<:Next:1523389283874902146>",
  light:      "<a:light:1523390136384229577>",
  bluewings:  "<a:bluewings:1523390194802364478>",
  troll:      "<a:troll:1523390240029675580>",

  // ── Core resource & status emoji (updated to be more expressive) ─────────
  ram:     "🧠",   // memory = brain
  cpu:     "⚡",   // fast processing
  disk:    "💿",   // disk / storage
  uptime:  "⏰",   // clock for time-on
  panel:   "🖥️",  // monitor for panel
  power:   "🔋",   // battery for power state
  start:   "🚀",   // rocket = launch / start
  stop:    "🛑",   // stop sign
  restart: "🔄",   // circular arrows
  kill:    "💀",   // skull for force kill
  stats:   "📈",   // chart going up
  admin:   "👑",   // crown for admin
  user:    "🙋",   // person raising hand
  lock:    "🔐",   // lock with key
  mail:    "📨",   // incoming envelope
  key:     "🗝️",  // classic key
  bypass:  "🔓",   // unlocked padlock

  // ── Additional emoji ─────────────────────────────────────────────────────
  fire:         "🔥",   // hot / active
  warning:      "⚠️",  // caution
  success:      "✅",   // confirmed OK
  notification: "🔔",   // bell / DM alert
  tools:        "🛠️",  // wrench + hammer (reinstall)
  server:       "🖧",   // server rack
  network:      "📡",   // satellite / connection
  shield:       "🛡️",  // protection
  zap:          "⚡",   // instant / electric
  star:         "⭐",   // favourite / highlight
  party:        "🎉",   // celebration
  dm:           "💬",   // direct message
  diamond:      "💎",   // premium
  skull:        "☠️",  // danger / terminated
  rocket:       "🚀",   // launch alias
  globe:        "🌍",   // world / public
  hourglass:    "⌛",   // waiting
  refresh:      "♻️",  // recycle / refresh
  signal:       "📶",   // connectivity
  trophy:       "🏆",   // achievement
  bolt:         "🌩️",  // thunderbolt
  crown:        "👑",   // king / owner
  link:         "🔗",   // hyperlink
  report:       "📋",   // clipboard
  bin:          "🗑️",  // delete / trash
} as const;
