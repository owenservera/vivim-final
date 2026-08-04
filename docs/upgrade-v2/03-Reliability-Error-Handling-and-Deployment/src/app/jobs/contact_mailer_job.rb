# Background mail delivery - addresses REL-04.
class ContactMailerJob < ApplicationJob
  queue_as :default
  retry_on StandardError, wait: 30.seconds, attempts: 3
  discard_on ActiveJob::DeserializationError

  def perform(form_attributes)
    InfoMailer.contact(form_attributes.symbolize_keys).deliver_now
  end
end
