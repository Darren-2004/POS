import { prisma } from './db.js';

async function resetDatabase() {
  console.log('================================================');
  console.log('🧹 VIDAGE COMPLET (TOTAL) DE LA BASE DE DONNÉES');
  console.log('================================================');

  try {
    const deletedItems = await prisma.invoiceItem.deleteMany();
    console.log(`✓ ${deletedItems.count} article(s) de facture supprimé(s).`);

    const deletedInvoices = await prisma.invoice.deleteMany();
    console.log(`✓ ${deletedInvoices.count} facture(s) supprimée(s).`);

    const deletedResPayments = await prisma.reservationPayment.deleteMany();
    console.log(`✓ ${deletedResPayments.count} acompte(s) de réservation supprimé(s).`);

    const deletedResItems = await prisma.reservationItem.deleteMany();
    console.log(`✓ ${deletedResItems.count} article(s) de réservation supprimé(s).`);

    const deletedReservations = await prisma.reservation.deleteMany();
    console.log(`✓ ${deletedReservations.count} réservation(s) supprimée(s).`);

    const deletedSubCats = await prisma.subCategory.deleteMany();
    console.log(`✓ ${deletedSubCats.count} sous-catégorie(s) supprimée(s).`);

    const deletedCats = await prisma.category.deleteMany();
    console.log(`✓ ${deletedCats.count} catégorie(s) supprimée(s).`);

    const deletedUsers = await prisma.user.deleteMany();
    console.log(`✓ ${deletedUsers.count} utilisateur(s) supprimé(s).`);

    console.log('================================================');
    console.log('✅ BASE DE DONNÉES TOTALEMENT VIDÉE !');
    console.log('Aucun utilisateur, aucune vente et aucune catégorie ne reste.');
    console.log('Vous pouvez maintenant lancer : node init-admin.js "NomAdmin" "PIN"');
    console.log('================================================');
  } catch (error) {
    console.error('❌ Erreur lors du vidage complet :', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();
