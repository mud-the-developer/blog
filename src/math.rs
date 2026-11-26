//! Lightweight zero-dependency LaTeX-to-MathML Core converter for Markdown math spans.
//! Produces static semantic MathML with zero client runtime or external CDN dependencies.

const MATHML_NS: &str = "http://www.w3.org/1998/Math/MathML";

pub fn render_math_html(tex: &str, display: bool) -> String {
    let trimmed = tex.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let body = render_group(trimmed);
    let escaped_tex = escape_attr(trimmed);
    if display {
        format!(
            "<div class=\"math-block\" data-tex=\"{escaped_tex}\"><math xmlns=\"{MATHML_NS}\" display=\"block\">{body}</math></div>"
        )
    } else {
        format!(
            "<span class=\"math-inline\" data-tex=\"{escaped_tex}\"><math xmlns=\"{MATHML_NS}\" display=\"inline\">{body}</math></span>"
        )
    }
}

fn escape_text(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            _ => out.push(ch),
        }
    }
    out
}

fn escape_attr(s: &str) -> String {
    escape_text(s).replace('"', "&quot;").replace('\'', "&#39;")
}

fn render_group(input: &str) -> String {
    let mut parser = TexParser::new(input);
    let nodes = parser.parse_sequence(None);
    if nodes.len() == 1 {
        nodes.into_iter().next().unwrap_or_default()
    } else {
        format!("<mrow>{}</mrow>", nodes.concat())
    }
}

struct TexParser<'a> {
    src: &'a str,
    pos: usize,
}

impl<'a> TexParser<'a> {
    fn new(src: &'a str) -> Self {
        Self { src, pos: 0 }
    }

