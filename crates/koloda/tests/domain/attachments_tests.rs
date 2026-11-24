use koloda::domain::attachments::{
    sniff_conversation_attachment_mime, sniff_image_mime, AddAttachmentData, ATTACHMENT_MAX_BYTES, MIME_AVIF, MIME_GIF,
    MIME_JPEG, MIME_PNG, MIME_WEBP,
};
use koloda_sync_proto::transport::{ATTACHMENT_MIMES, MAX_ATTACHMENT_BYTES};

const PNG_SIGNATURE: &[u8] = b"\x89PNG\r\n\x1a\n";

fn ftyp(major: &[u8; 4], compatible: &[&[u8; 4]]) -> Vec<u8> {
    let size = 16 + 4 * compatible.len();
    let mut bytes = (size as u32).to_be_bytes().to_vec();
    bytes.extend_from_slice(b"ftyp");
    bytes.extend_from_slice(major);
    bytes.extend_from_slice(&[0, 0, 0, 0]);
    for brand in compatible {
        bytes.extend_from_slice(*brand);
    }
    bytes
}

fn png_of_len(len: usize) -> Vec<u8> {
    let mut bytes = PNG_SIGNATURE.to_vec();
    bytes.resize(len, 0);
    bytes
}

fn add_data(bytes: Vec<u8>) -> AddAttachmentData {
    AddAttachmentData {
        bytes,
        width: None,
        height: None,
    }
}

#[test]
fn test_sniff_image_mime_by_magic_bytes() {
    let mut avif_brand_past_box = ftyp(b"mif1", &[b"miaf"]);
    avif_brand_past_box.extend_from_slice(b"avif");
    let mut truncated_box = ftyp(b"avif", &[]);
    truncated_box[3] = 64;

    let cases: Vec<(&str, Vec<u8>, Option<&str>)> = vec![
        ("png", png_of_len(16), Some("image/png")),
        ("jpeg", vec![0xff, 0xd8, 0xff, 0xe0], Some("image/jpeg")),
        ("gif87a", b"GIF87a\x01\x00".to_vec(), Some("image/gif")),
        ("gif89a", b"GIF89a\x01\x00".to_vec(), Some("image/gif")),
        ("webp", b"RIFF\x00\x00\x00\x00WEBPVP8 ".to_vec(), Some("image/webp")),
        (
            "avif major brand",
            ftyp(b"avif", &[b"mif1", b"miaf"]),
            Some("image/avif"),
        ),
        (
            "avis compatible brand",
            ftyp(b"mif1", &[b"miaf", b"avis"]),
            Some("image/avif"),
        ),
        ("heic", ftyp(b"heic", &[b"mif1", b"heic"]), None),
        ("avif brand past the ftyp box", avif_brand_past_box, None),
        ("ftyp box longer than the file", truncated_box, None),
        ("riff wave", b"RIFF\x00\x00\x00\x00WAVEfmt ".to_vec(), None),
        ("svg", b"<svg xmlns=\"http://www.w3.org/2000/svg\"/>".to_vec(), None),
        ("png signature cut short", PNG_SIGNATURE[..7].to_vec(), None),
        ("empty", Vec::new(), None),
    ];

    for (name, bytes, expected) in cases {
        assert_eq!(sniff_image_mime(&bytes), expected, "{name}");
    }
}

// WHY: literals, not the constant, so changing the cap on one host fails here instead of moving the boundary along.
// The cap is a wire contract between the hosts and the sync protocol. Twin: "accepts an image at the size cap and
// rejects one byte past it" in `libs/srs/src/lib/attachments.test.ts`.
#[test]
fn test_add_attachment_size_cap() {
    let at_cap = add_data(png_of_len(5_242_880)).validate();
    assert_eq!(at_cap.expect("a cap-sized image must pass"), "image/png");

    let past_cap = add_data(png_of_len(5_242_881)).validate();
    assert_eq!(
        past_cap.expect_err("one byte past the cap must fail").code,
        "validation.attachments.too-large"
    );
}

