import { parentPort, workerData } from 'worker_threads';
import { validateEmailForWorker } from './email-validation-utils.js';

async function validateEmailInWorker() {
  const { email, clientIp } = workerData;
  try {
    const result = await validateEmailForWorker(email, clientIp);
    if (parentPort) {
      parentPort.postMessage({ success: true, result });
    }
  } catch (error) {
    if (parentPort) {
      parentPort.postMessage({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Execute worker
validateEmailInWorker().catch(error => {
  console.error('Worker error:', error);
  if (parentPort) {
    parentPort.postMessage({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});