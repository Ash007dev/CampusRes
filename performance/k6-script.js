import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp-up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(99)<500'],  // 99% of requests under 500ms
    http_req_failed: ['<0.1'],         // Error rate under 0.1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const TOKEN = __ENV.TOKEN || '';

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
  };

  // Test booking listing endpoint
  const listRes = http.get(`${BASE_URL}/api/v1/bookings/my`, params);
  check(listRes, {
    'list bookings status 200': (r) => r.status === 200,
    'list bookings response time < 500ms': (r) => r.timings.duration < 500,
  });

  // Test room listing endpoint
  const roomRes = http.get(`${BASE_URL}/api/v1/rooms`, params);
  check(roomRes, {
    'list rooms status 200': (r) => r.status === 200,
    'rooms response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}