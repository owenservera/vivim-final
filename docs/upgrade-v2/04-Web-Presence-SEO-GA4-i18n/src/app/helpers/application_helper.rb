module ApplicationHelper
  def title_phrase
    t('vivim.site.title')
  end

  def meta_description_content
    t('vivim.site.description')
  end

  # JSON-LD structured data for LocalBusiness - addresses WEB-06.
  def local_business_json_ld
    {
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      "name": t('vivim.local_business.name'),
      "image": "https://vivim.net/banner.png",
      "telephone": t('vivim.local_business.phone'),
      "email": t('vivim.local_business.email'),
      "url": t('vivim.local_business.url'),
      "address": {
        "@type": "PostalAddress",
        "streetAddress": t('vivim.local_business.street'),
        "addressLocality": t('vivim.local_business.city'),
        "addressRegion": t('vivim.local_business.state'),
        "postalCode": t('vivim.local_business.zip'),
        "addressCountry": "US",
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": t('vivim.local_business.latitude'),
        "longitude": t('vivim.local_business.longitude'),
      },
      "openingHoursSpecification": [{
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
        "opens": "09:00",
        "closes": "17:00",
      }],
      "sameAs": t('vivim.local_business.same_as'),
    }.to_json
  end
end
