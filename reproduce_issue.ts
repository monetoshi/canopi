
import { PrivacyService } from './backend/src/services/privacy.service';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(__dirname, 'backend/.env') });

async function testShield() {
  console.log('--- Starting Privacy Shield Test ---');
  try {
    const service = new PrivacyService();
    // Use a small amount
    await service.shieldFunds(0.01);
  } catch (error: any) {
    console.error('CAUGHT ERROR:', error.message);
    if (error.stack) {
        console.error(error.stack);
    }
  }
}

testShield();
