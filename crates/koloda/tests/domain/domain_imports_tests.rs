//! Import rules of `domain/` (`agents/RUST.md` §Non-negotiables): no `rusqlite`, no `repo/`.
use std::fs;
use std::path::{Path, PathBuf};

fn rust_files(dir: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    for entry in fs::read_dir(dir).expect("read domain dir") {
        let path = entry.expect("read domain entry").path();
        if path.is_dir() {
            files.extend(rust_files(&path));
        } else if path.extension().is_some_and(|ext| ext == "rs") {
            files.push(path);
        }
    }
    files
}

#[test]
fn domain_imports_neither_rusqlite_nor_repo() {
    let domain = Path::new(env!("CARGO_MANIFEST_DIR")).join("src/domain");
    let mut violations = Vec::new();
    for file in rust_files(&domain) {
        let source = fs::read_to_string(&file).expect("read domain file");
        for (index, line) in source.lines().enumerate() {
            // WHY: the module docs name `rusqlite` to state the rule; only code outside a comment breaks it.
            let code = line.split("//").next().unwrap_or_default();
            // WHY: whole words, not `crate::repo`: a grouped import (`use crate::{app::x, repo::y}`) or a `super::`
            // path never spells that, and `repository` must not match.
            let mut words = code.split(|c: char| !c.is_alphanumeric() && c != '_');
            if words.any(|word| word == "rusqlite" || word == "repo") {
                violations.push(format!("{}:{}: {}", file.display(), index + 1, line.trim()));
            }
        }
    }
    assert!(
        violations.is_empty(),
        "domain/ must not import rusqlite or repo/:\n{}",
        violations.join("\n")
    );
}
