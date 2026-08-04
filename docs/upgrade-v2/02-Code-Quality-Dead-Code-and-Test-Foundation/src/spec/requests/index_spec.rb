require 'rails_helper'

RSpec.describe 'Index routes', type: :request do
  describe 'GET /' do
    it 'returns 200 and shows the about us section' do
      get root_path
      expect(response).to have_http_status(:ok)
      expect(response.body).to include('About Us')
    end
  end

  describe 'GET /mobile' do
    it 'returns 200 and shows the mobile heading' do
      get mobile_path
      expect(response).to have_http_status(:ok)
      expect(response.body).to include('Mobile Development')
    end
  end

  describe 'GET /why_ror' do
    it 'returns 200 and shows the rails heading' do
      get why_ror_path
      expect(response).to have_http_status(:ok)
      expect(response.body).to include('Web Development With Ruby on Rails')
    end
  end

  describe 'POST /contact' do
    it 'rejects an invalid email' do
      post contact_path, params: { contact: { name: 'A', email: 'bad', comment: 'x' } }
      expect(response).to redirect_to(root_path)
      follow_redirect!
      expect(response.body).to include('invalid')
    end

    it 'accepts a valid submission and redirects with a notice' do
      expect {
        post contact_path, params: { contact: { name: 'Alice', email: 'a@b.com', comment: 'Hello' } }
      }.to change { ActionMailer::Base.deliveries.count }.by(1)
      expect(response).to redirect_to(root_path)
      follow_redirect!
      expect(response.body).to include('Thanks')
    end
  end

  describe 'GET /sitemap.xml' do
    it 'returns 404 when no sitemap file exists' do
      allow(File).to receive(:exist?).and_return(false)
      get sitemap_path(format: :xml)
      expect(response).to have_http_status(:not_found)
    end
  end
end
