export default async function handler(req, res) {
  // Health check endpoint
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'consultation-booking-api',
    version: '1.0.0'
  });
}