import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { contentDocs } from "../../db/schema";

export function persistentContentStore(fallback: any) {
  const persistentCollections = new Set([
    "settings", "stories", "users", "local_credentials", "trader_accounts", "orders",
    "virtual_orders", "virtual_positions", "virtual_trades", "fund_transactions",
    "payout_requests", "referrals", "journal_entries", "risk_events", "risk_breaches",
    "user_notifications", "support_tickets", "certificates", "insights", "leads",
    "league_registrations", "weekly_payouts", "ai_revisions", "system_meta",
  ]);
  const persistent = (collection: string) => persistentCollections.has(collection);
  const all = async (collection: string) => persistent(collection)
    ? (await db.select().from(contentDocs).where(eq(contentDocs.collection, collection))).map((row) => row.data)
    : fallback.all(collection);
  const get = async (collection: string, id: string) => persistent(collection)
    ? (await db.select().from(contentDocs).where(and(eq(contentDocs.collection, collection), eq(contentDocs.id, String(id)))))[0]?.data ?? null
    : fallback.get(collection, id);
  const put = async (collection: string, doc: any) => {
    if (!persistent(collection)) return fallback.put(collection, doc);
    await db.insert(contentDocs).values({ collection, id: String(doc.id), data: doc })
      .onConflictDoUpdate({ target: [contentDocs.collection, contentDocs.id], set: { data: doc } });
    return doc;
  };
  const del = async (collection: string, id: string) => persistent(collection)
    ? db.delete(contentDocs).where(and(eq(contentDocs.collection, collection), eq(contentDocs.id, String(id))))
    : fallback.del(collection, id);
  const delAll = async (collection: string) => persistent(collection)
    ? db.delete(contentDocs).where(eq(contentDocs.collection, collection))
    : fallback.delAll(collection);
  const findOne = async (collection: string, predicate: (doc: any) => boolean) => (await all(collection)).find(predicate) || null;
  return { all, get, put, del, delAll, findOne };
}
