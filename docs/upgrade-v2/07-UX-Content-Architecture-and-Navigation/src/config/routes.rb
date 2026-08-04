# UX7-02: promote nav anchors to real routes.
# UX7-04: add /privacy and /terms.
# UX7-05: add /case-studies and /blog.

Rails.application.routes.draw do
  root controller: :index, action: :index

  # Top-level static pages (was in-page anchors before).
  get "about-us",   controller: :index, action: :about_us,   as: :about_us
  get "experts",    controller: :index, action: :experts,    as: :experts
  get "projects",   controller: :index, action: :projects,   as: :projects
  get "clients",    controller: :index, action: :clients,    as: :clients
  get "contact-us", controller: :index, action: :contact_us, as: :contact_us

  # Existing static pages.
  get "mobile",  controller: :index, action: :mobile
  get "why_ror", controller: :index, action: :why_ror

  # UX7-04: legal pages (required for PII collection).
  get "privacy", controller: :legal, action: :privacy, as: :privacy
  get "terms",   controller: :legal, action: :terms,   as: :terms

  # UX7-05: content marketing.
  get "case-studies",          controller: :case_studies, action: :index, as: :case_studies
  get "case-studies/:slug",    controller: :case_studies, action: :show,  as: :case_study
  get "blog",                  controller: :blog, action: :index, as: :blog
  get "blog/:slug",            controller: :blog, action: :show,  as: :blog_post

  # Form + sitemap.
  post :contact, controller: :index, action: :contact
  get "sitemap.xml" => "index#sitemap", format: :xml, as: :sitemap
end
