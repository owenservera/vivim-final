# Validated form object for the contact endpoint. Replaces the raw
# params[:contact] hand-off that was flagged in SEC-04.
require 'mail'

class ContactForm
  include ActiveModel::Model

  attr_accessor :name, :email, :phone, :comment, :honeypot

  validates :name,    presence: true, length: { maximum: 80 }
  validates :email,   presence: true, length: { maximum: 254 }, format: { with: /\A[^@\s]+@[^@\s]+\z/ }
  validates :phone,   length: { maximum: 30 }, allow_blank: true
  validates :comment, presence: true, length: { maximum: 2000 }
  validates :honeypot, absence: true  # bots fill this; humans don't see it

  validate  :email_is_valid_smtp_address

  def sanitized
    {
      name:    name.to_s.strip,
      email:   email.to_s.strip.downcase,
      phone:   phone.to_s.strip,
      comment: comment.to_s.strip,
    }
  end

  private

  def email_is_valid_smtp_address
    return if email.blank?
    Mail::Address.new(email)
  rescue Mail::FieldError
    errors.add(:email, 'is not a valid email address')
  end
end
