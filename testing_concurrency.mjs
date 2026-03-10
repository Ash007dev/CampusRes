/**
 * Concurrency Testing - Quick Test Script
 * Tests simultaneous requests and race conditions
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TOKEN = process.env.TEST_TOKEN || '';

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

async function testConcurrentLogins() {
  console.log('\n🔐 Testing Concurrent Login Attempts...');
  
  try {
    const promises = Array(10).fill(null).map(() =>
      axios.post(`${API_URL}/api/v1/auth/login`, 
        {
          email: 'admin@test.com',
          password: 'AdminPass123!',
        },
        { validateStatus: () => true }
      )
    );

    const results = await Promise.all(promises);
    const successful = results.filter(r => r.status === 200).length;
    const rateLimited = results.filter(r => r.status === 429).length;

    console.log(`✅ Concurrent logins: ${successful} successful, ${rateLimited} rate-limited`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

async function testConcurrentRoomRequests() {
  console.log('\n🏢 Testing Concurrent Room Requests...');
  
  try {
    const promises = Array(15).fill(null).map(() =>
      axios.get(`${API_URL}/api/v1/rooms`, 
        { headers, validateStatus: () => true }
      )
    );

    const results = await Promise.all(promises);
    const successful = results.filter(r => r.status === 200).length;

    console.log(`✅ Successful concurrent requests: ${successful}/15`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

async function testConcurrentBookings() {
  console.log('\n📅 Testing Concurrent Booking Attempts...');
  
  try {
    const baseTime = Date.now() + 86400000 * 30;
    const startTime = new Date(baseTime).toISOString();
    const endTime = new Date(baseTime + 3600000).toISOString();

    const promises = Array(5).fill(null).map(() =>
      axios.post(`${API_URL}/api/v1/bookings`, 
        {
          roomId: 'room-001',
          startTime,
          endTime,
          purpose: 'Concurrent test',
        },
        { headers, validateStatus: () => true }
      )
    );

    const results = await Promise.all(promises);
    const successful = results.filter(r => r.status === 201).length;
    const conflicts = results.filter(r => r.status === 409).length;

    console.log(`✅ Concurrent bookings: ${successful} created, ${conflicts} conflicts (expected)`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

async function testConnectionPoolStress() {
  console.log('\n🔌 Testing Connection Pool Under Load...');
  
  try {
    const rounds = 50;
    let successful = 0;

    for (let i = 0; i < rounds; i++) {
      try {
        const res = await axios.get(`${API_URL}/api/v1/rooms?limit=10`,
          { headers, validateStatus: () => true, timeout: 5000 }
        );
        if (res.status === 200) successful++;
      } catch (err) {
        // timeout or error
      }
    }

    const percentage = Math.round((successful / rounds) * 100);
    console.log(`✅ Connection pool test: ${percentage}% success rate (${successful}/${rounds})`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

async function testMixedOperations() {
  console.log('\n🔀 Testing Mixed Concurrent Operations...');
  
  try {
    const operations = [
      axios.get(`${API_URL}/api/v1/rooms`, { headers, validateStatus: () => true }),
      axios.get(`${API_URL}/api/v1/bookings/my`, { headers, validateStatus: () => true }),
      axios.get(`${API_URL}/api/v1/users/profile`, { headers, validateStatus: () => true }),
      axios.post(`${API_URL}/api/v1/auth/login`, 
        { email: 'admin@test.com', password: 'AdminPass123!' },
        { validateStatus: () => true }
      ),
    ];

    // Repeat the operations
    const allOps = Array(10).fill(null).flatMap(() => operations);
    const results = await Promise.all(allOps);
    
    const successful = results.filter(r => [200, 201].includes(r.status)).length;
    console.log(`✅ Mixed operations: ${successful}/${results.length} successful`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

async function runConcurrencyTests() {
  console.log('========================================');
  console.log('  Concurrency Testing Suite');
  console.log('========================================');
  
  await testConcurrentLogins();
  await testConcurrentRoomRequests();
  await testConcurrentBookings();
  await testConnectionPoolStress();
  await testMixedOperations();
  
  console.log('\n========================================');
  console.log('  Concurrency Testing Complete');
  console.log('========================================\n');
}

runConcurrencyTests().catch(console.error);