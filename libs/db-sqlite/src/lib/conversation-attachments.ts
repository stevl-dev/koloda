// The device-local twin of `attachments.ts` for files attached in the assistant — mirrors Rust
// `repo::conversation_attachments`. Only conversation state keeps a row alive (docs/decisions/MEDIA-STORAGE.md).
import { throwKnownError } from "@koloda/app";
import {
  addConversationAttachmentSchema,
  conversationAttachmentRowSchema,
  sniffConversationAttachmentMime,
} from "@koloda/srs";
import type {
  AddAttachmentData,
  ConversationAttachment,
  ConversationAttachmentMime,
  SweepAttachmentsData,
} from "@koloda/srs";
import { readConversationAttachmentBytes, writeConversationAttachmentBytes } from "./attachment-bytes";
import { sha256Hex } from "./attachments";
import { ATTACHMENT_SELECT } from "./columns";
import type { DB } from "./db";
import { parseRow, parseRowOrNull } from "./parse-rows";
import { nowMs } from "./sql";

const CONVERSATION_ATTACHMENT_REF_IN_TEXT = /conversation-attachment:([0-9a-f]{64})/g;

async function selectConversationAttachment(db: DB, id: string) {
  return db.get(`SELECT ${ATTACHMENT_SELECT} FROM conversation_attachments WHERE id = ?`, [id]);
}

export async function addConversationAttachment(db: DB, data: AddAttachmentData): Promise<ConversationAttachment> {
  return throwKnownError("db.add", async () => {
    const { bytes, width, height } = addConversationAttachmentSchema.parse(data);
    // INVARIANT: the schema already rejected bytes of no accepted kind.
    const mime = sniffConversationAttachmentMime(bytes) as ConversationAttachmentMime;
    // INVARIANT: only an image has a size in pixels. Twin: `add_conversation_attachment` in Rust.
    const isImage = mime.startsWith("image/");
    // INVARIANT: the id is the lowercase hex SHA-256 of the bytes, so equal bytes share one row.
    const id = await sha256Hex(bytes);

    return db.transaction(async (tx) => {
      const now = nowMs();
      const { changes } = await tx.run(
        `INSERT INTO conversation_attachments (id, mime, size, width, height, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING`,
        [id, mime, bytes.byteLength, (isImage && width) || null, (isImage && height) || null, now],
      );
      // WHY: as for card images, a re-add keeps the first row and moves its storage time forward, so the
      // sweep's grace counts from the latest add. Twin: `add_conversation_attachment` in
      // `crates/koloda/src/repo/conversation_attachments.rs`.
      if (changes > 0) await writeConversationAttachmentBytes(tx, id, bytes);
      else await tx.run(`UPDATE conversation_attachments SET created_at = MAX(created_at, ?) WHERE id = ?`, [now, id]);
      return parseRow(conversationAttachmentRowSchema, await selectConversationAttachment(tx, id));
    });
  });
}

export async function getConversationAttachment(
  db: DB,
  id: ConversationAttachment["id"],
): Promise<ConversationAttachment | null> {
  return throwKnownError("db.get", async () =>
    parseRowOrNull(conversationAttachmentRowSchema, await selectConversationAttachment(db, id)),
  );
}

export async function getConversationAttachmentBytes(
  db: DB,
  id: ConversationAttachment["id"],
): Promise<Uint8Array<ArrayBuffer> | null> {
  return throwKnownError("db.get", async () => readConversationAttachmentBytes(db, id));
}

export async function sweepConversationAttachments(db: DB, { createdBefore }: SweepAttachmentsData) {
  return throwKnownError("db.delete", async () => {
    await db.transaction(async (tx) => {
      const candidates = await tx.all(`SELECT id FROM conversation_attachments WHERE created_at < ?`, [createdBefore]);
      const unreferenced = new Set(candidates.map(({ id }) => String(id)));
      if (unreferenced.size === 0) return;

      // WHY: as in the card sweep, one pass over the stored text. Neither the hex id nor the prefix can be hidden
      // by JSON escaping, so a match on the stored state finds every ref without parsing it.
      for (const { state } of await tx.all(`SELECT state FROM conversations`)) {
        for (const [, id] of String(state).matchAll(CONVERSATION_ATTACHMENT_REF_IN_TEXT)) unreferenced.delete(id);
        if (unreferenced.size === 0) return;
      }

      // WHY: bytes go through the foreign-key cascade.
      for (const id of unreferenced) await tx.run(`DELETE FROM conversation_attachments WHERE id = ?`, [id]);
    });
  });
}
