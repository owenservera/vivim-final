# Specifications

Every fix in this package has a testable spec. A spec is only satisfied
when its verification step passes on a clean checkout of main.

#### UX6-S1

- **Requirement**: No img-responsive class MAY appear in app/views/.
- **Verification**: grep -rn 'img-responsive' app/views/ returns 0 matches.

#### UX6-S2

- **Requirement**: The hero image MUST use srcset with at least 3 widths and a sizes attribute.
- **Verification**: View source of / shows <img srcset='... 480w, ... 1024w, ... 1920w' on the banner.

#### UX6-S3

- **Requirement**: The layout MUST include apple-touch-icon, theme-color, and manifest link tags.
- **Verification**: curl vivim.net/ | grep -cE 'apple-touch-icon|theme-color|rel="manifest"' outputs >= 3.

#### UX6-S4

- **Requirement**: /manifest.json MUST be valid JSON with name, icons (192+512), and theme_color.
- **Verification**: curl vivim.net/manifest.json | jq -e '.name and (.icons | length >= 2) and .theme_color' succeeds.

#### UX6-S5

- **Requirement**: The carousel MUST NOT auto-play when prefers-reduced-motion: reduce is set.
- **Verification**: Manual: set OS reduced motion, reload /, observe carousel does not advance after 6 seconds.

#### UX6-S6

- **Requirement**: The copyright year MUST equal the current year, not a hardcoded literal.
- **Verification**: grep -E '© 20[0-2][0-9]' app/views/layouts/application.html.slim returns 0 hardcoded year matches.

#### UX6-S7

- **Requirement**: The viewport meta MUST include viewport-fit=cover.
- **Verification**: curl vivim.net/ | grep -o 'viewport-fit=cover' outputs 'viewport-fit=cover'.
