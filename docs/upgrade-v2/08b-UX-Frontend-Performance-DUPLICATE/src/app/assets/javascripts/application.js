// UX8-01: CoffeeScript -> vanilla ES6+ (was application.js.coffee).
// UX8-02: Turbolinks -> Turbo (was #= require turbolinks).
// UX8-03: jQuery removed - all selectors are native.
// UX8-07: 3 jQuery plugins replaced with 1 vanilla lib (GLightbox) + CSS scroll-snap.

import "@hotwired/turbo-rails";
import GLightbox from "glightbox";
import "glightbox/dist/css/glightbox.min.css";

// UX8-05: native lazy-loading on all carousel images.
document.addEventListener("turbo:load", () => {
  document.querySelectorAll("img").forEach((img) => {
    img.setAttribute("loading", img.getAttribute("loading") || "lazy");
    img.setAttribute("decoding", "async");
  });

  // UX6-06 / UX8-07: GLightbox replaces Colorbox.
  GLightbox({ selector: "a.colorbox", touchNavigation: true, loop: true });

  // UX6-05: carousel respects prefers-reduced-motion (was owl.carousel).
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const carousel = document.querySelector("[data-carousel]");
  if (carousel) {
    if (reducedMotion) {
      carousel.removeAttribute("data-autoplay");
    }
  }
});
