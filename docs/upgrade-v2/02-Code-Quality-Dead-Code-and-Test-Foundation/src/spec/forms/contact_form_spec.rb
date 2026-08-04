require 'rails_helper'

RSpec.describe ContactForm do
  it 'rejects an empty email' do
    form = described_class.new(name: 'A', email: '', comment: 'x')
    expect(form).not_to be_valid
    expect(form.errors[:email]).to include("can't be blank")
  end

  it 'rejects an overlong comment' do
    form = described_class.new(name: 'A', email: 'a@b.com', comment: 'x' * 2001)
    expect(form).not_to be_valid
    expect(form.errors[:comment]).to include('is too long (maximum is 2000 characters)')
  end

  it 'flags the honeypot when filled (bot detection)' do
    form = described_class.new(name: 'A', email: 'a@b.com', comment: 'x', honeypot: 'spam')
    expect(form).not_to be_valid
  end

  it 'sanitizes email to lowercase' do
    form = described_class.new(name: 'A', email: 'A@B.COM', comment: 'x')
    expect(form).to be_valid
    expect(form.sanitized[:email]).to eq('a@b.com')
  end
end
