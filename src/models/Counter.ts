import { Schema, model, models } from "mongoose";

const CounterSchema = new Schema({
  _id: { type: String, required: true }, // e.g. "order"
  seq: { type: Number, default: 0 },
});

export const Counter = models.Counter || model("Counter", CounterSchema);

/**
 * Atomically increments and returns the next sequence number for `key`.
 * Safe under concurrent fast order entry (findOneAndUpdate is atomic).
 */
export async function nextSequence(key: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return doc.seq;
}
