import { Database } from "bun:sqlite";
const db = new Database("prisma/dev.db");
const v = db.query("SELECT name FROM sqlite_master WHERE type='view'").all() as any[];
console.log("views:", v.length, v.map(r => r.name).join(",") || "(none)");
const triggers = db.query("SELECT name FROM sqlite_master WHERE type='trigger'").all() as any[];
console.log("triggers:", triggers.length, triggers.map(r => r.name).join(",") || "(none)");
const idx = db.query("SELECT COUNT(*) c FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").get() as any;
console.log("indexes (non-sqlite):", idx.c);
db.close();
