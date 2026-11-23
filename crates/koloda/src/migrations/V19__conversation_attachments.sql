-- WHY: images attached in the assistant. Device-local, apart from the synced `attachments`
-- (docs/decisions/STORAGE-BUCKETS.md); the same shape, keyed by the SHA-256 of the bytes (docs/decisions/MEDIA-STORAGE.md).
CREATE TABLE IF NOT EXISTS conversation_attachments (
	id text PRIMARY KEY NOT NULL,
	mime text NOT NULL,
	size integer NOT NULL,
	width integer,
	height integer,
	created_at integer NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation_attachment_bytes (
	id text PRIMARY KEY NOT NULL,
	bytes blob NOT NULL,
	FOREIGN KEY (id) REFERENCES conversation_attachments(id) ON UPDATE NO ACTION ON DELETE CASCADE
);
