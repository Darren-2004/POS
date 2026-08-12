import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { prisma } from './db.js';
import { hashPin, verifyPin } from './authHelper.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------------------------------------------------
// HEARTBEAT
// -------------------------------------------------------------
app.get('/api/heartbeat', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// -------------------------------------------------------------
// USERS & AUTHENTICATION
// -------------------------------------------------------------

// Récupérer tous les profils utilisateurs pour l'écran de sélection
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        needsPinReset: true
      },
      orderBy: {
        name: 'asc'
      }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
  }
});

// Authentification
app.post('/api/auth/login', async (req, res) => {
  const { userId, pin } = req.body;
  
  if (!userId || !pin) {
    return res.status(400).json({ error: 'ID utilisateur et code PIN requis' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const isValid = verifyPin(pin, user.pin);
    if (!isValid) {
      return res.status(401).json({ error: 'Code PIN incorrect' });
    }

    res.json({
      id: user.id,
      name: user.name,
      role: user.role,
      needsPinReset: user.needsPinReset
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

// Réinitialisation du code PIN (premier login)
app.post('/api/auth/reset-pin', async (req, res) => {
  const { userId, oldPin, newPin } = req.body;

  if (!userId || !oldPin || !newPin) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }

  if (newPin.length < 4) {
    return res.status(400).json({ error: 'Le nouveau code PIN doit comporter au moins 4 chiffres' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const isValid = verifyPin(oldPin, user.pin);
    if (!isValid) {
      return res.status(401).json({ error: 'Ancien code PIN incorrect' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        pin: hashPin(newPin),
        needsPinReset: false
      }
    });

    res.json({ message: 'Code PIN personnalisé mis à jour avec succès' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la réinitialisation du code PIN' });
  }
});

// Créer une caissière (Admin requis)
app.post('/api/users', async (req, res) => {
  const { name } = req.body;

  if (!name) return res.status(400).json({ error: 'Nom requis' });

  try {
    const existing = await prisma.user.findUnique({ where: { name } });
    if (existing) return res.status(400).json({ error: 'Un utilisateur avec ce nom existe déjà' });

    const newUser = await prisma.user.create({
      data: {
        name,
        pin: hashPin('0000'),
        role: 'CASHIER',
        needsPinReset: true
      },
      select: { id: true, name: true, role: true, needsPinReset: true }
    });

    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la création de la caissière' });
  }
});

// Mettre à jour un utilisateur (Admin requis)
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, role } = req.body;

  try {
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(role ? { role } : {})
      },
      select: { id: true, name: true, role: true, needsPinReset: true }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'utilisateur' });
  }
});

// Supprimer un utilisateur (Admin requis)
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (user.role === 'ADMIN') return res.status(400).json({ error: 'Impossible de supprimer un administrateur' });

    await prisma.user.delete({ where: { id } });
    res.json({ message: 'Utilisateur supprimé' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'utilisateur' });
  }
});


// -------------------------------------------------------------
// CATEGORIES
// -------------------------------------------------------------

// Récupérer toutes les catégories
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des catégories' });
  }
});

// Ajouter une catégorie (plus d'admin PIN requis)
app.post('/api/categories', async (req, res) => {
  const { name, color } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nom requis' });
  }

  try {
    const newCategory = await prisma.category.create({
      data: {
        name,
        color: color || 'bg-blue-500'
      }
    });

    res.status(201).json(newCategory);
  } catch (error) {
    // Gestion d'erreur pour doublon unique (Prisma P2002)
    if (error?.code === 'P2002') {
      return res.status(400).json({ error: 'Le nom de catégorie est déjà utilisé' });
    }
    console.error('Create category error', error);
    res.status(500).json({ error: 'Erreur lors de la création de la catégorie' });
  }
});

// Supprimer une catégorie (Admin requis)
app.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.category.delete({ where: { id } });
    res.json({ message: 'Catégorie supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la suppression de la catégorie' });
  }
});

// Mettre à jour une catégorie (sans auth)
app.put('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body;

  try {
    if (!name && !color) return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    const updated = await prisma.category.update({ where: { id }, data: { ...(name ? { name } : {}), ...(color ? { color } : {}) } });
    res.json(updated);
  } catch (error) {
    if (error?.code === 'P2002') return res.status(400).json({ error: 'Le nom de catégorie est déjà utilisé' });
    console.error('Update category error', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la catégorie' });
  }
});


