/**
 * Performance and Load Tests for Payment System
 * Tests system performance under various load conditions
 */

const autocannon = require('autocannon');
const { performance } = require('perf_hooks');
const cluster = require('cluster');
const app = require('../../src/app');
const {
  setupTestDatabase,
  teardownTestDatabase,
  createTestUser,
  generateTestToken,
  measureExecutionTime,
  generateLoadTestData,
} = require('../utils/test-setup');

describe('Payment System Performance Tests', () => {
  let server;
  let testUsers;
  let authTokens;

  beforeAll(async () => {
    await setupTestDatabase();
    server = app.listen(0);
    
    // Create multiple test users for concurrent testing
    testUsers = generateLoadTestData(100, (index) => 
      createTestUser({ email: `testuser${index}@example.com` })
    );
    
    authTokens = testUsers.map(user => generateTestToken({ userId: user._id }));
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    await teardownTestDatabase();
  });

  describe('API Endpoint Performance', () => {
    it('should handle payment intent creation under load', async () => {
      const port = server.address().port;
      const url = `http://localhost:${port}`;

      const result = await autocannon({
        url: `${url}/api/payments/create-intent`,
        connections: 50,
        duration: 30, // 30 seconds
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authTokens[0]}`,
        },
        body: JSON.stringify({
          amount: 5000,
          currency: 'usd',
          description: 'Load test payment',
        }),
      });

      // Performance assertions
      expect(result.errors).toBe(0);
      expect(result['2xx']).toBeGreaterThan(0);
      expect(result.latency.mean).toBeLessThan(200); // Average response time < 200ms
      expect(result.latency.p99).toBeLessThan(1000); // 99th percentile < 1s
      expect(result.requests.mean).toBeGreaterThan(100); // > 100 req/sec average

      console.log('Payment Intent Creation Load Test Results:', {
        totalRequests: result.requests.total,
        avgLatency: result.latency.mean,
        p99Latency: result.latency.p99,
        avgThroughput: result.requests.mean,
        errors: result.errors,
      });
    });

    it('should handle payment confirmation under load', async () => {
      const port = server.address().port;
      const url = `http://localhost:${port}`;

      const result = await autocannon({
        url: `${url}/api/payments/confirm`,
        connections: 30,
        duration: 20,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authTokens[0]}`,
        },
        body: JSON.stringify({
          paymentIntentId: 'pi_test_load_test',
        }),
      });

      expect(result.errors).toBe(0);
      expect(result.latency.mean).toBeLessThan(300);
      expect(result.latency.p99).toBeLessThan(1500);
    });

    it('should handle webhook processing under load', async () => {
      const port = server.address().port;
      const url = `http://localhost:${port}`;

      const webhookPayload = JSON.stringify({
        id: 'evt_test_load',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_webhook_load',
            status: 'succeeded',
            amount: 5000,
            currency: 'usd',
          },
        },
      });

      const result = await autocannon({
        url: `${url}/api/webhooks/stripe`,
        connections: 20,
        duration: 15,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 'test_signature',
        },
        body: webhookPayload,
      });

      expect(result.latency.mean).toBeLessThan(100); // Webhooks should be very fast
      expect(result.requests.mean).toBeGreaterThan(150);
    });
  });

  describe('Concurrent User Testing', () => {
    it('should handle multiple concurrent payment creations', async () => {
      const concurrentOperations = 100;
      const promises = [];

      for (let i = 0; i < concurrentOperations; i++) {
        const operation = async () => {
          const response = await fetch(`http://localhost:${server.address().port}/api/payments/create-intent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authTokens[i % authTokens.length]}`,
            },
            body: JSON.stringify({
              amount: 5000 + (i * 100), // Vary amounts
              currency: 'usd',
              description: `Concurrent test payment ${i}`,
            }),
          });
          return response.json();
        };

        promises.push(measureExecutionTime(operation));
      }

      const results = await Promise.all(promises);
      
      // Analyze results
      const executionTimes = results.map(r => r.executionTime);
      const averageTime = executionTimes.reduce((a, b) => a + b) / executionTimes.length;
      const maxTime = Math.max(...executionTimes);
      const successfulResults = results.filter(r => r.result.success);

      expect(successfulResults.length).toBeGreaterThanOrEqual(90); // 90% success rate
      expect(averageTime).toBeLessThan(500); // Average < 500ms
      expect(maxTime).toBeLessThan(2000); // Max < 2s

      console.log('Concurrent Operations Results:', {
        totalOperations: concurrentOperations,
        successful: successfulResults.length,
        averageTime: averageTime.toFixed(2),
        maxTime: maxTime.toFixed(2),
        successRate: ((successfulResults.length / concurrentOperations) * 100).toFixed(1),
      });
    });

    it('should maintain performance with database connections', async () => {
      const connectionPoolSize = 50;
      const promises = [];

      // Simulate high database load
      for (let i = 0; i < connectionPoolSize; i++) {
        const operation = async () => {
          const response = await fetch(`http://localhost:${server.address().port}/api/payments/history`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authTokens[i % authTokens.length]}`,
            },
          });
          return response.json();
        };

        promises.push(measureExecutionTime(operation));
      }

      const results = await Promise.all(promises);
      const executionTimes = results.map(r => r.executionTime);
      const averageTime = executionTimes.reduce((a, b) => a + b) / executionTimes.length;

      expect(averageTime).toBeLessThan(300); // Database queries should be fast
      expect(results.every(r => r.result !== null)).toBe(true);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should maintain stable memory usage under load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many operations
      const operations = 1000;
      for (let i = 0; i < operations; i++) {
        await fetch(`http://localhost:${server.address().port}/api/payments/create-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authTokens[0]}`,
          },
          body: JSON.stringify({
            amount: 5000,
            currency: 'usd',
          }),
        });

        // Force garbage collection periodically
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePerOp = memoryIncrease / operations;

      console.log('Memory Usage Analysis:', {
        initialHeap: (initialMemory.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
        finalHeap: (finalMemory.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
        increase: (memoryIncrease / 1024 / 1024).toFixed(2) + ' MB',
        increasePerOp: (memoryIncreasePerOp / 1024).toFixed(2) + ' KB',
      });

      // Memory shouldn't grow unboundedly
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // < 100MB increase
      expect(memoryIncreasePerOp).toBeLessThan(10 * 1024); // < 10KB per operation
    });

    it('should handle CPU-intensive operations efficiently', async () => {
      const operations = [];
      const startTime = performance.now();
      
      // CPU-intensive signature validation simulation
      for (let i = 0; i < 100; i++) {
        operations.push(
          fetch(`http://localhost:${server.address().port}/api/webhooks/stripe`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'stripe-signature': `test_signature_${i}`,
            },
            body: JSON.stringify({
              id: `evt_cpu_test_${i}`,
              type: 'payment_intent.succeeded',
              data: { object: { id: `pi_cpu_${i}` } },
            }),
          })
        );
      }

      await Promise.all(operations);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      console.log('CPU-Intensive Operations:', {
        operations: operations.length,
        totalTime: totalTime.toFixed(2) + ' ms',
        avgTimePerOp: (totalTime / operations.length).toFixed(2) + ' ms',
      });
    });
  });

  describe('Rate Limiting Performance', () => {
    it('should efficiently handle rate limiting', async () => {
      const port = server.address().port;
      const promises = [];

      // Send requests that will hit rate limits
      for (let i = 0; i < 200; i++) {
        promises.push(
          fetch(`http://localhost:${port}/api/payments/create-intent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authTokens[0]}`, // Same token
            },
            body: JSON.stringify({
              amount: 5000,
              currency: 'usd',
            }),
          })
        );
      }

      const responses = await Promise.all(promises);
      const statusCodes = responses.map(r => r.status);
      const rateLimitedCount = statusCodes.filter(code => code === 429).length;
      const successCount = statusCodes.filter(code => code === 200).length;

      expect(rateLimitedCount).toBeGreaterThan(0); // Rate limiting should kick in
      expect(successCount).toBeGreaterThan(0); // Some should still succeed
      
      console.log('Rate Limiting Performance:', {
        totalRequests: responses.length,
        successful: successCount,
        rateLimited: rateLimitedCount,
        rateLimitPercentage: ((rateLimitedCount / responses.length) * 100).toFixed(1),
      });
    });
  });

  describe('Payment Provider Integration Performance', () => {
    it('should handle Stripe API timeouts gracefully', async () => {
      // Mock slow Stripe responses
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation((url) => {
        if (url.includes('api.stripe.com')) {
          return new Promise(resolve => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: () => Promise.resolve({
                  id: 'pi_timeout_test',
                  status: 'requires_payment_method',
                }),
              });
            }, 2000); // 2 second delay
          });
        }
        return originalFetch(url);
      });

      const startTime = performance.now();
      
      const response = await fetch(`http://localhost:${server.address().port}/api/payments/create-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authTokens[0]}`,
        },
        body: JSON.stringify({
          amount: 5000,
          currency: 'usd',
          provider: 'stripe',
        }),
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(3000); // Should timeout before 3s
      
      global.fetch = originalFetch;
    });

    it('should maintain performance with multiple provider failures', async () => {
      // Mock provider failures
      const mockFailures = jest.fn()
        .mockImplementationOnce(() => Promise.reject(new Error('Stripe timeout')))
        .mockImplementationOnce(() => Promise.reject(new Error('Paystack error')))
        .mockImplementation(() => Promise.resolve({
          id: 'pi_recovered',
          status: 'requires_payment_method',
        }));

      const operations = 50;
      const promises = [];

      for (let i = 0; i < operations; i++) {
        promises.push(
          measureExecutionTime(async () => {
            const response = await fetch(`http://localhost:${server.address().port}/api/payments/create-intent`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authTokens[i % authTokens.length]}`,
              },
              body: JSON.stringify({
                amount: 5000,
                currency: 'usd',
                retry: true, // Enable retry logic
              }),
            });
            return response.json();
          })
        );
      }

      const results = await Promise.all(promises);
      const executionTimes = results.map(r => r.executionTime);
      const averageTime = executionTimes.reduce((a, b) => a + b) / executionTimes.length;

      // Should still perform reasonably well even with failures
      expect(averageTime).toBeLessThan(1000);
      
      console.log('Provider Failure Recovery Performance:', {
        operations,
        averageTime: averageTime.toFixed(2),
        maxTime: Math.max(...executionTimes).toFixed(2),
      });
    });
  });

  describe('Scalability Testing', () => {
    it('should scale with increased concurrent users', async () => {
      const userCounts = [10, 50, 100, 200];
      const results = [];

      for (const userCount of userCounts) {
        const port = server.address().port;
        
        const result = await autocannon({
          url: `http://localhost:${port}/api/payments/create-intent`,
          connections: userCount,
          duration: 10,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authTokens[0]}`,
          },
          body: JSON.stringify({
            amount: 5000,
            currency: 'usd',
          }),
        });

        results.push({
          users: userCount,
          avgLatency: result.latency.mean,
          throughput: result.requests.mean,
          errors: result.errors,
        });
      }

      console.log('Scalability Test Results:', results);

      // Analyze scalability characteristics
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];
        
        // Latency shouldn't increase dramatically
        const latencyIncrease = (curr.avgLatency - prev.avgLatency) / prev.avgLatency;
        expect(latencyIncrease).toBeLessThan(2.0); // < 200% increase
        
        // Should handle more users without errors
        expect(curr.errors).toBe(0);
      }
    });

    it('should maintain data consistency under high concurrency', async () => {
      const concurrentUsers = 100;
      const paymentAmounts = [];
      const promises = [];

      for (let i = 0; i < concurrentUsers; i++) {
        const amount = 1000 + i; // Unique amounts for tracking
        paymentAmounts.push(amount);
        
        promises.push(
          fetch(`http://localhost:${server.address().port}/api/payments/create-intent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authTokens[i % authTokens.length]}`,
            },
            body: JSON.stringify({
              amount,
              currency: 'usd',
              metadata: { testId: `consistency_test_${i}` },
            }),
          }).then(r => r.json())
        );
      }

      const results = await Promise.all(promises);
      const successfulResults = results.filter(r => r.success);
      
      // Verify no duplicate payment intents
      const paymentIds = successfulResults.map(r => r.paymentIntent.id);
      const uniqueIds = [...new Set(paymentIds)];
      
      expect(uniqueIds.length).toBe(paymentIds.length); // No duplicates
      expect(successfulResults.length).toBe(concurrentUsers); // All succeeded
    });
  });

  describe('Database Performance', () => {
    it('should handle large payment history queries efficiently', async () => {
      // Create a large dataset first
      const largeDatasetSize = 1000;
      const insertPromises = [];

      for (let i = 0; i < largeDatasetSize; i++) {
        insertPromises.push(
          fetch(`http://localhost:${server.address().port}/api/payments/create-intent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authTokens[0]}`,
            },
            body: JSON.stringify({
              amount: 5000,
              currency: 'usd',
              metadata: { batchId: 'large_dataset_test' },
            }),
          })
        );
      }

      await Promise.all(insertPromises);

      // Now test query performance
      const { result, executionTime } = await measureExecutionTime(async () => {
        const response = await fetch(`http://localhost:${server.address().port}/api/payments/history`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authTokens[0]}`,
          },
        });
        return response.json();
      });

      expect(executionTime).toBeLessThan(500); // Query should be fast
      expect(result.payments).toBeDefined();
      expect(Array.isArray(result.payments)).toBe(true);
      
      console.log('Large Dataset Query Performance:', {
        datasetSize: largeDatasetSize,
        queryTime: executionTime.toFixed(2) + ' ms',
        resultsReturned: result.payments.length,
      });
    });

    it('should handle complex aggregation queries efficiently', async () => {
      const { result, executionTime } = await measureExecutionTime(async () => {
        const response = await fetch(`http://localhost:${server.address().port}/api/analytics/payment-summary`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authTokens[0]}`,
          },
          query: new URLSearchParams({
            startDate: '2023-01-01',
            endDate: '2023-12-31',
            groupBy: 'currency',
          }),
        });
        return response.json();
      });

      expect(executionTime).toBeLessThan(1000); // Aggregation should complete in < 1s
      expect(result.summary).toBeDefined();
    });
  });
});