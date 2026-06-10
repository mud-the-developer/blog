#![no_main]

use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    let Ok(markdown) = std::str::from_utf8(data) else {
        return;
    };

    let _post = mud_blog::parse_markdown_post(markdown, "fuzz-target");
});
