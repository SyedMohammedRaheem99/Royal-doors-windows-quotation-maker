import { getDb } from "./db";

export async function updateRates(updates: Array<{ productType: string; defaultRate: number }>) {
  const db = await getDb();
  const rateCard = db.collection("rateCard");
  await Promise.all(
    updates.map((u) => rateCard.updateOne({ productType: u.productType }, { $set: { defaultRate: u.defaultRate } }))
  );
}
