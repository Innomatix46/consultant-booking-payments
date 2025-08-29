import jwt from 'jsonwebtoken';
import { ApiError } from './errorHandler.js';
import logger from '../utils/logger.js';

const authMiddleware = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return next(new ApiError(401, 'No token provided, authorization denied'));
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    logger.info('User authenticated', {
      userId: decoded.id,
      email: decoded.email,
      url: req.originalUrl
    });

    next();
  } catch (error) {
    logger.warn('Authentication failed', {
      error: error.message,
      url: req.originalUrl,
      ip: req.ip
    });

    if (error.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Token expired, please login again'));
    }

    if (error.name === 'JsonWebTokenError') {
      return next(new ApiError(401, 'Invalid token, authorization denied'));
    }

    return next(new ApiError(401, 'Token verification failed'));
  }
};

export default authMiddleware;