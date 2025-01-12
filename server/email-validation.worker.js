import { parentPort, workerData } from 'worker_threads';
import { validateEmailForWorker } from './email-validation-utils.js';

async function processEmail() {
  try {
    const { email, clientIp } = workerData;
    const result = await validateEmailForWorker(email, clientIp);
    parentPort.postMessage({ success: true, result });
  } catch (error) {
    parentPort.postMessage({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}

processEmail();