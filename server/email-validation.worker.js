import { parentPort, workerData } from 'worker_threads';
import { validateEmail } from './routes.js';

async function processEmail() {
  try {
    const { email, clientIp } = workerData;
    const result = await validateEmail(email, clientIp);
    parentPort.postMessage({ success: true, result });
  } catch (error) {
    parentPort.postMessage({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}

processEmail();
