
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
    const relays = await prisma.relay.findMany();
    console.log(relays);
}
main().catch(console.error).finally(() => prisma.$disconnect());

