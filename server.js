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

// Helper: given a local date string 'YYYY-MM-DD', return {start, end} as UTC Date objects
// that correspond to midnight→23:59:59 in LOCAL time (accounting for TZ offset).
const localDayRange = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [year, month, day] = parts;
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end   = new Date(year, month - 1, day, 23, 59, 59, 999);
  return { start, end };
};

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
  const { name, pin } = req.body;

  if (!name) return res.status(400).json({ error: 'Nom requis' });

  try {
    const existing = await prisma.user.findUnique({ where: { name } });
    if (existing) return res.status(400).json({ error: 'Un utilisateur avec ce nom existe déjà' });

    const initialPin = pin && String(pin).trim().length >= 4 ? String(pin).trim() : '0000';

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        pin: hashPin(initialPin),
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

// Récupérer toutes les catégories avec leurs sous-catégories
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        subCategories: {
          orderBy: { name: 'asc' }
        }
      },
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
        name: name.trim(),
        color: color || 'bg-blue-500'
      },
      include: {
        subCategories: true
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
    const updated = await prisma.category.update({
      where: { id },
      data: { ...(name ? { name: name.trim() } : {}), ...(color ? { color } : {}) },
      include: { subCategories: true }
    });
    res.json(updated);
  } catch (error) {
    if (error?.code === 'P2002') return res.status(400).json({ error: 'Le nom de catégorie est déjà utilisé' });
    console.error('Update category error', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la catégorie' });
  }
});

// -------------------------------------------------------------
// SUB-CATEGORIES (SOUS-CATÉGORIES)
// -------------------------------------------------------------

// Ajouter une sous-catégorie
app.post('/api/subcategories', async (req, res) => {
  const { name, categoryId } = req.body;

  if (!name || !categoryId) {
    return res.status(400).json({ error: 'Nom et catégorie parent requis' });
  }

  try {
    const newSub = await prisma.subCategory.create({
      data: {
        name: name.trim(),
        categoryId
      }
    });

    res.status(201).json(newSub);
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(400).json({ error: 'Une sous-catégorie avec ce nom existe déjà dans cette catégorie' });
    }
    console.error('Create subcategory error', error);
    res.status(500).json({ error: 'Erreur lors de la création de la sous-catégorie' });
  }
});

// Mettre à jour une sous-catégorie
app.put('/api/subcategories/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name) return res.status(400).json({ error: 'Nom requis' });

  try {
    const updated = await prisma.subCategory.update({
      where: { id },
      data: { name: name.trim() }
    });
    res.json(updated);
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(400).json({ error: 'Une sous-catégorie avec ce nom existe déjà dans cette catégorie' });
    }
    console.error('Update subcategory error', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la sous-catégorie' });
  }
});