// -------------------------------------------------------------
// INVOICES (FACTURES)
// -------------------------------------------------------------

// Liste des factures avec filtres
app.get('/api/invoices', async (req, res) => {
  const { date, cashierId, status } = req.query;

  let where = {};

  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    where.createdAt = {
      gte: start,
      lte: end
    };
  }

  if (cashierId) {
    where.createdById = cashierId;
  }

  if (status) {
    where.status = status;
  }

  try {
    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        createdBy: {
          select: { name: true }
        },
        cancelledBy: {
          select: { name: true }
        },
        items: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des factures' });
  }
});

// Créer une facture (Validation de panier)
app.post('/api/invoices', async (req, res) => {
  const { totalAmount, paymentMethod, items, createdById } = req.body;

  if (!paymentMethod || !items || !items.length || !createdById) {
    return res.status(400).json({ error: 'Données de la facture incomplètes' });
  }

  try {
    // Utiliser une transaction Prisma pour garantir la concurrence et le format séquentiel sans doublons
    const newInvoice = await prisma.$transaction(async (tx) => {
      // Déterminer la date d'aujourd'hui en heure locale
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      // Compter le nombre de factures générées aujourd'hui pour calculer le numéro de facture séquentiel
      const countToday = await tx.invoice.count({
        where: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      });

      // Formatage du numéro : FAC-YYYYMMDD-XXXX
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const seq = String(countToday + 1).padStart(4, '0');
      const invoiceNumber = `FAC-${year}${month}${day}-${seq}`;

      // Création de la facture et de ses éléments
      return await tx.invoice.create({
        data: {
          invoiceNumber,
          totalAmount: parseFloat(totalAmount),
          paymentMethod,
          createdById,
          items: {
            create: items.map(item => ({
              categoryName: item.categoryName,
              price: parseFloat(item.price)
            }))
          }
        },
        include: {
          items: true,
          createdBy: {
            select: { name: true }
          }
        }
      });
    });

    res.status(201).json(newInvoice);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la validation de la facture' });
  }
});

// Supprimer une facture (Admin action) - no auth required per request
app.delete('/api/invoices/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return res.status(404).json({ error: 'Facture non trouvée' });

    await prisma.invoice.delete({ where: { id } });
    res.json({ message: 'Facture supprimée' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la suppression de la facture' });
  }
});

// Annuler une facture (Admin uniquement)
app.post('/api/invoices/:id/cancel', async (req, res) => {
  const { id } = req.params;
  const { adminId, adminPin, cancellationReason } = req.body;

  if (!adminId || !adminPin || !cancellationReason) {
    return res.status(400).json({ error: 'Veuillez saisir le code PIN administrateur et le motif d\'annulation.' });
  }

  try {
    // Vérification de l'administrateur
    const admin = await prisma.user.findUnique({
      where: { id: adminId }
    });

    if (!admin || admin.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Seul un administrateur peut annuler une facture' });
    }

    const isValidPin = verifyPin(adminPin, admin.pin);
    if (!isValidPin) {
      return res.status(401).json({ error: 'Code PIN administrateur incorrect' });
    }

    // Vérifier l'état actuel de la facture
    const invoice = await prisma.invoice.findUnique({
      where: { id }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Facture non trouvée' });
    }

    if (invoice.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Cette facture est déjà annulée' });
    }

    // Annuler la facture
    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancellationReason,
        cancelledById: admin.id
      },
      include: {
        createdBy: { select: { name: true } },
        cancelledBy: { select: { name: true } },
        items: true
      }
    });

    res.json(updatedInvoice);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l\'annulation de la facture' });
  }
});


