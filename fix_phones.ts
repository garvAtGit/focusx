import prisma from './src/lib/prisma';
async function main() {
  const usersWithEmptyPhone = await prisma.user.findMany({ where: { phone: '' } });
  console.log('Empty phones:', usersWithEmptyPhone.length);
  for (const user of usersWithEmptyPhone) {
    await prisma.user.update({ where: { id: user.id }, data: { phone: null } });
  }
  const allUsers = await prisma.user.findMany({ where: { phone: { not: null } } });
  const phoneMap = new Map();
  let dups = 0;
  for (const user of allUsers) {
    if (user.phone === null) continue;
    if (phoneMap.has(user.phone)) {
      await prisma.user.update({ where: { id: user.id }, data: { phone: user.phone + '_dup_' + user.id.substring(0,4) } });
      dups++;
    } else {
      phoneMap.set(user.phone, true);
    }
  }
  console.log('Fixed dups:', dups);
}
main().catch(console.error);
