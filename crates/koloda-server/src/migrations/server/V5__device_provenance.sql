-- WHY: a pairing row is deleted once its code expires, so the device that issued a claimed code is kept on the device
-- it enrolled. The device list shows it beside `forked_from`, so an owner who removes a stolen device can find what it
-- invited (crates/koloda-sync-proto/PROTOCOL.md, Devices).
ALTER TABLE devices ADD COLUMN paired_by blob REFERENCES devices (id);