    fn rest(&self) -> &'a str {
        &self.src[self.pos..]
    }

    fn peek(&self) -> Option<char> {
        self.rest().chars().next()
    }

    fn next_char(&mut self) -> Option<char> {
        let ch = self.peek()?;
        self.pos += ch.len_utf8();
        Some(ch)
    }

    fn skip_ws(&mut self) {
        while let Some(ch) = self.peek() {
            if ch.is_whitespace() {
                self.pos += ch.len_utf8();
            } else {
                break;
            }
        }
    }

    fn parse_sequence(&mut self, stop_at: Option<char>) -> Vec<String> {
        let mut nodes = Vec::new();
        loop {
            self.skip_ws();
            let Some(ch) = self.peek() else {
                break;
            };
            if stop_at == Some(ch) {
                self.next_char();
                break;
            }
            if ch == '^' || ch == '_' {
                let base = nodes.pop().unwrap_or_else(|| "<mrow></mrow>".to_string());
                let combined = self.parse_scripts(base);
                nodes.push(combined);
                continue;
            }
            if let Some(atom) = self.parse_atom() {
                // Check for immediate scripts ^ or _
                self.skip_ws();
                if matches!(self.peek(), Some('^' | '_')) {
                    let combined = self.parse_scripts(atom);
                    nodes.push(combined);
                } else {
                    nodes.push(atom);
                }
            }
        }
        nodes
    }

    fn parse_scripts(&mut self, base: String) -> String {
        let mut sub: Option<String> = None;
        let mut sup: Option<String> = None;
        loop {
            self.skip_ws();
            match self.peek() {
                Some('_') if sub.is_none() => {
                    self.next_char();
                    sub = Some(self.parse_arg());
                }
                Some('^') if sup.is_none() => {
                    self.next_char();
                    sup = Some(self.parse_arg());
                }
                _ => break,
            }
        }
        let is_big_op = base.contains("∑")
            || base.contains("∏")
            || base.contains("∫")
            || base.contains(">lim<")
            || base.contains(">max<")
            || base.contains(">min<")
            || base.contains(">arg");
        match (sub, sup) {
            (Some(b), Some(p)) if is_big_op => format!("<munderover>{base}{b}{p}</munderover>"),
            (Some(b), Some(p)) => format!("<msubsup>{base}{b}{p}</msubsup>"),
            (Some(b), None) if is_big_op => format!("<munder>{base}{b}</munder>"),
            (Some(b), None) => format!("<msub>{base}{b}</msub>"),
            (None, Some(p)) if is_big_op => format!("<mover>{base}{p}</mover>"),
            (None, Some(p)) => format!("<msup>{base}{p}</msup>"),
            (None, None) => base,
        }
    }

    fn parse_arg(&mut self) -> String {
        self.skip_ws();
        if self.peek() == Some('{') {
            self.next_char();
            let items = self.parse_sequence(Some('}'));
            if items.len() == 1 {
                items.into_iter().next().unwrap_or_default()
            } else {
                format!("<mrow>{}</mrow>", items.concat())
            }
        } else {
            self.parse_atom()
                .unwrap_or_else(|| "<mrow></mrow>".to_string())
        }
    }

    fn parse_raw_braced(&mut self) -> String {
        self.skip_ws();
        if self.peek() != Some('{') {
            return self.next_char().map(|c| c.to_string()).unwrap_or_default();
        }
        self.next_char();
        let mut depth = 1usize;
        let mut out = String::new();
        while let Some(ch) = self.next_char() {
            if ch == '{' {
                depth += 1;
                out.push(ch);
            } else if ch == '}' {
                depth -= 1;
                if depth == 0 {
                    break;
                }
                out.push(ch);
            } else {
                out.push(ch);
            }
        }
        out
    }

    fn parse_atom(&mut self) -> Option<String> {
        self.skip_ws();
        let ch = self.peek()?;
        match ch {
            '{' => {
                self.next_char();
                let items = self.parse_sequence(Some('}'));
                Some(if items.len() == 1 {
                    items.into_iter().next().unwrap_or_default()
                } else {
                    format!("<mrow>{}</mrow>", items.concat())
                })
            }
            '}' => {
                self.next_char();
                None
            }
            '\\' => {
                self.next_char();
                Some(self.parse_command())
            }
            '0'..='9' => {
                let mut num = String::new();
                while let Some(d) = self.peek() {
                    if d.is_ascii_digit() || d == '.' {
                        num.push(d);
                        self.next_char();
                    } else {
                        break;
                    }
                }
                Some(format!("<mn>{num}</mn>"))
            }
            'a'..='z' | 'A'..='Z' => {
                self.next_char();
                Some(format!("<mi>{ch}</mi>"))
            }
            '+' | '-' | '=' | '<' | '>' | '/' | '*' | '(' | ')' | '[' | ']' | '|' | ',' | ':'
            | ';' | '!' | '\'' => {
                self.next_char();
                let rendered = match ch {
                    '-' => "−".to_string(),
                    '\'' => "′".to_string(),
                    _ => escape_text(&ch.to_string()),
                };
                Some(format!("<mo>{rendered}</mo>"))
            }
            _ => {
                self.next_char();
                Some(format!("<mtext>{}</mtext>", escape_text(&ch.to_string())))
            }
        }
    }

    fn parse_command(&mut self) -> String {
        let Some(first) = self.peek() else {
            return "<mo>\\</mo>".to_string();
        };
        if !first.is_ascii_alphabetic() {
            self.next_char();
            return match first {
                ',' | ';' | ':' | ' ' => "<mspace width=\"0.22em\"/>".to_string(),
                '!' => "<mspace width=\"-0.12em\"/>".to_string(),
                '{' | '}' | '%' | '#' | '&' | '_' | '$' => {
                    format!("<mo>{}</mo>", escape_text(&first.to_string()))
                }
                '|' => "<mo>‖</mo>".to_string(),
                '\\' => "<mspace linebreak=\"newline\"/>".to_string(),
                _ => format!("<mo>{}</mo>", escape_text(&first.to_string())),
            };
        }

        let mut cmd = String::new();
        while let Some(c) = self.peek() {
            if c.is_ascii_alphabetic() {
                cmd.push(c);
                self.next_char();
            } else {
                break;
            }
        }

        match cmd.as_str() {
            "frac" | "dfrac" | "tfrac" => {
                let num = self.parse_arg();
                let den = self.parse_arg();
                format!("<mfrac>{num}{den}</mfrac>")
            }
            "sqrt" => {
                self.skip_ws();
                if self.peek() == Some('[') {
                    self.next_char();
                    let idx_nodes = self.parse_sequence(Some(']'));
                    let idx = format!("<mrow>{}</mrow>", idx_nodes.concat());
                    let body = self.parse_arg();
                    format!("<mroot>{body}{idx}</mroot>")
                } else {
                    let body = self.parse_arg();
                    format!("<msqrt>{body}</msqrt>")
                }
            }
            "text" | "textrm" | "operatorname" => {
                let raw = self.parse_raw_braced();
                if cmd == "operatorname" {
                    format!("<mi mathvariant=\"normal\">{}</mi>", escape_text(&raw))
                } else {
                    format!("<mtext>{}</mtext>", escape_text(&raw))
                }
            }
            "mathrm" => {
                let raw = self.parse_raw_braced();
                format!("<mi mathvariant=\"normal\">{}</mi>", escape_text(&raw))
            }
            "mathbf" | "boldsymbol" | "bm" => {
                let inner = self.parse_arg();
                format!("<mstyle mathvariant=\"bold\">{inner}</mstyle>")
            }
            "mathbb" => {
                let raw = self.parse_raw_braced();
                let mapped: String = raw.chars().map(map_blackboard).collect();
                format!("<mi mathvariant=\"normal\">{}</mi>", escape_text(&mapped))
            }
            "mathcal" => {
                let raw = self.parse_raw_braced();
                let mapped: String = raw.chars().map(map_calligraphic).collect();
                format!("<mi mathvariant=\"normal\">{}</mi>", escape_text(&mapped))
            }
            "hat" | "widehat" => format!(
                "<mover accent=\"true\">{}<mo>^</mo></mover>",
                self.parse_arg()
            ),
            "tilde" | "widetilde" => format!(
                "<mover accent=\"true\">{}<mo>~</mo></mover>",
                self.parse_arg()
            ),
            "bar" | "overline" => format!(
                "<mover accent=\"true\">{}<mo>¯</mo></mover>",
                self.parse_arg()
            ),
            "vec" => format!(
                "<mover accent=\"true\">{}<mo>→</mo></mover>",
                self.parse_arg()
            ),
            "dot" => format!(
                "<mover accent=\"true\">{}<mo>˙</mo></mover>",
                self.parse_arg()
            ),
            "left" | "right" | "big" | "Big" | "bigg" | "Bigg" => {
                self.skip_ws();
                match self.peek() {
                    Some('.') => {
                        self.next_char();
                        "<mrow></mrow>".to_string()
                    }
                    Some('\\') => {
                        self.next_char();
                        self.parse_command()
                    }
                    Some(d) => {
                        self.next_char();
                        format!("<mo stretchy=\"true\">{}</mo>", escape_text(&d.to_string()))
                    }
                    None => "<mrow></mrow>".to_string(),
                }
            }
            "begin" => {
                let env = self.parse_raw_braced();
                self.parse_environment(&env)
            }
            "quad" => "<mspace width=\"1em\"/>".to_string(),
            "qquad" => "<mspace width=\"2em\"/>".to_string(),
            _ => map_symbol(&cmd),
        }
    }

    fn parse_environment(&mut self, env: &str) -> String {
        let end_marker = format!("\\end{{{env}}}");
        let Some(end_offset) = self.rest().find(&end_marker) else {
            return format!("<mtext>{}</mtext>", escape_text(env));
        };
        let inner = &self.rest()[..end_offset];
        self.pos += end_offset + end_marker.len();

        let mut rows = String::new();
        for row_src in inner.split("\\\\") {
            let trimmed = row_src.trim();
            if trimmed.is_empty() {
                continue;
            }
            rows.push_str("<mtr>");
            for cell_src in trimmed.split('&') {
                rows.push_str("<mtd>");
                rows.push_str(&render_group(cell_src.trim()));
                rows.push_str("</mtd>");
            }
            rows.push_str("</mtr>");
        }
        let table = format!("<mtable>{rows}</mtable>");
        match env {
            "pmatrix" => format!("<mrow><mo>(</mo>{table}<mo>)</mo></mrow>"),
            "bmatrix" => format!("<mrow><mo>[</mo>{table}<mo>]</mo></mrow>"),
            "vmatrix" => format!("<mrow><mo>|</mo>{table}<mo>|</mo></mrow>"),
            "cases" => format!("<mrow><mo>{{</mo>{table}</mrow>"),
            _ => table,
        }
    }
}

