# Health check endpoint - addresses REL-06.
class HealthController < ApplicationController
  skip_before_action :verify_authenticity_token

  def show
    healthy = database_connected?
    if healthy
      render plain: 'ok', status: :ok
    else
      render plain: 'db disconnected', status: :service_unavailable
    end
  end

  private

  def database_connected?
    ActiveRecord::Base.connection.execute('SELECT 1').present?
  rescue ActiveRecord::ConnectionNotEstablished, PG::Error
    false
  end
end
