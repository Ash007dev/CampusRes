/**
 * =============================================================================
 * Campus Resource Engine - Swagger/OpenAPI Configuration
 * =============================================================================
 * Auto-generated API documentation at /api-docs
 * =============================================================================
 */

import { Application } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/index.js';

/**
 * Swagger options
 */
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Campus Resource Engine API',
      version: '1.0.0',
      description: `
## Intelligent Campus Resource Reservation System

Production-grade API for managing campus room bookings with:
- **Race-condition prevention** via PostgreSQL EXCLUDE constraints
- **Role-based access control** (Student, Faculty, Lab_Admin, Admin)
- **Weekly quota enforcement** with dynamic pricing
- **Ghost Killer** automated no-show handling
- **Real-time updates** via Socket.io

### Authentication
All protected endpoints require a JWT token in the Authorization header:
\`\`\`
Authorization: Bearer <token>
\`\`\`

### Rate Limiting
- Standard endpoints: 100 requests/minute
- Auth endpoints: 5 requests/minute
- Booking creation: 10 requests/minute
      `,
      contact: {
        name: 'API Support',
        email: 'support@campus.edu',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}/api/${config.apiVersion}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        CreateUser: {
          type: 'object',
          required: ['email', 'password', 'firstName', 'lastName', 'departmentId'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            departmentId: { type: 'string' },
            role: { type: 'string', enum: ['STUDENT', 'FACULTY', 'LAB_ADMIN', 'ADMIN'] },
          },
        },
        Login: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        CreateBooking: {
          type: 'object',
          required: ['roomId', 'startTime', 'endTime'],
          properties: {
            roomId: { type: 'string' },
            startTime: { type: 'string', format: 'date-time' },
            endTime: { type: 'string', format: 'date-time' },
            title: { type: 'string' },
            description: { type: 'string' },
            attendeeCount: { type: 'integer', minimum: 1 },
          },
        },
        CreateRoom: {
          type: 'object',
          required: ['name', 'code', 'capacity', 'departmentId'],
          properties: {
            name: { type: 'string' },
            code: { type: 'string' },
            description: { type: 'string' },
            capacity: { type: 'integer', minimum: 1 },
            floor: { type: 'integer' },
            building: { type: 'string' },
            roomType: { type: 'string', enum: ['classroom', 'lab', 'auditorium', 'meeting_room', 'conference_hall'] },
            departmentId: { type: 'string' },
            amenities: {
              type: 'object',
              properties: {
                projector: { type: 'boolean' },
                ac: { type: 'boolean' },
                whiteboard: { type: 'boolean' },
                videoConference: { type: 'boolean' },
              },
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                code: { type: 'string' },
                details: { type: 'object' },
              },
            },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Bookings', description: 'Booking management' },
      { name: 'Rooms', description: 'Room management' },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

/**
 * Setup Swagger documentation
 */
export function setupSwagger(app: Application): void {
  const swaggerSpec = swaggerJsdoc(swaggerOptions);
  
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Campus Resource Engine API Docs',
  }));
  
  // Serve raw OpenAPI spec
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}
