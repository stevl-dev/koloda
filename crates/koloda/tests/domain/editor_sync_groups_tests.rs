use std::collections::{BTreeMap, BTreeSet};

use koloda_sync_proto::registry::Kind;
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EditorGroups {
    kind: String,
    /// Wire group name to the editor's form path; `None` for a group no editor shows.
    groups: BTreeMap<String, Option<String>>,
}

#[test]
fn editor_sync_groups_name_every_registry_group_of_their_kind() {
    let path = format!("{}/tests/cases/editor-sync-groups.json", env!("CARGO_MANIFEST_DIR"));
    let text = std::fs::read_to_string(&path).expect("editor sync group file should be readable");
    let entries: Vec<EditorGroups> = serde_json::from_str(&text).expect("editor sync group file should parse");

    let mut seen = BTreeSet::new();
    for entry in entries {
        assert!(seen.insert(entry.kind.clone()), "{} is listed twice", entry.kind);
        let kind = Kind::from_wire(&entry.kind).expect("listed kind should be a registry kind");
        let registry: BTreeSet<&str> = kind.spec().groups.iter().map(|spec| spec.group.as_wire()).collect();
        let listed: BTreeSet<&str> = entry.groups.keys().map(String::as_str).collect();
        assert_eq!(
            listed, registry,
            "{}: listed groups differ from the registry",
            entry.kind
        );
    }
}
