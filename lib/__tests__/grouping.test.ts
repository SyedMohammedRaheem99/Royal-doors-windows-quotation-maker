import { describe, expect, it } from "vitest";
import { groupItemsByRoom, usesRooms, type GroupableItem } from "../grouping";

const item = (id: string, room: string | undefined, amount: number): GroupableItem => ({ id, room, amount });

describe("groupItemsByRoom", () => {
  it("groups items sharing a room", () => {
    const groups = groupItemsByRoom([
      item("1", "Bedroom", 1000),
      item("2", "Bedroom", 2000),
      item("3", "Kitchen", 500),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].room).toBe("Bedroom");
    expect(groups[0].items).toHaveLength(2);
  });

  it("subtotals each room", () => {
    const groups = groupItemsByRoom([
      item("1", "Bedroom", 1000),
      item("2", "Bedroom", 2000),
      item("3", "Kitchen", 500),
    ]);
    expect(groups[0].subtotal).toBe(3000);
    expect(groups[1].subtotal).toBe(500);
  });

  it("orders rooms by FIRST occurrence, not alphabetically", () => {
    // A quotation walks the property in a deliberate order; re-sorting it
    // alphabetically would scramble how the customer reads it.
    const groups = groupItemsByRoom([
      item("1", "Terrace", 100),
      item("2", "Balcony", 100),
      item("3", "Attic", 100),
    ]);
    expect(groups.map((g) => g.room)).toEqual(["Terrace", "Balcony", "Attic"]);
  });

  it("keeps item numbers continuous across rooms rather than restarting", () => {
    // "Item 3" must mean one thing when the customer phones about it.
    const groups = groupItemsByRoom([
      item("1", "Bedroom", 100),
      item("2", "Kitchen", 100),
      item("3", "Bedroom", 100),
    ]);
    const bedroom = groups.find((g) => g.room === "Bedroom")!;
    const kitchen = groups.find((g) => g.room === "Kitchen")!;
    expect(bedroom.items.map((i) => i.displayIndex)).toEqual([1, 3]);
    expect(kitchen.items.map((i) => i.displayIndex)).toEqual([2]);
  });

  it("groups blank and missing rooms together", () => {
    const groups = groupItemsByRoom([item("1", "", 100), item("2", undefined, 100)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].room).toBe("");
  });

  it("trims whitespace so 'Balcony ' and 'Balcony' are one room", () => {
    const groups = groupItemsByRoom([item("1", "Balcony", 100), item("2", " Balcony ", 100)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].subtotal).toBe(200);
  });

  it("does NOT fold case — two differently-cased labels stay distinct", () => {
    // Deliberate: merging them could combine two genuinely different labels
    // the salesperson meant to keep apart.
    const groups = groupItemsByRoom([item("1", "Bedroom 1", 100), item("2", "bedroom 1", 100)]);
    expect(groups).toHaveLength(2);
  });

  it("handles an empty quotation", () => {
    expect(groupItemsByRoom([])).toEqual([]);
  });

  it("avoids floating-point drift in subtotals", () => {
    const groups = groupItemsByRoom([item("1", "A", 0.1), item("2", "A", 0.2)]);
    expect(groups[0].subtotal).toBe(0.3);
  });

  it("subtotals across all groups sum to the quotation total", () => {
    const items = [item("1", "A", 1000), item("2", "B", 2500), item("3", "", 375)];
    const groups = groupItemsByRoom(items);
    const summed = groups.reduce((s, g) => s + g.subtotal, 0);
    expect(summed).toBe(3875);
  });
});

describe("usesRooms", () => {
  it("is false when no item names a room", () => {
    expect(usesRooms([item("1", "", 1), item("2", undefined, 1)])).toBe(false);
  });

  it("is true as soon as one item names a room", () => {
    expect(usesRooms([item("1", "", 1), item("2", "Kitchen", 1)])).toBe(true);
  });

  it("ignores whitespace-only room names", () => {
    expect(usesRooms([item("1", "   ", 1)])).toBe(false);
  });
});
