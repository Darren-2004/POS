import { prisma } from './db.js';
import { hashPin } from './authHelper.js';

async function initAdmin() {
  const args = process.argv.slice(2);
  const name = args[0] || 'Administrateur';
  const pin = args[1] || '1234';

  console.log('================================================');
  console.log(`👤 CRÉATION / MISE À JOUR DE L'ADMINISTRATEUR`);
  console.log(`Nom: ${name}`);
  console.log(`PIN: ${pin}`);
  console.log('================================================');

  try {
    const existing = await prisma.user.findFirst({
      where: { name: name }
    });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          pin: hashPin(pin),
          role: 'ADMIN',
          needsPinReset: false
        }
      });
      console.log(`✅ Compte Admin '${name}' mis à jour avec le nouveau code PIN.`);
    } else {
      await prisma.user.create({
        data: {
          name: name,
          pin: hashPin(pin),
          role: 'ADMIN',
          needsPinReset: false
        }
      });
      console.log(`✅ Compte Admin '${name}' créé avec succès.`);
    }
  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'admin :', error);
  } finally {
    await prisma.$disconnect();
  }
}

initAdmin();