// Supprimer une sous-catégorie
app.delete('/api/subcategories/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.subCategory.delete({ where: { id } });
    res.json({ message: 'Sous-catégorie supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la suppression de la sous-catégorie' });
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
    const range = localDayRange(date);
    if (range) {
      where.createdAt = {
        gte: range.start,
        lte: range.end
      };
    }
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
  const { totalAmount, paymentMethod, items, createdById, clientName } = req.body;

  if (!items || !items.length || !createdById) {
    return res.status(400).json({ error: 'Données de la facture incomplètes' });
  }

  const finalPaymentMethod = paymentMethod || 'CASH';

  try {
    // Utiliser une transaction Prisma pour garantir la concurrence et le format séquentiel sans doublons
    const newInvoice = await prisma.$transaction(async (tx) => {
      // Déterminer la date d'aujourd'hui en heure locale
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

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
          paymentMethod: finalPaymentMethod,
          clientName: clientName ? String(clientName).trim() : null,
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

// Supprimer une facture (Requiert le mot de passe / code PIN administrateur)
app.delete('/api/invoices/:id', async (req, res) => {
  const { id } = req.params;
  const adminPin = req.headers['x-admin-pin'] || req.body?.adminPin || req.query?.adminPin;
  const adminId = req.headers['x-admin-id'] || req.body?.adminId || req.query?.adminId;

  if (!adminPin) {
    return res.status(400).json({ error: 'Mot de passe administrateur requis' });
  }

  try {
    let admin = null;
    if (adminId) {
      admin = await prisma.user.findUnique({ where: { id: adminId } });
    } else {
      admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    }

    if (!admin) {
      return res.status(403).json({ error: 'Compte administrateur introuvable' });
    }

    const isValidPin = verifyPin(adminPin, admin.pin);
    if (!isValidPin) {
      return res.status(401).json({ error: 'Mot de passe administrateur incorrect' });
    }

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return res.status(404).json({ error: 'Facture non trouvée' });

    await prisma.invoice.delete({ where: { id } });
    res.json({ message: 'Facture supprimée avec succès' });
  } catch (error) {
    console.error(error);
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
// -------------------------------------------------------------
// RESERVATIONS (RÉSERVATIONS / ACOMPTES EN 3 TRANCHES MAX)
// -------------------------------------------------------------

// Liste des réservations
app.get('/api/reservations', async (req, res) => {
  const { status, q, date, cashierId } = req.query;

  let where = {};

  if (date) {
    const range = localDayRange(date);
    if (range) {
      where.createdAt = { gte: range.start, lte: range.end };
    }
  }

  if (cashierId) {
    where.createdById = cashierId;
  }

  if (status) {
    where.status = status;
  }

  if (q) {
    const search = q.trim();
    where.OR = [
      { clientName: { contains: search } },
      { reservationNo: { contains: search } },
      { clientPhone: { contains: search } }
    ];
  }

  try {
    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
        items: true,
        payments: {
          include: {
            createdBy: { select: { name: true } }
          },
          orderBy: { installmentNumber: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const result = reservations.map(r => {
      const totalPaid = r.payments.reduce((sum, p) => sum + p.amount, 0);
      const remainingBalance = Math.max(0, r.totalAmount - totalPaid);
      return {
        ...r,
        totalPaid,
        remainingBalance
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Fetch reservations error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des réservations' });
  }
});

// Créer la facture définitive d'une réservation soldée à 100%
app.post('/api/reservations/:id/create-invoice', async (req, res) => {
  const { id } = req.params;
  const { createdById } = req.body;

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { items: true, payments: true }
    });

    if (!reservation) return res.status(404).json({ error: 'Réservation non trouvée' });

    // Vérifier si une facture existe déjà pour cette réservation
    const existingInvoice = await prisma.invoice.findFirst({
      where: { reservationNo: reservation.reservationNo },
      include: { items: true, createdBy: { select: { name: true } } }
    });

    if (existingInvoice) {
      return res.json(existingInvoice);
    }

    const lastPaymentMethod = reservation.payments?.[reservation.payments.length - 1]?.paymentMethod || 'CASH';

    const newInvoice = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const countToday = await tx.invoice.count({
        where: { createdAt: { gte: startOfDay, lte: endOfDay } }
      });

      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const seq = String(countToday + 1).padStart(4, '0');
      const invoiceNumber = `FAC-${year}${month}${day}-${seq}`;

      return await tx.invoice.create({
        data: {
          invoiceNumber,
          totalAmount: reservation.totalAmount,
          paymentMethod: lastPaymentMethod,
          clientName: reservation.clientName,
          isReservation: true,
          reservationNo: reservation.reservationNo,
          createdById: createdById || reservation.createdById,
          items: {
            create: reservation.items.map(item => ({
              categoryName: item.categoryName,
              price: item.price
            }))
          }
        },
        include: {
          items: true,
          createdBy: { select: { name: true } }
        }
      });
    });

    res.status(201).json(newInvoice);
  } catch (error) {
    console.error('Create invoice from reservation error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la facture définitive' });
  }
});

// Créer une réservation
app.post('/api/reservations', async (req, res) => {
  const { clientName, clientPhone, totalAmount, items, createdById, initialPayment } = req.body;

  if (!clientName || !items || !items.length || !createdById || !totalAmount) {
    return res.status(400).json({ error: 'Informations de réservation incomplètes' });
  }

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const countToday = await tx.reservation.count({
        where: { createdAt: { gte: startOfDay, lte: endOfDay } }
      });

      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const seq = String(countToday + 1).padStart(4, '0');
      const reservationNo = `RES-${year}${month}${day}-${seq}`;

      const newRes = await tx.reservation.create({
        data: {
          reservationNo,
          clientName: String(clientName).trim(),
          clientPhone: clientPhone ? String(clientPhone).trim() : null,
          totalAmount: parseFloat(totalAmount),
          createdById,
          items: {
            create: items.map(item => ({
              categoryName: item.categoryName,
              price: parseFloat(item.price),
              qty: parseInt(item.qty, 10) || 1
            }))
          }
        }
      });

      if (initialPayment && Number(initialPayment.amount) > 0) {
        const initialPaidAmount = parseFloat(initialPayment.amount);
        await tx.reservationPayment.create({
          data: {
            reservationId: newRes.id,
            amount: initialPaidAmount,
            paymentMethod: initialPayment.paymentMethod || 'CASH',
            installmentNumber: 1,
            createdById
          }
        });

        if (initialPaidAmount >= parseFloat(totalAmount)) {
          await tx.reservation.update({
            where: { id: newRes.id },
            data: { status: 'COMPLETED' }
          });
        }
      }

      return await tx.reservation.findUnique({
        where: { id: newRes.id },
        include: {
          createdBy: { select: { name: true } },
          items: true,
          payments: {
            include: { createdBy: { select: { name: true } } },
            orderBy: { installmentNumber: 'asc' }
          }
        }
      });
    });

    const totalPaid = reservation.payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingBalance = Math.max(0, reservation.totalAmount - totalPaid);

    res.status(201).json({
      ...reservation,
      totalPaid,
      remainingBalance
    });
  } catch (error) {
    console.error('Create reservation error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la réservation' });
  }
});

// Enregistrer une tranche (acompte) pour une réservation
app.post('/api/reservations/:id/payments', async (req, res) => {
  const { id } = req.params;
  const { amount, paymentMethod, createdById } = req.body;

  if (!amount || Number(amount) <= 0 || !createdById) {
    return res.status(400).json({ error: 'Montant et utilisateur requis' });
  }

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { payments: true }
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Réservation non trouvée' });
    }

    if (reservation.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Réservation annulée' });
    }

    if (reservation.payments.length >= 3) {
      return res.status(400).json({ error: 'Le nombre maximum de 3 tranches de paiement a déjà été atteint' });
    }

    const currentTotalPaid = reservation.payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = reservation.totalAmount - currentTotalPaid;

    if (parseFloat(amount) > remaining + 0.01) {
      return res.status(400).json({ error: `Le montant saisi (${amount} FCFA) dépasse le solde restant (${remaining} FCFA)` });
    }

    const nextInstallmentNumber = reservation.payments.length + 1;

    await prisma.reservationPayment.create({
      data: {
        reservationId: id,
        amount: parseFloat(amount),
        paymentMethod: paymentMethod || 'CASH',
        installmentNumber: nextInstallmentNumber,
        createdById
      }
    });

    const newTotalPaid = currentTotalPaid + parseFloat(amount);
    if (newTotalPaid >= reservation.totalAmount - 0.01) {
      await prisma.reservation.update({
        where: { id },
        data: { status: 'COMPLETED' }
      });
    }

    const updated = await prisma.reservation.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true } },
        items: true,
        payments: {
          include: { createdBy: { select: { name: true } } },
          orderBy: { installmentNumber: 'asc' }
        }
      }
    });

    const finalTotalPaid = updated.payments.reduce((sum, p) => sum + p.amount, 0);
    const finalRemaining = Math.max(0, updated.totalAmount - finalTotalPaid);

    res.json({
      ...updated,
      totalPaid: finalTotalPaid,
      remainingBalance: finalRemaining
    });
  } catch (error) {
    console.error('Add payment error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement de la tranche' });
  }
});