#[test]
fn test_add_attachment_unknown_format_fails_with_format_code() {
    let error = add_data(b"<svg/>".to_vec()).validate().expect_err("svg must fail");
    assert_eq!(error.code, "validation.attachments.format");
}

// WHY: the sync server links only the protocol crate, so it holds its own copy of these limits; a device must never
// store an image the server would refuse.
#[test]
fn test_sync_server_accepts_every_attachment_a_device_stores() {
    assert_eq!(MAX_ATTACHMENT_BYTES, ATTACHMENT_MAX_BYTES);
    assert_eq!(ATTACHMENT_MIMES, [MIME_PNG, MIME_JPEG, MIME_GIF, MIME_WEBP, MIME_AVIF]);
}

fn filled(prefix: &[u8], len: usize, fill: u8) -> Vec<u8> {
    let mut bytes = prefix.to_vec();
    bytes.resize(len, fill);
    bytes
}

// Twin: "sniffConversationAttachmentMime" in `libs/srs/src/lib/attachments.test.ts`.
#[test]
fn test_sniff_conversation_attachment_mime() {
    let cases: Vec<(&str, Vec<u8>, Option<&str>)> = vec![
        ("png", png_of_len(10), Some("image/png")),
        ("pdf", b"%PDF-1.7\n%\xe2".to_vec(), Some("application/pdf")),
        (
            "pdf with a NUL byte",
            b"%PDF-1.4\n\x00".to_vec(),
            Some("application/pdf"),
        ),
        ("ascii text", b"word,translation\n".to_vec(), Some("text/plain")),
        (
            "multibyte utf-8",
            "Привет, мир\n".as_bytes().to_vec(),
            Some("text/plain"),
        ),
        (
            "utf-8 with a byte order mark",
            b"\xef\xbb\xbfnotes".to_vec(),
            Some("text/plain"),
        ),
        ("svg is text", b"<svg/>".to_vec(), Some("text/plain")),
        ("text with a NUL byte", b"a\x00b".to_vec(), None),
        ("invalid utf-8", vec![0x61, 0xc3, 0x28], None),
        ("utf-8 cut mid-character", vec![0x61, 0xd0], None),
        ("empty", Vec::new(), None),
    ];

    for (name, bytes, expected) in cases {
        assert_eq!(sniff_conversation_attachment_mime(&bytes), expected, "{name}");
    }
}

// WHY: literals, not the constants, so changing a cap on one host fails here instead of moving the boundary along.
// Twin: "addConversationAttachmentSchema" in `libs/srs/src/lib/attachments.test.ts`.
#[test]
fn test_add_conversation_attachment_caps() {
    let cases: Vec<(&str, Vec<u8>, Result<&str, &str>)> = vec![
        (
            "pdf at the cap",
            filled(b"%PDF-", 20_971_520, b' '),
            Ok("application/pdf"),
        ),
        (
            "pdf past the cap",
            filled(b"%PDF-", 20_971_521, b' '),
            Err("validation.conversation-attachments.pdf-too-large"),
        ),
        ("text at the cap", filled(b"", 1_048_576, b'a'), Ok("text/plain")),
        (
            "text past the cap",
            filled(b"", 1_048_577, b'a'),
            Err("validation.conversation-attachments.text-too-large"),
        ),
        ("image at the card cap", png_of_len(5_242_880), Ok("image/png")),
        (
            "image past the card cap",
            png_of_len(5_242_881),
            Err("validation.attachments.too-large"),
        ),
        (
            "binary bytes",
            vec![0x61, 0, 0x62],
            Err("validation.conversation-attachments.format"),
        ),
    ];

    for (name, bytes, expected) in cases {
        let result = add_data(bytes).validate_for_conversation().map_err(|error| error.code);
        assert_eq!(result.as_ref().copied().map_err(String::as_str), expected, "{name}");
    }
}
