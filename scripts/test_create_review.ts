import { getLibraryReviews, createLibraryReview } from "../src/lib/reviews-service";
import prisma from "../src/lib/prisma";

async function main() {
  try {
    console.log("1. Finding a student in FocusX...");
    const student = await prisma.user.findFirst({
      where: { role: "STUDENT" },
      select: { id: true, name: true, profilePhotoUrl: true }
    });

    if (!student) {
      console.error("No student found");
      return;
    }
    console.log("Found student:", student);

    const testLibraryId = "88a1c1b8-a78f-4cb1-a9a0-9f25bbbaa891"; // Gyan Vatika Library

    console.log("\n2. Calling createLibraryReview...");
    const created = await createLibraryReview({
      libraryId: testLibraryId,
      studentId: student.id,
      rating: 5,
      content: "Excellent atmosphere for preparation. Super quiet and clean! Test review.",
      source: "FOCUSX",
      authorName: student.name,
      authorAvatar: student.profilePhotoUrl || undefined
    });
    console.log("Created review result:", created);

    console.log("\n3. Fetching reviews again to verify aggregation...");
    const summary = await getLibraryReviews(testLibraryId);
    console.log("Updated totalReviews:", summary.totalReviews);
    console.log("Updated averageRating:", summary.averageRating);
    console.log("Latest review:", summary.reviews[0]);

    // Cleanup the test review from Prisma Query table
    console.log("\n4. Cleaning up test review...");
    await prisma.query.delete({
      where: { id: created.id }
    });
    console.log("Cleaned up local test review successfully!");

  } catch (err) {
    console.error("Error running test:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();