// Modifier une réservation (mise à jour des articles / client / ajout d'un acompte)
app.put('/api/reservations/:id', async (req, res) => {
  const { id } = req.params;
  const { clientName, clientPhone, totalAmount, items, createdById, newPayment } = req.body;

  if (!clientName && !clientPhone) {
    return res.status(400).json({ error: 'Le nom du client ou son numéro de téléphone doit être renseigné' });
  }

  try {
    const updatedRes = await prisma.$transaction(async (tx) => {
      const existing = await tx.reservation.findUnique({
        where: { id },
        include: { payments: true }
      });

      if (!existing) {
        throw new Error('NOT_FOUND');
      }

      if (existing.status === 'CANCELLED') {
        throw new Error('CANCELLED');
      }

      // Supprimer les anciens articles et recréer les nouveaux
      await tx.reservationItem.deleteMany({ where: { reservationId: id } });

      const newTotalAmount = parseFloat(totalAmount) || existing.totalAmount;

      await tx.reservation.update({
        where: { id },
        data: {
          clientName: clientName ? String(clientName).trim() : existing.clientName,
          clientPhone: clientPhone ? String(clientPhone).trim() : existing.clientPhone,
          totalAmount: newTotalAmount,
          updatedById: createdById || null,
          items: {
            create: (items || []).map(item => ({
              categoryName: item.categoryName,
              price: parseFloat(item.price),
              qty: parseInt(item.qty, 10) || 1
            }))
          }
        }
      });

      // Si une nouvelle tranche (avance) a été saisie
      if (newPayment && Number(newPayment.amount) > 0) {
        if (existing.payments.length >= 3) {
          throw new Error('MAX_PAYMENTS_REACHED');
        }

        const payAmount = parseFloat(newPayment.amount);
        const currentPaid = existing.payments.reduce((sum, p) => sum + p.amount, 0);
        const remaining = newTotalAmount - currentPaid;

        if (payAmount > remaining + 0.01) {
          throw new Error('EXCEEDS_REMAINING');
        }

        await tx.reservationPayment.create({
          data: {
            reservationId: id,
            amount: payAmount,
            paymentMethod: newPayment.paymentMethod || 'CASH',
            installmentNumber: existing.payments.length + 1,
            createdById: createdById || existing.createdById
          }
        });
      }

      // Recalculer le total payé et le statut
      const allPayments = await tx.reservationPayment.findMany({ where: { reservationId: id } });
      const finalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

      const isCompleted = finalPaid >= newTotalAmount - 0.01;
      await tx.reservation.update({
        where: { id },
        data: { status: isCompleted ? 'COMPLETED' : 'PENDING' }
      });

      return await tx.reservation.findUnique({
        where: { id },
        include: {
          createdBy: { select: { name: true } },
          updatedBy: { select: { name: true } },
          items: true,
          payments: {
            include: { createdBy: { select: { name: true } } },
            orderBy: { installmentNumber: 'asc' }
          }
        }
      });
    });

    const totalPaid = updatedRes.payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingBalance = Math.max(0, updatedRes.totalAmount - totalPaid);

    res.json({
      ...updatedRes,
      totalPaid,
      remainingBalance
    });
  } catch (error) {
    if (error.message === 'NOT_FOUND') return res.status(404).json({ error: 'Réservation non trouvée' });
    if (error.message === 'CANCELLED') return res.status(400).json({ error: 'Réservation annulée' });
    if (error.message === 'MAX_PAYMENTS_REACHED') return res.status(400).json({ error: 'Maximum 3 tranches de paiement atteintes' });
    if (error.message === 'EXCEEDS_REMAINING') return res.status(400).json({ error: 'Le montant du versement dépasse le solde restant' });
    console.error('Update reservation error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la réservation' });
  }
});

