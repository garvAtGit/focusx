import { PrismaClient } from "@prisma/client";
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

// Initialize Prisma
const prisma = new PrismaClient();

// Initialize Firebase
if (getApps().length === 0) {
  let credential = undefined;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    credential = cert(serviceAccount);
  }
  
  initializeApp({
    credential,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const adminAuth = getAuth();

async function main() {
  try {
    const usersToFix = await prisma.user.findMany({
      where: {
        authId: { not: null },
        OR: [
          { phone: null },
          { phone: "" }
        ]
      }
    });

    console.log(`Found ${usersToFix.length} users with authId but missing phone.`);

    let fixedCount = 0;
    for (const user of usersToFix) {
      if (!user.authId) continue;
      try {
        const firebaseUser = await adminAuth.getUser(user.authId);
        if (firebaseUser.phoneNumber) {
          const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { phone: firebaseUser.phoneNumber }
          });
          console.log(`Fixed user ${user.id} (${user.name}) -> ${updatedUser.phone}`);
          fixedCount++;
        } else {
          console.log(`User ${user.id} (${user.name}) does not have a phone number in Firebase either.`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error processing user ${user.id} (authId: ${user.authId}):`, message);
      }
    }
    console.log(`Successfully fixed ${fixedCount} out of ${usersToFix.length} users.`);
  } catch (error) {
    console.error("Script failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
