/// Extract the text content of the first occurrence of `<tag ...>content</tag>`.
pub fn extract_text(xml: &str, tag: &str) -> Option<String> {
    let open = format!("<{}", tag);
    let close = format!("</{}>", tag);
    let start = xml.find(&open)?;
    let after_open = &xml[start..];
    let gt = after_open.find('>')?;
    let content_start = start + gt + 1;
    let end = xml[content_start..].find(&close)?;
    Some(xml[content_start..content_start + end].trim().to_string())
}

/// Extract an attribute value from the first matching `<tag attr="value" ...>`.
pub fn extract_attr(xml: &str, tag: &str, attr: &str) -> Option<String> {
    let open = format!("<{}", tag);
    let mut search_from = 0;
    while let Some(pos) = xml[search_from..].find(&open) {
        let abs = search_from + pos;
        let after_tag = abs + open.len();
        // Ensure word boundary (next char is space, >, /)
        if let Some(ch) = xml[after_tag..].chars().next() {
            if ch != ' ' && ch != '>' && ch != '/' && ch != '\n' {
                search_from = after_tag;
                continue;
            }
        }
        let after = &xml[abs..];
        let end = after.find('>')?;
        let tag_content = &after[..end];
        // Try double quotes
        let dq_pattern = format!("{}=\"", attr);
        if let Some(attr_start) = tag_content.find(&dq_pattern) {
            let value_start = attr_start + dq_pattern.len();
            let value_end = tag_content[value_start..].find('"')?;
            return Some(tag_content[value_start..value_start + value_end].to_string());
        }
        // Try single quotes
        let sq_pattern = format!("{}='", attr);
        if let Some(attr_start) = tag_content.find(&sq_pattern) {
            let value_start = attr_start + sq_pattern.len();
            let value_end = tag_content[value_start..].find('\'')?;
            return Some(tag_content[value_start..value_start + value_end].to_string());
        }
        search_from = after_tag;
    }
    None
}

/// Split XML into blocks delimited by `<tag ...>...</tag>` or self-closing `<tag .../>`.
pub fn split_blocks(xml: &str, tag: &str) -> Vec<String> {
    let open = format!("<{}", tag);
    let close = format!("</{}>", tag);
    let mut blocks = Vec::new();
    let mut search_from = 0;

    while let Some(start) = xml[search_from..].find(&open) {
        let abs_start = search_from + start;
        let after_tag = abs_start + open.len();
        // Ensure word boundary
        if let Some(ch) = xml[after_tag..].chars().next() {
            if ch != ' ' && ch != '>' && ch != '/' && ch != '\n' {
                search_from = after_tag;
                continue;
            }
        }
        // Try to find closing tag
        if let Some(end) = xml[abs_start..].find(&close) {
            let abs_end = abs_start + end + close.len();
            blocks.push(xml[abs_start..abs_end].to_string());
            search_from = abs_end;
        } else {
            // Self-closing or no close tag, find the next '>'
            if let Some(gt) = xml[abs_start..].find('>') {
                let abs_end = abs_start + gt + 1;
                blocks.push(xml[abs_start..abs_end].to_string());
                search_from = abs_end;
            } else {
                break;
            }
        }
    }
    blocks
}

/// Extract the text content of a simple `<tag>content</tag>` (no attributes).
pub fn extract_simple_text(xml: &str, tag: &str) -> Option<String> {
    let open = format!("<{}>", tag);
    let close = format!("</{}>", tag);
    let start = xml.find(&open)?;
    let content_start = start + open.len();
    let end = xml[content_start..].find(&close)?;
    Some(xml[content_start..content_start + end].trim().to_string())
}