// Annuler une réservation
app.post('/api/reservations/:id/cancel', async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await prisma.reservation.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l\'annulation de la réservation' });
  }
});


// Endpoint pour récupérer les paiements d'acomptes de réservations (pour le tableau de bord)
app.get('/api/reservation-payments', async (req, res) => {
  const { date, cashierId } = req.query;

  let where = {
    reservation: { status: { not: 'CANCELLED' } }
  };

  if (date) {
    const range = localDayRange(date);
    if (range) {
      where.createdAt = { gte: range.start, lte: range.end };
    }
  }

  if (cashierId) {
    where.createdById = cashierId;
  }

  try {
    const payments = await prisma.reservationPayment.findMany({
      where,
      include: {
        reservation: { select: { reservationNo: true, clientName: true } },
        createdBy: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des acomptes' });
  }
});

// Rapport Z pour une date ou une période donnée (startDate & endDate)
app.get('/api/z-report', async (req, res) => {
  const { date, startDate, endDate } = req.query;

  let start, end;
  if (startDate && endDate) {
    const p1 = startDate.split('-').map(Number);
    const p2 = endDate.split('-').map(Number);
    start = new Date(p1[0], p1[1] - 1, p1[2], 0, 0, 0, 0);
    end = new Date(p2[0], p2[1] - 1, p2[2], 23, 59, 59, 999);
  } else if (date) {
    const parts = date.split('-').map(Number);
    start = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    end = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
  } else {
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  }

  try {
    const invoices = await prisma.invoice.findMany({
      where: {
        status: 'VALIDATED',
        createdAt: { gte: start, lte: end }
      }
    });

    const resPayments = await prisma.reservationPayment.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        reservation: { status: { not: 'CANCELLED' } }
      }
    });

    const cancelledCount = await prisma.invoice.count({
      where: {
        status: 'CANCELLED',
        createdAt: { gte: start, lte: end }
      }
    });

    let total = 0;
    let count = invoices.length;
    let payments = { CASH: 0, ONLINE: 0, ORANGE_MONEY: 0 };

    invoices.forEach(inv => {
      // Exclude reservation final invoices from cash summation to prevent double counting
      if (!inv.isReservation) {
        total += inv.totalAmount;
        const m = inv.paymentMethod || 'CASH';
        payments[m] = (payments[m] || 0) + Number(inv.totalAmount || 0);
      }
    });

    resPayments.forEach(p => {
      total += p.amount;
      const m = p.paymentMethod || 'CASH';
      payments[m] = (payments[m] || 0) + Number(p.amount || 0);
    });

    const itemsPeriod = await prisma.invoiceItem.findMany({
      where: {
        invoice: {
          status: 'VALIDATED',
          createdAt: { gte: start, lte: end }
        }
      }
    });

    const categoryMap = {};
    itemsPeriod.forEach(item => {
      if (!categoryMap[item.categoryName]) {
        categoryMap[item.categoryName] = { name: item.categoryName, quantity: 0, revenue: 0 };
      }
      categoryMap[item.categoryName].quantity += 1;
      categoryMap[item.categoryName].revenue += item.price;
    });

    const topSelling = Object.values(categoryMap).sort((a, b) => b.revenue - a.revenue);

    const sStr = start.toLocaleDateString('fr-FR');
    const eStr = end.toLocaleDateString('fr-FR');
    const periodLabel = sStr === eStr ? `Le ${sStr}` : `Du ${sStr} au ${eStr}`;

    res.json({
      totalSales: total,
      total,
      count,
      validatedCount: count,
      resPaymentCount: resPayments.length,
      cancelledCount,
      payments,
      topSelling,
      periodLabel,
      date: periodLabel,
      time: new Date().toLocaleTimeString('fr-FR')
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la génération du rapport Z' });
  }
});

app.get('/api/stats', async (req, res) => {
  const { date, startDate, endDate, cashierId } = req.query;

  try {
    const now = new Date();

    const buildWhere = (start, end) => {
      const w = {
        status: 'VALIDATED',
        createdAt: { gte: start, lte: end }
      };
      if (cashierId) w.createdById = cashierId;
      return w;
    };

    const buildResWhere = (start, end) => {
      const w = {
        createdAt: { gte: start, lte: end },
        reservation: { status: { not: 'CANCELLED' } }
      };
      if (cashierId) w.createdById = cashierId;
      return w;
    };

    const getStatsForRange = async (start, end) => {
      const invoices = await prisma.invoice.findMany({
        where: buildWhere(start, end)
      });

      const resPayments = await prisma.reservationPayment.findMany({
        where: buildResWhere(start, end)
      });

      let total = 0, cash = 0, online = 0, orangeMoney = 0, reservationTotal = 0, count = 0;
      let directCash = 0, directOnline = 0, directOrange = 0;
      let resCash = 0, resOnline = 0, resOrange = 0;

      const normalizeMethod = (m) => String(m || '').trim().toUpperCase();

      invoices.forEach(inv => {
        if (!inv.isReservation) {
          count++;
          total += inv.totalAmount;
          const method = normalizeMethod(inv.paymentMethod);
          if (method === 'ORANGE_MONEY' || method === 'ORANGE' || method === 'OM') {
            orangeMoney += inv.totalAmount;
            directOrange += inv.totalAmount;
          } else if (method === 'ONLINE' || method === 'MOBILE_MONEY' || method === 'MOMO' || method === 'WAVE') {
            online += inv.totalAmount;
            directOnline += inv.totalAmount;
          } else {
            cash += inv.totalAmount;
            directCash += inv.totalAmount;
          }
        }
      });

      resPayments.forEach(p => {
        reservationTotal += p.amount;
        total += p.amount;
        const method = normalizeMethod(p.paymentMethod);
        if (method === 'ORANGE_MONEY' || method === 'ORANGE' || method === 'OM') {
          orangeMoney += p.amount;
          resOrange += p.amount;
        } else if (method === 'ONLINE' || method === 'MOBILE_MONEY' || method === 'MOMO' || method === 'WAVE') {
          online += p.amount;
          resOnline += p.amount;
        } else {
          cash += p.amount;
          resCash += p.amount;
        }
      });

      return {
        total, cash, online, orangeMoney, count, reservationTotal,
        resPaymentsCount: resPayments.length,
        directCash, directOnline, directOrange,
        resCash, resOnline, resOrange
      };
    };

    // -- AUJOURD'HUI --
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // -- CETTE SEMAINE (Lundi à Dimanche) --
    const startOfWeek = new Date(now);
    const dayOfWeek = startOfWeek.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // -- CE MOIS --
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const statsToday = await getStatsForRange(startOfToday, endOfToday);
    const statsWeek = await getStatsForRange(startOfWeek, endOfWeek);
    const statsMonth = await getStatsForRange(startOfMonth, endOfMonth);

    let activeFilterStats = null;
    if (startDate && endDate) {
      const p1 = startDate.split('-').map(Number);
      const p2 = endDate.split('-').map(Number);
      const s = new Date(p1[0], p1[1] - 1, p1[2], 0, 0, 0, 0);
      const e = new Date(p2[0], p2[1] - 1, p2[2], 23, 59, 59, 999);
      activeFilterStats = await getStatsForRange(s, e);
    } else if (date) {
      const p = date.split('-').map(Number);
      const s = new Date(p[0], p[1] - 1, p[2], 0, 0, 0, 0);
      const e = new Date(p[0], p[1] - 1, p[2], 23, 59, 59, 999);
      activeFilterStats = await getStatsForRange(s, e);
    } else {
      // Aucun filtre de date → total global (toutes dates confondues)
      const getStatsAllTime = async () => {
        const whereInv = { status: 'VALIDATED' };
        const whereRes = { reservation: { status: { not: 'CANCELLED' } } };
        if (cashierId) { whereInv.createdById = cashierId; whereRes.createdById = cashierId; }

        const [allInvoices, allResPayments] = await Promise.all([
          prisma.invoice.findMany({ where: whereInv }),
          prisma.reservationPayment.findMany({ where: whereRes })
        ]);

        let total = 0, cash = 0, online = 0, orangeMoney = 0, reservationTotal = 0, count = 0;
        let directCash = 0, directOnline = 0, directOrange = 0;
        let resCash = 0, resOnline = 0, resOrange = 0;
        const normalizeMethod = (m) => String(m || '').trim().toUpperCase();

        allInvoices.forEach(inv => {
          if (!inv.isReservation) {
            count++;
            total += inv.totalAmount;
            const method = normalizeMethod(inv.paymentMethod);
            if (method === 'ORANGE_MONEY' || method === 'ORANGE' || method === 'OM') {
              orangeMoney += inv.totalAmount;
              directOrange += inv.totalAmount;
            } else if (method === 'ONLINE' || method === 'MOBILE_MONEY' || method === 'MOMO' || method === 'WAVE') {
              online += inv.totalAmount;
              directOnline += inv.totalAmount;
            } else {
              cash += inv.totalAmount;
              directCash += inv.totalAmount;
            }
          }
        });
        allResPayments.forEach(p => {
          reservationTotal += p.amount;
          total += p.amount;
          const method = normalizeMethod(p.paymentMethod);
          if (method === 'ORANGE_MONEY' || method === 'ORANGE' || method === 'OM') {
            orangeMoney += p.amount;
            resOrange += p.amount;
          } else if (method === 'ONLINE' || method === 'MOBILE_MONEY' || method === 'MOMO' || method === 'WAVE') {
            online += p.amount;
            resOnline += p.amount;
          } else {
            cash += p.amount;
            resCash += p.amount;
          }
        });
        return {
          total, cash, online, orangeMoney, count, reservationTotal,
          resPaymentsCount: allResPayments.length,
          directCash, directOnline, directOrange,
          resCash, resOnline, resOrange
        };
      };
      activeFilterStats = await getStatsAllTime();
    }

    const filteredStats = activeFilterStats;
    const itemsToday = await prisma.invoiceItem.findMany({
      where: {
        invoice: buildWhere(startOfToday, endOfToday)
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
      filtered: filteredStats,
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
