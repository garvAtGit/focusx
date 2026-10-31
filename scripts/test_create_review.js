require('dotenv').config({ path: '.env.local' });

async function run() {
  const { createLibraryReview, getLibraryReviews } = require('./dist-test-or-src');
}

