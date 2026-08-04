# UX5-07: delegated event binding for GA events (replaces inline onclick).
# Reads data-event-category / data-event-action from any element with
# the data attributes and fires a gtag('event', ...) call.

$(document).on 'click', '[data-event-category]', (e) ->
  category = $(this).data('event-category')
  action   = $(this).data('event-action')
  if typeof gtag == 'function'
    gtag('event', action, { event_category: category })
  else if typeof ga == 'function'
    ga('send', 'event', { eventCategory: category, eventAction: action })
