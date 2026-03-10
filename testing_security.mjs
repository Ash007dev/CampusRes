/**
 * Security Testing - Quick Test Script
 * Tests OWASP Top 10 vulnerabilities
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TOKEN = process.env.TEST_TOKEN || '';

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

async function testSQLInjection() {
  console.log('\n🔍 Testing SQL Injection Prevention...');
  
  try {
    const res = await axios.post(`${API_URL}/api/v1/auth/login`, {
      email: "admin' OR '1'='1",
      password: "' OR '1'='1",
    }, { validateStatus: () => true });

    if (res.status === 400 || res.status === 401) {
      console.log('✅ SQL Injection blocked (Status:', res.status, ')');
    } else {
      console.log('❌ SQL Injection might be possible (Status:', res.status, ')');
    }
  } catch (err) {
    console.error('❌ Error testing SQL Injection:', err.message);
  }
}

async function testXSSPrevention() {
  console.log('\n🔍 Testing XSS Prevention...');
  
  try {
    const res = await axios.post(`${API_URL}/api/v1/bookings`, 
      {
        roomId: 'room-001',
        startTime: new Date(Date.now() + 86400000).toISOString(),
        endTime: new Date(Date.now() + 90000000).toISOString(),
        purpose: '<script>alert("XSS")</script>',
      },
      { headers, validateStatus: () => true }
    );

    if (res.status === 201 && !res.data.data.purpose.includes('<script>')) {
      console.log('✅ XSS payload sanitized');
    } else if ([400, 403, 404].includes(res.status)) {
      console.log('✅ XSS request blocked (Status:', res.status, ')');
    } else {
      console.log('⚠️  Unexpected response (Status:', res.status, ')');
    }
  } catch (err) {
    console.error('❌ Error testing XSS:', err.message);
  }
}

async function testAuthBypass() {
  console.log('\n🔍 Testing Authentication Bypass...');
  
  try {
    const res = await axios.get(`${API_URL}/api/v1/admin/users`, 
      { validateStatus: () => true }
    );

    if (res.status === 401) {
      console.log('✅ Unauthorized access blocked (Status:', res.status, ')');
    } else {
      console.log('❌ Potentially vulnerable to auth bypass (Status:', res.status, ')');
    }
  } catch (err) {
    console.error('❌ Error testing auth:', err.message);
  }
}

async function testRateLimiting() {
  console.log('\n🔍 Testing Rate Limiting...');
  
  try {
    const requests = Array(15).fill(null).map(() =>
      axios.post(`${API_URL}/api/v1/auth/login`, 
        { email: 'test@test.com', password: 'wrong' },
        { validateStatus: () => true }
      )
    );

    const results = await Promise.all(requests);
    const rateLimited = results.filter(r => r.status === 429);

    if (rateLimited.length > 0) {
      console.log(`✅ Rate limiting active (${rateLimited.length} requests blocked)`);
    } else {
      console.log('⚠️  No rate limiting detected');
    }
  } catch (err) {
    console.error('❌ Error testing rate limiting:', err.message);
  }
}

async function testDataExposure() {
  console.log('\n🔍 Testing Data Exposure Prevention...');
  
  try {
    const res = await axios.get(`${API_URL}/api/v1/users/list`, 
      { headers, validateStatus: () => true }
    );

    if (res.status === 200) {
      const hasPassword = res.data.data?.some(u => 'password' in u || 'passwordHash' in u);
      if (hasPassword) {
        console.log('❌ Sensitive data exposed in response');
      } else {
        console.log('✅ Sensitive data not exposed');
      }
    }
  } catch (err) {
    console.error('❌ Error testing data exposure:', err.message);
  }
}

async function runSecurityTests() {
  console.log('========================================');
  console.log('  Security Testing Suite');
  console.log('========================================');
  
  await testSQLInjection();
  await testXSSPrevention();
  await testAuthBypass();
  await testRateLimiting();
  await testDataExposure();
  
  console.log('\n========================================');
  console.log('  Security Testing Complete');
  console.log('========================================\n');
}

runSecurityTests().catch(console.error);