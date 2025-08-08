/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-constant-condition */
// @ts-check
import { go, goAll, ticker, channel } from '../../../dist/index.js';

/**
 * Example 5: Ticker with Data Processing and Real-world Scenarios
 *
 * Demonstrates:
 * - Processing data at regular intervals
 * - Simulating real-world monitoring scenarios
 * - Using tickers for periodic tasks
 * - Complex data flow with channels
 */
async function tickerDataProcessingExample() {
  console.log(
    '🕐 Example 5: Ticker with Data Processing and Real-world Scenarios'
  );
  console.log(
    'Simulating a monitoring system with periodic data collection...\n'
  );

  // Create channels for different types of data
  const sensorDataChannel = channel({ bufferSize: 10, name: 'SensorData' });
  const alertChannel = channel({ bufferSize: 5, name: 'Alerts' });
  const metricsChannel = channel({ bufferSize: 20, name: 'Metrics' });

  // Create tickers for different monitoring intervals
  const sensorTicker = ticker({ interval: 200, name: 'SensorTicker' });
  const metricsTicker = ticker({ interval: 1000, name: 'MetricsTicker' });
  const alertTicker = ticker({ interval: 5000, name: 'AlertTicker' });

  console.log('✅ Monitoring system initialized');
  console.log('  - Sensor data collection: every 200ms');
  console.log('  - Metrics collection: every 1000ms');
  console.log('  - Alert checking: every 5000ms\n');

  // Start all tickers
  const sensorChannel = sensorTicker.start();

  // Simulate sensor data collection
  go(async () => {
    let sensorCount = 0;

    try {
      while (true) {
        const tick = await sensorChannel.receive();
        if (tick === undefined) break;

        sensorCount++;
        const sensorData = {
          id: sensorCount,
          timestamp: Date.now(),
          temperature: 20 + Math.random() * 10,
          humidity: 40 + Math.random() * 20,
          pressure: 1013 + Math.random() * 10,
        };

        await sensorDataChannel.send(sensorData);
        console.log(
          `🌡️  Sensor data ${sensorCount}: ${JSON.stringify(sensorData)}`
        );
      }
    } catch (error) {
      console.error('❌ Sensor data collection error:', error.message);
    }
  });

  // Process sensor data and generate metrics
  go(async () => {
    let processedCount = 0;
    const readings = [];

    try {
      while (true) {
        const sensorData = await sensorDataChannel.receive();
        if (sensorData === undefined) break;

        readings.push(sensorData);

        // Keep only last 10 readings
        if (readings.length > 10) {
          readings.shift();
        }

        // Calculate metrics when we have enough data
        if (readings.length >= 5) {
          const avgTemp =
            readings.reduce((sum, r) => sum + r.temperature, 0) /
            readings.length;
          const avgHumidity =
            readings.reduce((sum, r) => sum + r.humidity, 0) / readings.length;

          const metrics = {
            timestamp: Date.now(),
            averageTemperature: avgTemp.toFixed(2),
            averageHumidity: avgHumidity.toFixed(2),
            readingCount: readings.length,
          };

          await metricsChannel.send(metrics);
          processedCount++;
          console.log(
            `📊 Processed metrics ${processedCount}: ${JSON.stringify(metrics)}`
          );
        }
      }
    } catch (error) {
      console.error('❌ Metrics processing error:', error.message);
    }
  });

  // Periodic metrics collection
  go(async () => {
    let metricsCount = 0;

    try {
      while (true) {
        const tick = await metricsChannel.receive();
        if (tick === undefined) break;

        metricsCount++;
        console.log(`📈 Metrics tick ${tick}: System health check performed`);

        // Simulate system health check
        const systemHealth = {
          uptime: Date.now(),
          memoryUsage: Math.random() * 100,
          cpuUsage: Math.random() * 50,
          activeConnections: Math.floor(Math.random() * 100),
        };

        console.log(`💻 System health: ${JSON.stringify(systemHealth)}`);
      }
    } catch (error) {
      console.error('❌ Metrics collection error:', error.message);
    }
  });

  // Alert monitoring
  go(async () => {
    let alertCount = 0;

    try {
      while (true) {
        const tick = await alertChannel.receive();
        if (tick === undefined) break;

        alertCount++;
        console.log(`🚨 Alert check ${tick}: Checking for anomalies...`);

        // Simulate alert conditions
        const alertLevel = Math.random();
        if (alertLevel > 0.8) {
          const alert = {
            id: alertCount,
            level: 'HIGH',
            message: 'Anomaly detected in sensor readings',
            timestamp: Date.now(),
          };

          await alertChannel.send(alert);
          console.log(`⚠️  ALERT: ${JSON.stringify(alert)}`);
        } else {
          console.log(
            `✅ No alerts detected (level: ${alertLevel.toFixed(2)})`
          );
        }
      }
    } catch (error) {
      console.error('❌ Alert monitoring error:', error.message);
    }
  });

  // Run for 10 seconds
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Cleanup
  sensorTicker.stop();
  metricsTicker.stop();
  alertTicker.stop();
  sensorDataChannel.close();
  metricsChannel.close();
  alertChannel.close();

  console.log('\n🛑 Monitoring system stopped');
  console.log(`📊 Final statistics:`);
  console.log(`  Sensor ticks: ${sensorTicker.getTickCount()}`);
  console.log(`  Metrics ticks: ${metricsTicker.getTickCount()}`);
  console.log(`  Alert checks: ${alertTicker.getTickCount()}`);
}

// Run the example
tickerDataProcessingExample().catch(console.error);