fn map_blackboard(ch: char) -> char {
    match ch {
        'C' => 'ℂ',
        'E' => '𝔼',
        'N' => 'ℕ',
        'P' => 'ℙ',
        'Q' => 'ℚ',
        'R' => 'ℝ',
        'Z' => 'ℤ',
        _ => ch,
    }
}

fn map_calligraphic(ch: char) -> char {
    match ch {
        'A' => '𝒜',
        'B' => 'ℬ',
        'C' => '𝒞',
        'D' => '𝒟',
        'E' => 'ℰ',
        'F' => 'ℱ',
        'G' => '𝒢',
        'H' => 'ℋ',
        'I' => 'ℐ',
        'L' => 'ℒ',
        'M' => 'ℳ',
        'N' => '𝒩',
        'O' => '𝒪',
        'P' => '𝒫',
        'R' => 'ℛ',
        'S' => '𝒮',
        'T' => '𝒯',
        'U' => '𝒰',
        'V' => '𝒱',
        'W' => '𝒲',
        'X' => '𝒳',
        'Y' => '𝒴',
        _ => ch,
    }
}

fn map_symbol(cmd: &str) -> String {
    let greek_mi = match cmd {
        "alpha" => Some("α"),
        "beta" => Some("β"),
        "gamma" => Some("γ"),
        "delta" => Some("δ"),
        "epsilon" | "varepsilon" => Some("ε"),
        "zeta" => Some("ζ"),
        "eta" => Some("η"),
        "theta" | "vartheta" => Some("θ"),
        "iota" => Some("ι"),
        "kappa" => Some("κ"),
        "lambda" => Some("λ"),
        "mu" => Some("μ"),
        "nu" => Some("ν"),
        "xi" => Some("ξ"),
        "pi" => Some("π"),
        "rho" | "varrho" => Some("ρ"),
        "sigma" => Some("σ"),
        "tau" => Some("τ"),
        "upsilon" => Some("υ"),
        "phi" | "varphi" => Some("φ"),
        "chi" => Some("χ"),
        "psi" => Some("ψ"),
        "omega" => Some("ω"),
        "Gamma" => Some("Γ"),
        "Delta" => Some("Δ"),
        "Theta" => Some("Θ"),
        "Lambda" => Some("Λ"),
        "Xi" => Some("Ξ"),
        "Pi" => Some("Π"),
        "Sigma" => Some("Σ"),
        "Phi" => Some("Φ"),
        "Psi" => Some("Ψ"),
        "Omega" => Some("Ω"),
        "infty" => Some("∞"),
        "ell" => Some("ℓ"),
        _ => None,
    };
    if let Some(sym) = greek_mi {
        return format!("<mi>{sym}</mi>");
    }

    let op = match cmd {
        "sum" => Some("∑"),
        "prod" => Some("∏"),
        "int" => Some("∫"),
        "cdot" | "cdotp" => Some("·"),
        "cdots" => Some("⋯"),
        "ldots" | "dots" => Some("…"),
        "times" => Some("×"),
        "otimes" => Some("⊗"),
        "oplus" => Some("⊕"),
        "pm" => Some("±"),
        "mp" => Some("∓"),
        "le" | "leq" => Some("≤"),
        "ge" | "geq" => Some("≥"),
        "ne" | "neq" => Some("≠"),
        "approx" => Some("≈"),
        "equiv" => Some("≡"),
        "sim" => Some("∼"),
        "propto" => Some("∝"),
        "in" => Some("∈"),
        "notin" => Some("∉"),
        "subset" => Some("⊂"),
        "subseteq" => Some("⊆"),
        "cup" => Some("∪"),
        "cap" => Some("∩"),
        "forall" => Some("∀"),
        "exists" => Some("∃"),
        "nabla" => Some("∇"),
        "partial" => Some("∂"),
        "to" | "rightarrow" => Some("→"),
        "leftarrow" => Some("←"),
        "leftrightarrow" => Some("↔"),
        "Rightarrow" => Some("⇒"),
        "Leftarrow" => Some("⇐"),
        "Leftrightarrow" | "iff" => Some("⇔"),
        "mapsto" => Some("↦"),
        "langle" => Some("⟨"),
        "rangle" => Some("⟩"),
        "mid" => Some("|"),
        "Vert" => Some("‖"),
        "circ" => Some("∘"),
        "star" => Some("⋆"),
        "dagger" => Some("†"),
        _ => None,
    };
    if let Some(sym) = op {
        return format!("<mo>{sym}</mo>");
    }

    let func = match cmd {
        "sin" | "cos" | "tan" | "log" | "ln" | "exp" | "min" | "max" | "lim" | "sup" | "inf"
        | "det" | "dim" | "tr" | "Pr" | "arg" | "argmax" | "argmin" | "softmax" => Some(cmd),
        _ => None,
    };
    if let Some(name) = func {
        return format!("<mi mathvariant=\"normal\">{name}</mi>");
    }

    format!("<mi>{}</mi>", escape_text(cmd))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_inline_and_display_math_to_mathml() {
        let inline = render_math_html(r"\alpha_t + \frac{1}{N}", false);
        assert!(inline.contains("class=\"math-inline\""));
        assert!(inline.contains("<msub><mi>α</mi><mi>t</mi></msub>"));
        assert!(inline.contains("<mfrac><mn>1</mn><mi>N</mi></mfrac>"));

        let display = render_math_html(r"\sum_{i=1}^{N} \mathbb{E}[x_i]", true);
        assert!(display.contains("class=\"math-block\""));
        assert!(display.contains("display=\"block\""));
        assert!(display.contains("<munderover><mo>∑</mo>"));
        assert!(display.contains("𝔼"));
    }

    #[test]
    fn escapes_html_inside_tex_safely() {
        let html = render_math_html(r"x < y & \text{a<b>c}", false);
        assert!(html.contains("&lt;"));
        assert!(html.contains("&amp;"));
        assert!(!html.contains("<b>"));
    }
}