// -------------------------------------------------------------
// COMPTABILITÉ & STATISTIQUES (DASHBOARD)
// -------------------------------------------------------------
// Rapport Z pour une date donnée
app.get('/api/z-report', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Date requise' });

  try {
    const start = new Date(date);
    start.setHours(0,0,0,0);
    const end = new Date(date);
    end.setHours(23,59,59,999);

    const invoices = await prisma.invoice.findMany({
      where: {
        status: 'VALIDATED',
        createdAt: { gte: start, lte: end }
      }
    });

    let total = 0;
    let count = invoices.length;
    invoices.forEach(inv => { total += inv.totalAmount; });

    // breakdown by payment method
    const payments = invoices.reduce((acc, inv) => {
      const m = inv.paymentMethod || 'OTHER';
      acc[m] = (acc[m] || 0) + Number(inv.totalAmount || 0);
      return acc;
    }, {});

    res.json({ total, count, payments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la génération du rapport Z' });
  }
});
app.get('/api/stats', async (req, res) => {
  try {
    const now = new Date();

    // -- AUJOURD'HUI --
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    // -- CETTE SEMAINE (Lundi à Dimanche) --
    const startOfWeek = new Date(now);
    const dayOfWeek = startOfWeek.getDay(); // 0 = Dimanche, 1 = Lundi, etc.
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // -- CE MOIS --
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Requêtes factures validées pour statistiques
    const getStatsForRange = async (start, end) => {
      const invoices = await prisma.invoice.findMany({
        where: {
          status: 'VALIDATED',
          createdAt: {
            gte: start,
            lte: end
          }
        }
      });

      let total = 0;
      let cash = 0;
      let online = 0;
      let count = invoices.length;

      invoices.forEach(inv => {
        total += inv.totalAmount;
        if (inv.paymentMethod === 'CASH') {
          cash += inv.totalAmount;
        } else {
          online += inv.totalAmount;
        }
      });

      return { total, cash, online, count };
    };

    const statsToday = await getStatsForRange(startOfToday, endOfToday);
    const statsWeek = await getStatsForRange(startOfWeek, endOfWeek);
    const statsMonth = await getStatsForRange(startOfMonth, endOfMonth);

    // -- MEILLEURES VENTES (AUJOURD'HUI) --
    // Liste de tous les items vendus aujourd'hui dans des factures VALIDÉES
    const itemsToday = await prisma.invoiceItem.findMany({
      where: {
        invoice: {
          status: 'VALIDATED',
          createdAt: {
            gte: startOfToday,
            lte: endOfToday
          }
        }
      }
    });

    const categoryStats = {};
    itemsToday.forEach(item => {
      if (!categoryStats[item.categoryName]) {
        categoryStats[item.categoryName] = { quantity: 0, revenue: 0 };
      }
      categoryStats[item.categoryName].quantity += 1;
      categoryStats[item.categoryName].revenue += item.price;
    });

    const topSellingCategories = Object.keys(categoryStats).map(catName => ({
      name: catName,
      quantity: categoryStats[catName].quantity,
      revenue: categoryStats[catName].revenue
    })).sort((a, b) => b.revenue - a.revenue);

    res.json({
      today: statsToday,
      week: statsWeek,
      month: statsMonth,
      topSelling: topSellingCategories
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la génération des statistiques' });
  }
});


// -------------------------------------------------------------
// SERVIR L'APPLICATION FRONTEND STATIQUE
// -------------------------------------------------------------
// Endpoint de réception des jobs d'impression (demo)
app.post('/api/print', async (req, res) => {
  try {
    const { html } = req.body || {};
    if (!html) return res.status(400).json({ error: 'No html provided' });

    const outDir = path.join(__dirname, 'print_jobs');
    await fs.mkdir(outDir, { recursive: true });
    const filename = `print_${Date.now()}.html`;
    const outPath = path.join(outDir, filename);
    await fs.writeFile(outPath, html, 'utf8');

    console.log('Saved print job to', outPath);
    // Ici on pourrait appeler un utilitaire natif pour envoyer vers l'imprimante POS
    res.json({ ok: true, path: `/print_jobs/${filename}` });
  } catch (err) {
    console.error('Print endpoint error', err);
    res.status(500).json({ error: 'Failed to enqueue print job' });
  }
});
// Servir les fichiers statiques générés par Vite
app.use(express.static(path.join(__dirname, 'frontend/dist')));

// Redirection globale vers le client web pour gérer le routing côté client
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

// Démarrage du serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`================================================`);
  console.log(`SERVEUR LOCAL DE CAISSE DÉMARRÉ`);
  console.log(`URL local Admin (ce PC) : http://localhost:${PORT}`);
  console.log(`Pour connecter les Caissières, utilisez l'adresse IP`);
  console.log(`locale de ce PC, par exemple : http://192.168.1.X:${PORT}`);
  console.log(`================================================`);
});
