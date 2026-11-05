/** Creation securisee du premier admin : `npm run admin:create -- email Nom MotDePasse`. */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as readline from 'readline';

const url = process.env.DATABASE_URL;
if (!url)
  throw new Error(
    'DATABASE_URL manquante : renseignez .env (voir .env.example).',
  );
const prisma = new PrismaClient({ adapter: new PrismaPg(url) });

function ask(query: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: hidden ? undefined : process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main(): Promise<void> {
  const [, , emailArg, nameArg, passwordArg] = process.argv;
  const email = (emailArg ?? (await ask('E-mail admin : '))).toLowerCase();
  const name = nameArg ?? (await ask('Nom : '));
  const password = passwordArg ?? (await ask('Mot de passe (min 8) : ', true));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    throw new Error('E-mail invalide.');
  if (password.length < 8) throw new Error('Mot de passe trop court.');
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('Cet e-mail est deja utilise.');
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { name: name || 'Admin', email, passwordHash, role: 'ADMIN' },
  });
  console.log(`Administrateur cree : ${email}`);
}

void main()
  .catch((e: unknown) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
