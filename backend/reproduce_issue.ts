
import { PrivacyService } from './src/services/privacy.service';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config();

async function testShield() {
  console.log('--- Starting Privacy Shield Test ---');
  try {
    const service = new PrivacyService();
    // Use a small amount
    await service.shieldFunds(0.01);
  } catch (error: any) {
    console.error('CAUGHT ERROR:', error.message);
    // console.error(error.stack);
  }
}

testShield();
