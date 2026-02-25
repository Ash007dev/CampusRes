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
- **MFA** with OTP-based two-factor authentication

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
        name: 'Campus Resource Engine Team',
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
        Booking: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            roomId: { type: 'string' },
            startTime: { type: 'string', format: 'date-time' },
            endTime: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['CONFIRMED', 'CANCELLED', 'NO_SHOW', 'COMPLETED'] },
            checkInStatus: { type: 'string', enum: ['PENDING', 'CHECKED_IN', 'LATE', 'MISSED'] },
            title: { type: 'string' },
            creditsCharged: { type: 'number' },
          },
        },
        Room: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            code: { type: 'string' },
            capacity: { type: 'integer' },
            roomType: { type: 'string' },
            building: { type: 'string' },
            floor: { type: 'integer' },
            status: { type: 'string', enum: ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'] },
            amenities: { type: 'object' },
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
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            message: { type: 'string' },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication & user management' },
      { name: 'Bookings', description: 'Room booking operations' },
      { name: 'Rooms', description: 'Room management & availability' },
      { name: 'Admin', description: 'Admin-only operations' },
      { name: 'Config', description: 'System configuration' },
      { name: 'Feedback', description: 'User feedback & ratings' },
      { name: 'Holidays', description: 'Holiday management' },
      { name: 'Waitlist', description: 'Waitlist management' },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const SWAGGER_DARK_CSS = `
  .swagger-ui .topbar { display: none }
  body { background: #1a1a2e; }
  .swagger-ui { background: #1a1a2e; }
  .swagger-ui .info .title { color: #e0e0e0; }
  .swagger-ui .info p, .swagger-ui .info li { color: #c0c0c0; }
  .swagger-ui .opblock-tag { color: #e0e0e0; border-bottom-color: #333; }
  .swagger-ui .opblock-tag:hover { background: rgba(255,255,255,0.05); }
  .swagger-ui .opblock .opblock-summary-description { color: #aaa; }
  .swagger-ui .scheme-container { background: #16213e; box-shadow: none; }
  .swagger-ui .btn { color: #e0e0e0; border-color: #555; }
  .swagger-ui select { background: #16213e; color: #e0e0e0; }
  .swagger-ui .model-title { color: #e0e0e0; }
  .swagger-ui .model { color: #c0c0c0; }
  .swagger-ui table thead tr th { color: #e0e0e0; border-bottom-color: #444; }
  .swagger-ui .parameter__name { color: #e0e0e0; }
  .swagger-ui .parameter__type { color: #aaa; }
  .swagger-ui .response-col_status { color: #e0e0e0; }
  .swagger-ui .response-col_description { color: #c0c0c0; }
`;

/**
 * Setup Swagger documentation
 */
export function setupSwagger(app: Application): void {
  const swaggerSpec = swaggerJsdoc(swaggerOptions);

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: SWAGGER_DARK_CSS,
    customSiteTitle: 'Campus Resource Engine API Docs',
  }));

  // Serve raw OpenAPI spec
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}
