# Specifications

Every fix in this package has a testable spec. A spec is only satisfied
when its verification step passes on a clean checkout of main.

#### UX5-S1

- **Requirement**: Every form field MUST have an associated <label for='...'> element.
- **Verification**: axe-core run on /#contact returns 0 'form-field-multiple-labels' and 0 'label' violations.

#### UX5-S2

- **Requirement**: The contact controller MUST set flash[:notice] on success and flash[:alert] on failure.
- **Verification**: Source of app/controllers/index_controller.rb contains both 'flash[:notice]' and 'flash[:alert]' assignments.

#### UX5-S3

- **Requirement**: The layout MUST render a div[role='status'][aria-live='polite'] for notices and div[role='alert'][aria-live='assertive'] for alerts.
- **Verification**: View source of / shows both aria-live regions (empty if no flash, populated if flash set).

#### UX5-S4

- **Requirement**: Server-side validation MUST enforce: name 3-100 chars, email RFC-5322-ish, comment 10-5000 chars.
- **Verification**: POST /contact with name='ab' returns 422; POST with comment of 5001 chars returns 422.

#### UX5-S5

- **Requirement**: A honeypot field MUST exist and any submission with it populated MUST be silently rejected.
- **Verification**: POST /contact with contact[website]='spam' returns 422 and no email is delivered.

#### UX5-S6

- **Requirement**: No inline onclick= handlers MAY exist in app/views/layouts/.
- **Verification**: grep -rE 'onclick=' app/views/layouts/ returns 0 matches.

#### UX5-S7

- **Requirement**: The submit button MUST NOT carry a value= attribute (button text is the inner text).
- **Verification**: grep -E "button.*value=" app/views/layouts/ returns 0 matches.
