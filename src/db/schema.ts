import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 8 }).notNull().unique(),
    name: text("name").notNull(),
    status: text("status").notNull().default("waiting"),
    audioSource: text("audio_source").notNull().default("microphone"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("rooms_status_idx").on(table.status)],
);

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role").notNull(),
    volume: integer("volume").notNull().default(100),
    muted: boolean("muted").notNull().default(false),
    connected: boolean("connected").notNull().default(true),
    latencyMs: integer("latency_ms"),
    userAgent: text("user_agent"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("devices_room_idx").on(table.roomId),
    index("devices_room_role_idx").on(table.roomId, table.role),
  ],
);

export const signals = pgTable(
  "signals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    fromDeviceId: uuid("from_device_id").notNull(),
    toDeviceId: uuid("to_device_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("signals_to_device_idx").on(table.toDeviceId, table.createdAt),
    index("signals_room_idx").on(table.roomId),
  ],
);

export type Room = typeof rooms.$inferSelect;
export type Device = typeof devices.$inferSelect;
export type Signal = typeof signals.$inferSelect;
