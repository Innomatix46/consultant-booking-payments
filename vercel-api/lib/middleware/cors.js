export const corsHandler = (req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://consultant-booking.vercel.app',
    process.env.FRONTEND_URL
  ].filter(Boolean);

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 
    'X-Requested-With,Content-Type,Accept,Authorization,Cache-Control,stripe-signature,x-paystack-signature');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
};

export const withCors = (handler) => {
  return async (req, res) => {
    corsHandler(req, res, () => {});
    return handler(req, res);
  };
};