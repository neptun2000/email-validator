import { parentPort, workerData } from 'worker_threads';
import { validateEmailForWorker } from './email-validation-utils.ts';

if (!parentPort) {
  throw new Error('This module must be run as a worker thread');
}

async function processEmail() {
  try {
    const { email, clientIp } = workerData;
    const result = await validateEmailForWorker(email, clientIp);
    parentPort.postMessage({ success: true, result });
  } catch (error) {
    console.error('Worker error:', error);
    parentPort.postMessage({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}

processEmail().catch(error => {
  console.error('Worker processing error:', error);
  if (parentPort) {
    parentPort.postMessage({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});