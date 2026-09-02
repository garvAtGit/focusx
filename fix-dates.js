const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  "src/app/(student)/library/[id]/LibraryClient.tsx",
  "src/app/admin/edit/[id]/page.tsx",
  "src/app/dashboard/financials/page.tsx",
  "src/app/dashboard/inquiries/InquiriesClient.tsx",
  "src/app/dashboard/page.tsx",
  "src/app/dashboard/queries/QueriesClient.tsx",
  "src/app/dashboard/seats/page.tsx",
  "src/app/dashboard/students/StudentsClient.tsx"
];

function processFile(filePath) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) return;
  let content = fs.readFileSync(fullPath, 'utf8');

  // Check if we need to import formatStandardDate
  if (content.includes('toLocaleDateString()') && !content.includes('formatStandardDate')) {
    const importStatement = `import { formatStandardDate } from "@/lib/date-utils";\n`;
    
    // insert import after 'use client' or other imports
    if (content.includes("'use client'")) {
      content = content.replace("'use client'\n", "'use client'\n" + importStatement);
    } else if (content.includes('"use client"')) {
      content = content.replace('"use client"\n', '"use client"\n' + importStatement);
    } else {
      content = importStatement + content;
    }
  }

  // Common replacements
  content = content.replace(/new Date\((.*?)\)\.toLocaleDateString\(\)/g, 'formatStandardDate($1)');
  content = content.replace(/([a-zA-Z0-9_.]+)\.toLocaleDateString\(\)/g, 'formatStandardDate($1)');

  fs.writeFileSync(fullPath, content, 'utf8');
  console.log('Updated ' + filePath);
}

filesToUpdate.forEach(processFile);
