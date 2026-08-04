class IndexController < ApplicationController
  def index; end
  def mobile; end
  def why_ror; end

  # SEC-04 fix: validate input, rate-limit (rack-attack), and report
  # errors back to the user instead of silently 500'ing.
  def contact
    @form = ContactForm.new(contact_params)

    if @form.valid?
      begin
        InfoMailer.contact(@form.sanitized).deliver_now
        redirect_to root_path, notice: 'Thanks - we will be in touch within one business day.'
      rescue => e
        Rails.logger.error("contact mailer failed: #{e.class} #{e.message}")
        Sentry.capture_exception(e) if defined?(Sentry)
        redirect_to root_path, alert: 'Sorry, we could not send your message. Please email info@vivim.net directly.'
      end
    else
      redirect_to root_path, alert: @form.errors.full_messages.to_sentence
    end
  end

  def sitemap
    path = Rails.root.join('public', 'sitemaps', 'sitemap.xml')
    # SEC-05 fix: File.read instead of Kernel#open.
    if File.exist?(path)
      render xml: File.read(path)
    else
      render plain: 'Sitemap not found.', status: :not_found
    end
  end

  private

  def contact_params
    params.require(:contact).permit(:name, :email, :phone, :comment, :honeypot)
  end
end
