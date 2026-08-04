class IndexController < ApplicationController
  def index
  end

  def mobile
  end

  def why_ror
  end

  # UX5-01, UX5-03, UX5-04: real contact handler with validation,
  # honeypot, rate limit, and flash feedback.
  def contact
    unless valid_contact_request?
      flash[:alert] = t('vivim.contact.failure_alert')
      redirect_to root_path(anchor: 'contact') and return
    end

    InfoMailer.contact(contact_form_params).deliver_now
    flash[:notice] = t('vivim.contact.success_notice')
    redirect_to root_path(anchor: 'contact')
  rescue StandardError => e
    Rails.logger.error("Contact form delivery failed: #{e.class}: #{e.message}")
    flash[:alert] = t('vivim.contact.failure_alert')
    redirect_to root_path(anchor: 'contact')
  end

  def sitemap
    path = Rails.root.join("public", "sitemaps", "sitemap.xml")
    if File.exists?(path)
      render xml: File.read(path)
    else
      render plain: "Sitemap not found.", status: :not_found
    end
  end

  private

  # UX5-04: honeypot + basic server-side rate limit (5 / IP / hour).
  def valid_contact_request?
    return false if params[:contact][:website].present? # honeypot
    key = "contact:#{request.remote_ip}"
    count = Rails.cache.read(key, raw: true).to_i
    return false if count >= 5
    Rails.cache.write(key, count + 1, expires_in: 1.hour, raw: true)
    true
  end

  # UX5-03: server-side validation.
  def contact_form_params
    permitted = params.require(:contact).permit(:name, :email, :phone, :comment)
    {
      name:    permitted[:name].to_s.strip.slice(0, 100),
      email:   permitted[:email].to_s.strip.slice(0, 254),
      phone:   permitted[:phone].to_s.strip.slice(0, 32),
      comment: permitted[:comment].to_s.strip.slice(0, 5000),
    }.tap do |h|
      raise ArgumentError, "name too short"   unless h[:name].length >= 3
      raise ArgumentError, "email invalid"    unless h[:email] =~ /\A[^@\s]+@[^@\s]+\.[^@\s]+\z/
      raise ArgumentError, "comment too short" unless h[:comment].length >= 10
    end
  end
end
