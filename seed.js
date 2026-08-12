import { prisma } from './db.js';
import { hashPin } from './authHelper.js';

async function main() {
  console.log('Début du peuplement de la base de données...');

  // 1. Création des utilisateurs
  const adminExists = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  });

  if (!adminExists) {
    await prisma.user.create({
      data: {
        name: 'Administrateur',
        pin: hashPin('1234'),
        role: 'ADMIN',
        needsPinReset: false
      }
    });
    console.log('✓ Utilisateur Administrateur créé (PIN par défaut: 1234)');
  }

  const cashierExists = await prisma.user.findFirst({
    where: { name: 'Caissière 1' }
  });

  if (!cashierExists) {
    await prisma.user.create({
      data: {
        name: 'Caissière 1',
        pin: hashPin('0000'),
        role: 'CASHIER',
        needsPinReset: true
      }
    });
    console.log('✓ Utilisateur Caissière 1 créé (PIN par défaut: 0000, réinitialisation requise)');
  }

  // 2. Création des catégories par défaut
  const defaultCategories = [
    { name: 'Chaussure Homme', color: 'bg-blue-500' },
    { name: 'Sac Femme', color: 'bg-rose-500' },
    { name: 'Robe', color: 'bg-purple-500' },
    { name: 'Pantalon', color: 'bg-emerald-500' },
    { name: 'T-Shirt', color: 'bg-amber-500' },
    { name: 'Accessoires', color: 'bg-indigo-500' }
  ];

  for (const cat of defaultCategories) {
    const catExists = await prisma.category.findUnique({
      where: { name: cat.name }
    });

    if (!catExists) {
      await prisma.category.create({
        data: cat
      });
      console.log(`✓ Catégorie créée: ${cat.name}`);
    }
  }

  console.log('Peuplement terminé avec succès !');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
