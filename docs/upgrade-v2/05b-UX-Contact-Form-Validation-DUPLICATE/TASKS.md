# Task list

Tasks are ordered by dependency within the package. Effort estimates
use T-shirt sizes (S = half day, M = 1-3 days, L = 3+ days).

#### [UX5-T01] Add flash[:notice]/flash[:alert] to contact action  (_effort: S_)

- **Acceptance**: Submit a valid form -> see green notice; submit an invalid form -> see red alert. Both disappear on next page load.

#### [UX5-T02] Add accessible <label> elements above each form field  (_effort: S_)

- **Acceptance**: axe-core audit passes 0 issues on the contact form; VoiceOver announces each field by label.

#### [UX5-T03] Add client-side maxlength + pattern validation  (_effort: S_)

- **Acceptance**: Tab through the form in Chrome - invalid fields show native browser validation message.

#### [UX5-T04] Add server-side ContactForm validation with length caps  (_effort: M_)

- **Acceptance**: POST /contact with a 10000-char comment returns 422 and an alert; comment is truncated server-side.

#### [UX5-T05] Add honeypot field and rack-attack rate limit  (_effort: M_)

- **Acceptance**: POST /contact with website field populated returns 422 silently; 6th POST from same IP in 1 hour returns 429.

#### [UX5-T06] Add aria-live status region to contact section  (_effort: S_)

- **Acceptance**: NVDA + Firefox announces 'Thanks - we will be in touch' after successful submit without focus moving.

#### [UX5-T07] Replace inline onclick handlers with delegated data-attribute binding  (_effort: S_)

- **Acceptance**: grep 'onclick=' app/views/layouts/ returns 0 matches; clicking phone link still fires the GA event.

#### [UX5-T08] Remove the ignored value='Submit' attribute from the submit button  (_effort: S_)

- **Acceptance**: grep "value='Submit'" app/views/ returns 0 matches.

## Definition of done

A task is done when:

1. Its acceptance criterion is met on a clean checkout.
2. The matching spec's verification step passes.
3. The change is covered by a test (new or existing).
4. The CHANGELOG has an entry under `[Unreleased]`.
