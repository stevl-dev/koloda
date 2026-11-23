import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TestDb } from "../test/test-helpers";
import { createTestDb } from "../test/test-helpers";
import { getAttachment } from "./attachments";
import {
  addConversationAttachment,
  getConversationAttachment,
  getConversationAttachmentBytes,
  sweepConversationAttachments,
} from "./conversation-attachments";
import { setConversation } from "./conversations";
import type { DB } from "./db";

// WHY: the card store and the Rust twin mint this id for the same bytes.
const PNG_16_ID = "d9c9bcbbba3f78d5acb0e0223861c44f79e918c161d4ea7b571f5cc6df50797f";

function pngOfLength(length: number) {
  const bytes = new Uint8Array(length);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes;
}

async function countRows(db: DB, table: string) {
  const row = await db.get(`SELECT COUNT(*) AS count FROM ${table}`);
  return Number(row?.count);
}

async function setCreatedAt(db: DB, id: string, createdAt: number) {
  await db.run(`UPDATE conversation_attachments SET created_at = ? WHERE id = ?`, [createdAt, id]);
}

describe("conversation attachments repository integration", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  // Twin: `add_conversation_attachment_round_trips_every_field_in_its_own_tables` in Rust.
  it("round-trips every field in its own tables", async () => {
    const { db } = testDb;

    const added = await addConversationAttachment(db, { bytes: pngOfLength(16), width: 640, height: 480 });
    const stored = await getConversationAttachment(db, PNG_16_ID);

    expect(stored).toEqual({
      id: PNG_16_ID,
      mime: "image/png",
      size: 16,
      width: 640,
      height: 480,
      createdAt: expect.any(Date),
    });
    expect(stored).toEqual(added);
    expect(await getConversationAttachmentBytes(db, PNG_16_ID)).toEqual(pngOfLength(16));
    expect(await countRows(db, "attachments")).toBe(0);
    expect(await getAttachment(db, PNG_16_ID)).toBeNull();
  });

  // Twin: `re_adding_the_same_bytes_keeps_one_row_and_moves_its_storage_time_forward` in Rust.
  it("keeps the first row and moves its storage time forward on a re-add", async () => {
    const { db } = testDb;
    const first = await addConversationAttachment(db, { bytes: pngOfLength(16), width: 640, height: 480 });
    await setCreatedAt(db, first.id, 1_000);

    const second = await addConversationAttachment(db, { bytes: pngOfLength(16) });

    expect([second.width, second.height]).toEqual([640, 480]);
    expect(second.createdAt.getTime()).toBeGreaterThan(1_000);
    expect(await countRows(db, "conversation_attachments")).toBe(1);
    expect(await countRows(db, "conversation_attachment_bytes")).toBe(1);
  });

  // Twin: `add_conversation_attachment_rejects_bytes_with_no_image_format` in Rust.
  it("rejects bytes with no image format and writes nothing", async () => {
    const { db } = testDb;

    await expect(
      addConversationAttachment(db, { bytes: new TextEncoder().encode("plain text") }),
    ).rejects.toMatchObject({ issues: [expect.objectContaining({ message: "validation.attachments.format" })] });
    expect(await countRows(db, "conversation_attachments")).toBe(0);
  });

  // Twin: `sweep_removes_only_old_images_no_conversation_names` in Rust.
  it("sweeps only images no conversation names, created before the cutoff", async () => {
    const { db } = testDb;
    const cutoff = new Date(1_000_000);
    const named = await addConversationAttachment(db, { bytes: pngOfLength(16) });
    const alsoNamed = await addConversationAttachment(db, { bytes: pngOfLength(19) });
    const cardRefOnly = await addConversationAttachment(db, { bytes: pngOfLength(20) });
    const old = await addConversationAttachment(db, { bytes: pngOfLength(17) });
    const atCutoff = await addConversationAttachment(db, { bytes: pngOfLength(18) });
    for (const { id } of [named, alsoNamed, cardRefOnly, old]) await setCreatedAt(db, id, cutoff.getTime() - 1);
    await setCreatedAt(db, atCutoff.id, cutoff.getTime());

    // The refs sit in two places of one state, and a card-style ref does not count.
    await setConversation(db, {
      id: "conversation-1",
      state: {
        messages: [{ parts: [{ type: "file", url: `conversation-attachment:${named.id}` }] }],
        promptAttachments: [`conversation-attachment:${alsoNamed.id}`],
        promptInput: `![x](attachment:${cardRefOnly.id})`,
      },
    });

    await sweepConversationAttachments(db, { createdBefore: cutoff });

    expect(await getConversationAttachment(db, named.id)).not.toBeNull();
    expect(await getConversationAttachment(db, alsoNamed.id)).not.toBeNull();
    expect(await getConversationAttachment(db, cardRefOnly.id)).toBeNull();
    expect(await getConversationAttachment(db, old.id)).toBeNull();
    expect(await getConversationAttachmentBytes(db, old.id)).toBeNull();
    expect(await getConversationAttachment(db, atCutoff.id)).not.toBeNull();
  });
});
