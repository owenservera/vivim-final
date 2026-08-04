# Specifications

Every fix in this package has a testable spec. A spec is only satisfied
when its verification step passes on a clean checkout of main.

#### UX7-S1

- **Requirement**: No view file in app/views/index/ MAY be 0 bytes (excluding .keep files).
- **Verification**: find app/views -type f -name '*.slim' -size 0 returns 0 matches.

#### UX7-S2

- **Requirement**: Every nav item MUST link to a real route, not an in-page anchor.
- **Verification**: grep -E 'root_path#' app/views/layouts/application.html.slim returns 0 matches.

#### UX7-S3

- **Requirement**: No external link in the footer MAY point to plus.google.com.
- **Verification**: grep -r 'plus.google.com' app/views/ returns 0 matches.

#### UX7-S4

- **Requirement**: /privacy and /terms MUST be routable and render real content.
- **Verification**: curl -I vivim.net/privacy returns 200; curl -I vivim.net/terms returns 200; both render inside the application layout.

#### UX7-S5

- **Requirement**: The 404 response MUST render inside the application layout (with site nav).
- **Verification**: curl -s vivim.net/nonexistent | grep -c 'navbar\|Vivim' outputs >= 1.

#### UX7-S6

- **Requirement**: No invalid </br> closing tags MAY appear in app/views/.
- **Verification**: grep -rE '</br>' app/views/ returns 0 matches.

#### UX7-S7

- **Requirement**: Nav item source text MUST be natural case (not ALL CAPS).
- **Verification**: grep -E "li.*[A-Z]{4,}" app/views/layouts/application.html.slim returns 0 matches.
