/**
 * Groups quotation items by room for the printed document.
 *
 * Extracted from QuotationDocument so the ordering and numbering rules are
 * testable — they are easy to get subtly wrong, and a quotation whose item
 * numbers don't match what the customer is looking at causes real confusion
 * on a phone call.
 */

export interface GroupableItem {
  id: string;
  room?: string;
  amount: number;
}

export interface RoomGroup<T> {
  room: string;
  subtotal: number;
  items: Array<{ item: T; displayIndex: number }>;
}

/**
 * Rules:
 *  - Rooms appear in the order they FIRST occur, not alphabetically — a
 *    quotation usually walks the property in a deliberate order.
 *  - Item numbers run 1..n across the whole document and never restart per
 *    room, so "item 7" is unambiguous.
 *  - Items whose room is blank group together under "".
 *  - Room names are trimmed and matched exactly, so "Balcony" and "balcony "
 *    are treated as the same room only after trimming (case is preserved and
 *    NOT folded — "Bedroom 1" vs "bedroom 1" stay distinct, since forcing a
 *    match could merge two genuinely different labels).
 */
export function groupItemsByRoom<T extends GroupableItem>(items: T[]): RoomGroup<T>[] {
  const groups: RoomGroup<T>[] = [];

  items.forEach((item, i) => {
    const room = (item.room ?? "").trim();
    let group = groups.find((g) => g.room === room);
    if (!group) {
      group = { room, subtotal: 0, items: [] };
      groups.push(group);
    }
    group.items.push({ item, displayIndex: i + 1 });
    group.subtotal = Math.round((group.subtotal + item.amount) * 100) / 100;
  });

  return groups;
}

/** True when at least one item names a room — otherwise headings are suppressed entirely. */
export function usesRooms(items: GroupableItem[]): boolean {
  return items.some((item) => (item.room ?? "").trim() !== "");
}
