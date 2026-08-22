import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { prisma } from './db.js';
import { hashPin, verifyPin } from './authHelper.js';
import ptp from 'pdf-to-printer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global print timestamp tracking to prevent duplicate server prints
let lastServerPrintTimestamp = 0;

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

// Helper: generate guaranteed unique invoice number FAC-YYYYMMDD-XXXX
async function generateUniqueInvoiceNumber(tx) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const prefix = `FAC-${year}${month}${day}-`;

  const todayInvoices = await tx.invoice.findMany({
    where: { invoiceNumber: { startsWith: prefix } },
    select: { invoiceNumber: true }
  });

  let maxSeq = 0;
  todayInvoices.forEach(inv => {
    const parts = inv.invoiceNumber.split('-');
    const seqNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(seqNum) && seqNum > maxSeq) {
      maxSeq = seqNum;
    }
  });

  let nextSeq = maxSeq + 1;
  let candidate = `${prefix}${String(nextSeq).padStart(4, '0')}`;

  while (await tx.invoice.findUnique({ where: { invoiceNumber: candidate } })) {
    nextSeq++;
    candidate = `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  return candidate;
}

// Helper: generate guaranteed unique reservation number RES-YYYYMMDD-XXXX
async function generateUniqueReservationNo(tx) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const prefix = `RES-${year}${month}${day}-`;

  const todayRes = await tx.reservation.findMany({
    where: { reservationNo: { startsWith: prefix } },
    select: { reservationNo: true }
  });

  let maxSeq = 0;
  todayRes.forEach(r => {
    const parts = r.reservationNo.split('-');
    const seqNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(seqNum) && seqNum > maxSeq) {
      maxSeq = seqNum;
    }
  });

  let nextSeq = maxSeq + 1;
  let candidate = `${prefix}${String(nextSeq).padStart(4, '0')}`;

  while (await tx.reservation.findUnique({ where: { reservationNo: candidate } })) {
    nextSeq++;
    candidate = `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  return candidate;
}

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

// Dupliquer une catégorie avec ses sous-catégories
app.post('/api/categories/:id/duplicate', async (req, res) => {
  const { id } = req.params;
  const { newName } = req.body;

  if (!newName) {
    return res.status(400).json({ error: 'Nouveau nom requis' });
  }

  try {
    const original = await prisma.category.findUnique({
      where: { id },
      include: { subCategories: true }
    });

    if (!original) {
      return res.status(404).json({ error: 'Catégorie originale non trouvée' });
    }

    const duplicated = await prisma.$transaction(async (tx) => {
      const newCat = await tx.category.create({
        data: {
          name: newName.trim(),
          color: original.color || 'bg-blue-500'
        }
      });

      if (original.subCategories && original.subCategories.length > 0) {
        await tx.subCategory.createMany({
          data: original.subCategories.map(sub => ({
            name: sub.name,
            categoryId: newCat.id
          }))
        });
      }

      return await tx.category.findUnique({
        where: { id: newCat.id },
        include: { subCategories: true }
      });
    });

    res.status(201).json(duplicated);
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(400).json({ error: 'Le nom de catégorie est déjà utilisé' });
    }
    console.error('Duplicate category error', error);
    res.status(500).json({ error: 'Erreur lors de la duplication' });
  }
});

// Ajouter une sous-catégorie à plusieurs catégories
app.post('/api/subcategories/batch', async (req, res) => {
  const { name, categoryIds } = req.body;

  if (!name || !categoryIds || !categoryIds.length) {
    return res.status(400).json({ error: 'Nom et identifiants de catégories requis' });
  }

  try {
    const createdSubs = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const catId of categoryIds) {
        // Check if a subcategory with this name already exists in this category
        const exists = await tx.subCategory.findFirst({
          where: { name: name.trim(), categoryId: catId }
        });
        if (!exists) {
          const sub = await tx.subCategory.create({
            data: {
              name: name.trim(),
              categoryId: catId
            }
          });
          results.push(sub);
        }
      }
      return results;
    });

    res.status(201).json({ message: `${createdSubs.length} sous-catégorie(s) créée(s)`, created: createdSubs });
  } catch (error) {
    console.error('Batch create subcategory error', error);
    res.status(500).json({ error: 'Erreur lors de la création groupée' });
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
      const invoiceNumber = await generateUniqueInvoiceNumber(tx);

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
      const invoiceNumber = await generateUniqueInvoiceNumber(tx);

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

    // Attach reservation payment history so the frontend can print it on the final ticket
    const invoiceWithHistory = {
      ...newInvoice,
      reservationPayments: reservation.payments,
      sourceReservationNo: reservation.reservationNo,
      clientPhone: reservation.clientPhone
    };

    res.status(201).json(invoiceWithHistory);
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
      const reservationNo = await generateUniqueReservationNo(tx);

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

function getPaymentMethodBreakdown(paymentMethod, totalAmount) {
  const res = { CASH: 0, ONLINE: 0, ORANGE_MONEY: 0 };
  const methodStr = String(paymentMethod || '').trim();

  if (methodStr.startsWith('MULTIPLE:')) {
    const parts = methodStr.substring(9).split(';');
    parts.forEach(part => {
      const [key, val] = part.split('=');
      const k = String(key || '').trim().toUpperCase();
      const v = parseFloat(val) || 0;
      if (k === 'CASH') {
        res.CASH += v;
      } else if (k === 'ONLINE' || k === 'MOBILE_MONEY' || k === 'MOMO' || k === 'WAVE') {
        res.ONLINE += v;
      } else if (k === 'ORANGE_MONEY' || k === 'ORANGE' || k === 'OM') {
        res.ORANGE_MONEY += v;
      }
    });
  } else {
    const k = methodStr.toUpperCase();
    if (k === 'ORANGE_MONEY' || k === 'ORANGE' || k === 'OM') {
      res.ORANGE_MONEY = totalAmount;
    } else if (k === 'ONLINE' || k === 'MOBILE_MONEY' || k === 'MOMO' || k === 'WAVE') {
      res.ONLINE = totalAmount;
    } else {
      res.CASH = totalAmount;
    }
  }
  return res;
}

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
        const breakdown = getPaymentMethodBreakdown(inv.paymentMethod, inv.totalAmount);
        payments.CASH += breakdown.CASH;
        payments.ONLINE += breakdown.ONLINE;
        payments.ORANGE_MONEY += breakdown.ORANGE_MONEY;
      }
    });

    resPayments.forEach(p => {
      total += p.amount;
      const breakdown = getPaymentMethodBreakdown(p.paymentMethod, p.amount);
      payments.CASH += breakdown.CASH;
      payments.ONLINE += breakdown.ONLINE;
      payments.ORANGE_MONEY += breakdown.ORANGE_MONEY;
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
          const breakdown = getPaymentMethodBreakdown(inv.paymentMethod, inv.totalAmount);
          cash += breakdown.CASH;
          directCash += breakdown.CASH;
          online += breakdown.ONLINE;
          directOnline += breakdown.ONLINE;
          orangeMoney += breakdown.ORANGE_MONEY;
          directOrange += breakdown.ORANGE_MONEY;
        }
      });

      resPayments.forEach(p => {
        reservationTotal += p.amount;
        total += p.amount;
        const breakdown = getPaymentMethodBreakdown(p.paymentMethod, p.amount);
        cash += breakdown.CASH;
        resCash += breakdown.CASH;
        online += breakdown.ONLINE;
        resOnline += breakdown.ONLINE;
        orangeMoney += breakdown.ORANGE_MONEY;
        resOrange += breakdown.ORANGE_MONEY;
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
            const breakdown = getPaymentMethodBreakdown(inv.paymentMethod, inv.totalAmount);
            cash += breakdown.CASH;
            directCash += breakdown.CASH;
            online += breakdown.ONLINE;
            directOnline += breakdown.ONLINE;
            orangeMoney += breakdown.ORANGE_MONEY;
            directOrange += breakdown.ORANGE_MONEY;
          }
        });
        allResPayments.forEach(p => {
          reservationTotal += p.amount;
          total += p.amount;
          const breakdown = getPaymentMethodBreakdown(p.paymentMethod, p.amount);
          cash += breakdown.CASH;
          resCash += breakdown.CASH;
          online += breakdown.ONLINE;
          resOnline += breakdown.ONLINE;
          orangeMoney += breakdown.ORANGE_MONEY;
          resOrange += breakdown.ORANGE_MONEY;
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
// -------------------------------------------------------------
// ESC/POS Direct Print Helpers
// -------------------------------------------------------------

function formatRow(col1, col2, col3, col4, width = 48) {
  const w1 = 19;
  const w2 = 5;
  const w3 = 10;
  const w4 = 12;
  
  const s2 = String(col2).slice(0, w2).padStart(w2);
  const s3 = String(col3).slice(0, w3).padStart(w3);
  
  let s4 = String(col4);
  let totalOnNextLine = false;
  if (s4.length > w4 && col2 !== 'Qté') {
    totalOnNextLine = true;
  }
  const s4_padded = totalOnNextLine ? '' : s4.padStart(w4);
  
  let c1 = String(col1);
  const lines = [];
  while (c1.length > w1) {
    lines.push(c1.substring(0, w1));
    c1 = c1.substring(w1);
  }
  lines.push(c1.padEnd(w1));
  
  let result = '';
  for (let i = 0; i < lines.length; i++) {
    if (i === 0) {
      if (col2 === 'Qté' && col3 === 'P/U') {
        result += lines[i] + s2 + ' ' + s3 + ' ' + s4_padded;
      } else {
        result += lines[i] + s2 + '|' + s3 + '|' + s4_padded;
      }
    } else {
      result += '\n' + lines[i] + ' '.repeat(w2 + 1 + w3 + 1 + (totalOnNextLine ? 0 : w4));
    }
  }
  
  if (totalOnNextLine) {
    result += '\n' + ' '.repeat(width - s4.length) + s4;
  }
  
  return result;
}

function formatKeyValuePair(key, value, width = 48) {
  const keyStr = String(key);
  const valStr = String(value);
  const totalLength = keyStr.length + valStr.length;

  // Both fit on one line
  if (totalLength < width) {
    const spaces = width - totalLength;
    return keyStr + ' '.repeat(spaces) + valStr;
  }

  // Value alone fits on a right-aligned line
  if (valStr.length <= width) {
    return keyStr + '\n' + valStr.padStart(width);
  }

  // Value is longer than the full width — chunk it across multiple lines
  const chunks = [];
  let remaining = valStr;
  while (remaining.length > 0) {
    chunks.push(remaining.substring(0, width));
    remaining = remaining.substring(width);
  }
  return keyStr + '\n' + chunks.map(c => c.padStart(width)).join('\n');
}

function formatEscPosInvoice(invoiceData, printer) {
  const groupItems = (items = []) => {
    const map = {};
    items.forEach(item => {
      const key = `${item.categoryName}||${item.price}`;
      if (!map[key]) map[key] = { categoryName: item.categoryName, price: item.price, qty: 0 };
      map[key].qty += 1;
    });
    return Object.values(map);
  };

  const getPaymentMethodLabel = (method) => {
    const methodStr = String(method || '').trim();
    if (methodStr.startsWith('MULTIPLE:')) {
      const parts = methodStr.substring(9).split(';');
      const labels = parts.map(part => {
        const [key, val] = part.split('=');
        const k = String(key || '').trim().toUpperCase();
        const v = parseFloat(val) || 0;
        let label = '';
        if (k === 'CASH') label = 'Espèces';
        else if (k === 'ONLINE') label = 'Mobile Money';
        else if (k === 'ORANGE_MONEY') label = 'Orange Money';
        else label = k;
        return `${label}: ${new Intl.NumberFormat('fr-FR').format(v)} FCFA`;
      });
      return labels.join(', ');
    }
    if (method === 'CASH') return 'Espèces';
    if (method === 'ONLINE') return 'Mobile Money';
    if (method === 'ORANGE_MONEY') return 'Orange Money';
    return 'Non précisé';
  };

  printer
    .align('center')
    .size(2, 2)
    .text('JOEL SHOP')
    .size(1, 1)
    .text('─── TICKET DE CAISSE ───')
    .text('NIU: P079216781512Z')
    .text(' ')
    .align('left');

  printer.text(formatKeyValuePair('N° Ticket:', invoiceData.invoiceNumber));
  printer.text(formatKeyValuePair('Date:', new Date(invoiceData.createdAt).toLocaleString('fr-FR')));
  printer.text(formatKeyValuePair('Caissière:', invoiceData.createdBy?.name || 'Caissière'));
  printer.text(formatKeyValuePair('Règlement:', getPaymentMethodLabel(invoiceData.paymentMethod)));

  let clientNameStr = invoiceData.clientName || '';
  let clientPhoneStr = invoiceData.clientPhone || '';

  if (!clientPhoneStr && clientNameStr.includes('(') && clientNameStr.includes(')')) {
    const match = clientNameStr.match(/^(.+?)\s*\((.+?)\)$/);
    if (match) {
      clientNameStr = match[1].trim();
      clientPhoneStr = match[2].trim();
    }
  } else if (!clientPhoneStr && /^[0-9+\s-]+$/.test(clientNameStr.trim())) {
    clientPhoneStr = clientNameStr.trim();
    clientNameStr = '';
  }

  if (clientNameStr && clientNameStr !== 'Client de passage') {
    printer.text(formatKeyValuePair('Nom client:', clientNameStr));
  }
  if (clientPhoneStr) {
    printer.text(formatKeyValuePair('Tél client:', clientPhoneStr));
  }

  printer.text('-'.repeat(48));
  printer.text(formatRow('Désignation', 'Qté', 'P/U', 'Total'));
  printer.text('-'.repeat(48));

  const items = groupItems(invoiceData.items);
  items.forEach(item => {
    const priceStr = Math.round(item.price).toLocaleString('fr-FR');
    const totalStr = Math.round(item.price * item.qty).toLocaleString('fr-FR');
    printer.text(formatRow(item.categoryName, item.qty, priceStr, totalStr));
  });

  printer.text('='.repeat(48));
  
  printer
    .bold(true)
    .text(formatKeyValuePair('TOTAL À PAYER:', `${Math.round(invoiceData.totalAmount).toLocaleString('fr-FR')} FCFA`))
    .bold(false);

  printer
    .align('center')
    .text(' ')
    .text('Merci de votre visite !')
    .text('Fait par © TriSpark Digital')
    .feed(3)
    .cut()
    .cashdraw(2);
}

function formatEscPosReservation(reservation, printer) {
  const getPaymentMethodLabel = (method) => {
    const methodStr = String(method || '').trim();
    if (methodStr.startsWith('MULTIPLE:')) {
      const parts = methodStr.substring(9).split(';');
      const labels = parts.map(part => {
        const [key, val] = part.split('=');
        const k = String(key || '').trim().toUpperCase();
        const v = parseFloat(val) || 0;
        let label = '';
        if (k === 'CASH') label = 'Espèces';
        else if (k === 'ONLINE') label = 'Mobile Money';
        else if (k === 'ORANGE_MONEY') label = 'Orange Money';
        else label = k;
        return `${label}: ${new Intl.NumberFormat('fr-FR').format(v)} FCFA`;
      });
      return labels.join(', ');
    }
    if (method === 'CASH') return 'Espèces';
    if (method === 'ONLINE') return 'Mobile Money';
    if (method === 'ORANGE_MONEY') return 'Orange Money';
    return 'Non précisé';
  };

  printer
    .align('center')
    .size(2, 2)
    .text('JOEL SHOP')
    .size(1, 1)
    .text('─── REÇU PROFORMA (RÉSERVATION) ───')
    .text('NIU: P079216781512Z')
    .text(' ')
    .align('left');

  printer.text(formatKeyValuePair('N° Réservation:', reservation.reservationNo));
  printer.text(formatKeyValuePair('Date:', new Date(reservation.createdAt).toLocaleString('fr-FR')));
  if (reservation.clientName) {
    printer.text(formatKeyValuePair('Nom client:', reservation.clientName));
  }
  if (reservation.clientPhone) {
    printer.text(formatKeyValuePair('Tél client:', reservation.clientPhone));
  }
  printer.text(formatKeyValuePair('Enregistré par:', reservation.createdBy?.name || 'Caissière'));
  printer.text(formatKeyValuePair('Statut:', reservation.status === 'COMPLETED' ? 'PAYÉE À 100%' : 'EN COURS DE PAIEMENT'));

  printer.text('-'.repeat(48));
  printer.text(formatRow('Désignation', 'Qté', 'P/U', 'Total'));
  printer.text('-'.repeat(48));

  const items = reservation.items || [];
  items.forEach(item => {
    const qty = item.qty || 1;
    const priceStr = Math.round(item.price).toLocaleString('fr-FR');
    const totalStr = Math.round(item.price * qty).toLocaleString('fr-FR');
    printer.text(formatRow(item.categoryName, qty, priceStr, totalStr));
  });

  printer.text('='.repeat(48));
  printer
    .bold(true)
    .text(formatKeyValuePair('MONTANT TOTAL:', `${Math.round(reservation.totalAmount).toLocaleString('fr-FR')} FCFA`))
    .bold(false);

  printer.text('-'.repeat(48));
  printer.text('HISTORIQUE DES VERSEMENTS:');

  const payments = reservation.payments || [];
  payments.forEach((p, idx) => {
    const label = `Tranche ${p.installmentNumber || idx + 1}/3 (${getPaymentMethodLabel(p.paymentMethod)}):`;
    const val = `${Math.round(p.amount).toLocaleString('fr-FR')} FCFA`;
    printer.text(formatKeyValuePair(label, val));
  });

  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remaining = Math.max(0, (Number(reservation.totalAmount) || 0) - totalPaid);

  printer.text('-'.repeat(48));
  printer.text(formatKeyValuePair('TOTAL DÉJÀ PAYÉ:', `${Math.round(totalPaid).toLocaleString('fr-FR')} FCFA`));
  printer
    .bold(true)
    .text(formatKeyValuePair('RESTE À PAYER:', `${Math.round(remaining).toLocaleString('fr-FR')} FCFA`))
    .bold(false);

  printer
    .align('center')
    .text(' ')
    .text('Document Proforma de Réservation.')
    .text('La facture définitive est remise après solde complet.')
    .text('Merci pour votre confiance - JOEL SHOP')
    .text('Fait par © TriSpark Digital')
    .feed(3)
    .cut();
}

function formatEscPosZReport(invoiceData, printer) {
  const zr = invoiceData.zReport;
  
  printer
    .align('center')
    .size(2, 2)
    .text('JOEL SHOP')
    .size(1, 1)
    .text('RAPPORT DE CLÔTURE (Z)')
    .text(' ')
    .align('left');

  printer.text(formatKeyValuePair('Date:', `${zr.date} ${zr.time}`));
  printer.text(formatKeyValuePair('Opérateur:', invoiceData.createdBy?.name || 'Admin'));
  printer.text('-'.repeat(48));

  printer
    .bold(true)
    .text('SYNTHÈSE COMPTABLE')
    .text(formatKeyValuePair('TOTAL NET:', `${Math.round(zr.totalSales).toLocaleString('fr-FR')} FCFA`))
    .bold(false);

  printer.text('-'.repeat(48));
  printer.text(formatKeyValuePair('Espèces:', `${Math.round(zr.totalCash || zr.payments?.CASH || 0).toLocaleString('fr-FR')} FCFA`));
  printer.text(formatKeyValuePair('Mobile Money:', `${Math.round(zr.totalOnline || zr.payments?.ONLINE || 0).toLocaleString('fr-FR')} FCFA`));
  printer.text(formatKeyValuePair('Orange Money:', `${Math.round(zr.payments?.ORANGE_MONEY || 0).toLocaleString('fr-FR')} FCFA`));
  printer.text(formatKeyValuePair('Ventes Validées:', zr.validatedCount));
  printer.text(formatKeyValuePair('Ventes Annulées:', zr.cancelledCount));

  printer.text('-'.repeat(48));
  printer.bold(true).text('RÉPARTITION PAR CATÉGORIE').bold(false);

  const topSelling = zr.topSelling || [];
  topSelling.forEach(cat => {
    const label = `${cat.name} (x${cat.quantity})`;
    const val = `${Math.round(cat.revenue).toLocaleString('fr-FR')} FCFA`;
    printer.text(formatKeyValuePair(label, val));
  });

  printer
    .align('center')
    .text(' ')
    .text('--- FIN DU RAPPORT Z ---')
    .feed(3)
    .cut();
}

async function printEscPosDirect(body) {
  const connectionType = (process.env.PRINTER_CONNECTION || '').toLowerCase().trim();
  if (connectionType !== 'usb' && connectionType !== 'network') {
    return false; // Skip direct print, use PDF fallback
  }

  // Load modules dynamically
  let escposCore, escposUsb, escposNetwork;
  try {
    escposCore = await import('@node-escpos/core');
    if (connectionType === 'usb') {
      escposUsb = await import('@node-escpos/usb-adapter');
    } else {
      escposNetwork = await import('@node-escpos/network-adapter');
    }
  } catch (err) {
    console.error("❌ Failed to load ESC/POS adapters dynamically:", err.message);
    return false;
  }

  const { invoiceData, reservation } = body;
  if (!invoiceData && !reservation) {
    console.warn("⚠️ No structured invoiceData or reservation in request body, skipping direct ESC/POS print.");
    return false;
  }

  // Determine the device
  let device;
  try {
    if (connectionType === 'usb') {
      const USB = escposUsb.default || escposUsb.USB || escposUsb;
      // Parse VID and PID
      const vid = parseInt(process.env.PRINTER_USB_VID || '0x04b8', 16);
      const pid = parseInt(process.env.PRINTER_USB_PID || '0x0e15', 16);
      console.log(`🔌 Connecting to ESC/POS printer via USB (VID: 0x${vid.toString(16)}, PID: 0x${pid.toString(16)})...`);
      device = new USB(vid, pid);
    } else {
      const Network = escposNetwork.default || escposNetwork.Network || escposNetwork;
      const ip = (process.env.PRINTER_IP || '192.168.1.100').trim();
      const port = parseInt(process.env.PRINTER_PORT || '9100', 10);
      console.log(`🔌 Connecting to ESC/POS printer via Network (${ip}:${port})...`);
      device = new Network(ip, port);
    }
  } catch (err) {
    console.error("❌ Failed to initialize ESC/POS device:", err.message);
    return false;
  }

  // Open the device, write, and close
  return new Promise((resolve) => {
    device.open(async (err) => {
      if (err) {
        console.error("❌ Failed to open ESC/POS device:", err.message);
        return resolve(false);
      }

      try {
        const Printer = escposCore.default?.Printer || escposCore.Printer;
        const printer = new Printer({ encoding: "CP850" });

        if (invoiceData) {
          if (invoiceData.isZReport) {
            formatEscPosZReport(invoiceData, printer);
          } else {
            formatEscPosInvoice(invoiceData, printer);
          }
        } else if (reservation) {
          formatEscPosReservation(reservation, printer);
        }

        const buffer = printer.toBuffer();
        device.write(buffer, (writeErr) => {
          if (writeErr) {
            console.error("❌ Failed to write to ESC/POS device:", writeErr.message);
            device.close(() => resolve(false));
          } else {
            console.log("✅ Successfully sent raw ESC/POS commands to printer.");
            device.close(() => resolve(true));
          }
        });
      } catch (printErr) {
        console.error("❌ Error printing ESC/POS commands:", printErr);
        device.close(() => {
          resolve(false);
        });
      }
    });
  });
}

// Endpoint de réception des jobs d'impression (demo)
app.post('/api/print', async (req, res) => {
  try {
    const now = Date.now();
    if (now - lastServerPrintTimestamp < 2500) {
      console.log('Ignored duplicate print request (throttled)');
      return res.json({ ok: true, message: 'Print request throttled' });
    }
    lastServerPrintTimestamp = now;

    // Try direct ESC/POS raw print if configured
    try {
      const printedDirectly = await printEscPosDirect(req.body);
      if (printedDirectly) {
        return res.json({ ok: true, message: 'Printed directly via ESC/POS' });
      }
    } catch (escPosErr) {
      console.warn("⚠️ ESC/POS printing failed, falling back to PDF/Spooler method:", escPosErr.message);
    }

    const { html } = req.body || {};
    if (!html) return res.status(400).json({ error: 'No html provided' });

    const outDir = path.join(__dirname, 'print_jobs');
    await fs.mkdir(outDir, { recursive: true });
    const timestamp = Date.now();
    const htmlPath = path.join(outDir, `print_${timestamp}.html`);
    const pdfPath  = path.join(outDir, `print_${timestamp}.pdf`);
    await fs.writeFile(htmlPath, html, 'utf8');

    console.log('Saved print job to', htmlPath);

    if (process.platform === 'linux') {
      // ─────────────────────────────────────────────────────────
      // CONFIGURATION RÉSEAU : variables disponibles dans .env
      //   PRINTER_IP   = Adresse IP réseau de l'imprimante
      //                  (ex: 192.168.1.150) — obligatoire pour impression réseau
      //   PRINTER_PORT = Port IPP de l'imprimante (défaut: 631)
      //   PRINTER_NAME = Nom de file CUPS (optionnel, si déjà configuré dans CUPS)
      // ─────────────────────────────────────────────────────────
      const printerIp   = (process.env.PRINTER_IP   || '').trim();
      const printerPort = (process.env.PRINTER_PORT  || '631').trim();
      const printerName = (process.env.PRINTER_NAME  || '').trim();

      // Detect available Chrome/Chromium binary
      const chromeBins = ['google-chrome', 'chromium', 'chromium-browser'];
      let chromeBin = process.env.CHROME_BIN || null;
      if (!chromeBin) {
        const { execSync } = await import('child_process');
        for (const bin of chromeBins) {
          try {
            const found = execSync(`which ${bin} 2>/dev/null`).toString().trim();
            if (found) { chromeBin = found; break; }
          } catch { /* not found */ }
        }
      }

      if (chromeBin) {
        // Étape 1 : Chrome génère le PDF
        const chromeCmd = [
          `"${chromeBin}"`,
          '--headless=new',
          '--no-sandbox',
          '--disable-gpu',
          '--run-all-compositor-stages-before-draw',
          '--virtual-time-budget=5000',
          `--print-to-pdf="${pdfPath}"`,
          '--print-to-pdf-no-header',
          '--no-pdf-header-footer',
          `"file://${htmlPath}"`,
          '2>/dev/null'
        ].join(' ');

        exec(chromeCmd, (chromeErr) => {
          if (chromeErr) {
            console.error('❌ [LINUX] Échec génération PDF par Chrome:', chromeErr.message);
            return;
          }
          console.log('✅ [LINUX] PDF généré :', pdfPath);

          // Étape 2 : Envoi vers l'imprimante (réseau IP ou CUPS local)
          let lpCmd;

          if (printerIp) {
            // ── IMPRESSION RÉSEAU via IPP (PRINTER_IP défini dans .env) ──
            // Fonctionnement : lp envoie le PDF directement sur l'IP réseau de l'imprimante
            // sans avoir besoin de la configurer dans CUPS au préalable.
            console.log(`🖨️ [LINUX RÉSEAU] Envoi vers ${printerIp}:${printerPort} ...`);
            if (printerName) {
              // IPP avec nom de file spécifique : ipp://IP:PORT/printers/NOM
              lpCmd = `lp -h "${printerIp}:${printerPort}" -d "${printerName}" -o fit-to-page -o sides=one-sided "${pdfPath}" 2>/dev/null`;
            } else {
              // IPP direct sur l'imprimante par défaut exposée par l'hôte distant
              lpCmd = `lp -h "${printerIp}:${printerPort}" -o fit-to-page -o sides=one-sided "${pdfPath}" 2>/dev/null`;
            }
          } else if (printerName) {
            // ── IMPRESSION CUPS LOCAL (PRINTER_NAME défini dans .env) ──
            console.log(`🖨️ [LINUX CUPS] Envoi vers la file CUPS : ${printerName} ...`);
            lpCmd = `lp -d "${printerName}" -o fit-to-page -o sides=one-sided "${pdfPath}" 2>/dev/null`;
          } else {
            // ── IMPRIMANTE PAR DÉFAUT CUPS (aucune config) ──
            console.log(`🖨️ [LINUX] Envoi vers l'imprimante CUPS par défaut ...`);
            lpCmd = `lp -o fit-to-page -o sides=one-sided "${pdfPath}" 2>/dev/null`;
          }

          exec(lpCmd, (lpErr) => {
            if (lpErr) {
              console.error(`❌ [LINUX] Échec impression (${lpCmd}) :`, lpErr.message);
            } else {
              const dest = printerIp ? `${printerIp}:${printerPort}` : (printerName || 'imprimante par défaut');
              console.log(`✅ [LINUX] Ticket envoyé avec succès vers ${dest}`);
            }
          });
        });

      } else {
        console.warn('⚠️ [LINUX] Aucun Chrome/Chromium trouvé. Installez-le via : sudo apt-get install -y google-chrome-stable');
      }

    } else if (process.platform === 'win32') {
      const localAppData = process.env.LOCALAPPDATA || '';
      const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
      const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
      const systemDrive = process.env.SystemDrive || 'C:';

      const candidateBrowsers = [
        process.env.CHROME_BIN,
        path.join(programFiles, 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(programFilesX86, 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe'),
        `${systemDrive}\\Program Files\\Google\\Chrome\\Application\\chrome.exe`,
        `${systemDrive}\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe`,
        `${systemDrive}\\ProgramData\\Google\\Chrome\\Application\\chrome.exe`,
        // Edge is built into Windows 10/11 PCs
        path.join(programFilesX86, 'Microsoft\\Edge\\Application\\msedge.exe'),
        path.join(programFiles, 'Microsoft\\Edge\\Application\\msedge.exe'),
      ].filter(Boolean);

      let browserBin = candidateBrowsers.find(p => {
        try { return existsSync(p); } catch { return false; }
      });

      if (!browserBin) {
        const { execSync } = await import('child_process');
        for (const cmd of ['where chrome 2>NUL', 'where msedge 2>NUL']) {
          try {
            const found = execSync(cmd).toString().split(/[\r\n]+/)[0].trim();
            if (found && found.endsWith('.exe')) { browserBin = found; break; }
          } catch { /* ignore */ }
        }
      }

      if (browserBin) {
        // ─────────────────────────────────────────────────────────
        // CONFIGURATION RÉSEAU WINDOWS : variables dans .env
        //   PRINTER_IP   = IP réseau de l'imprimante (ex: 192.168.1.150)
        //   PRINTER_PORT = Port IPP (défaut: 631)
        //   PRINTER_NAME = Nom de l'imprimante dans Windows Spooler
        //
        // Logique :
        //  1. Si PRINTER_NAME est défini → utiliser ce nom directement (déjà installée)
        //  2. Si PRINTER_IP est défini et pas PRINTER_NAME →
        //     installer auto l'imprimante réseau via PowerShell, puis imprimer
        //  3. Si rien → imprimante par défaut Windows
        // ─────────────────────────────────────────────────────────
        const printerIp    = (process.env.PRINTER_IP   || '').trim();
        const printerPort  = (process.env.PRINTER_PORT  || '631').trim();
        const rawPrinterName = process.env.PRINTER_NAME || '';
        let cleanPrinterName = rawPrinterName.replace(/^["']|["']$/g, '').trim();

        // Ignore generic placeholder names from documentation/examples
        const placeholders = ['monimprimantepos', 'nomdevotreimprimante', 'nomexactdevotreimprimante', 'default', 'imprimante', 'pos-80-example'];
        if (placeholders.includes(cleanPrinterName.toLowerCase())) {
          console.log(`ℹ️ PRINTER_NAME="${cleanPrinterName}" est un nom d'exemple -> ignoré.`);
          cleanPrinterName = '';
        }

        // Si PRINTER_IP est défini mais pas PRINTER_NAME, on installe auto l'imprimante réseau
        const resolveNetworkPrinter = () => new Promise((resolve) => {
          if (!printerIp || cleanPrinterName) return resolve(cleanPrinterName);

          const ippUri = `http://${printerIp}:${printerPort}/ipp/print`;
          const autoName = `POS-Printer-${printerIp}`;
          console.log(`🔌 [WIN RÉSEAU] Installation automatique de l'imprimante réseau ${printerIp}...`);
          // Ajoute l'imprimante IPP réseau dans le spooler Windows (silencieux)
          const addCmd = `powershell -Command "if (-not (Get-Printer -Name '${autoName}' -ErrorAction SilentlyContinue)) { Add-Printer -ConnectionURI '${ippUri}' -Name '${autoName}' }"`;
          exec(addCmd, (err) => {
            if (err) {
              console.warn(`⚠️ [WIN RÉSEAU] Impossible d'installer l'imprimante auto (${err.message}). Tentative sur l'imprimante par défaut.`);
              resolve('');
            } else {
              console.log(`✅ [WIN RÉSEAU] Imprimante réseau installée sous le nom : ${autoName}`);
              resolve(autoName);
            }
          });
        });

        const formattedHtmlPath = htmlPath.replace(/\\/g, '/');
        const formattedPdfPath = pdfPath.replace(/\\/g, '/');

        // Step 1: Generate PDF first using Chromium headless
        const generatePdfCmd = `"${browserBin}" --headless=new --no-sandbox --disable-gpu --print-to-pdf="${formattedPdfPath}" --no-pdf-header-footer "file:///${formattedHtmlPath}"`;

        console.log(`🌐 [CHROME HEADLESS] Génération du PDF via : ${browserBin}`);
        exec(generatePdfCmd, async (pdfErr) => {
          if (pdfErr) {
            console.error('⛔ [BLOCAGE IMPRESSION] Échec de la génération du PDF par Chrome:', pdfErr.message);
            return;
          }

          // VERIFICATION ET SÉCURITÉ : Le fichier doit exister et être un PDF non vide
          if (!existsSync(pdfPath) || !pdfPath.endsWith('.pdf')) {
            console.error('⛔ [BLOCAGE IMPRESSION] ERREUR : Le fichier à imprimer N\'EST PAS un fichier PDF valide ou est introuvable. Impression annulée.');
            return;
          }

          try {
            const stats = await fs.stat(pdfPath);
            if (stats.size === 0) {
              console.error('⛔ [BLOCAGE IMPRESSION] ERREUR : Fichier PDF généré de taille 0 octet. Impression annulée.');
              return;
            }
            console.log(`✅ [PDF VALIDE] Fichier PDF créé avec succès : ${pdfPath} (${(stats.size / 1024).toFixed(2)} KB)`);
          } catch (e) {
            console.error('⛔ [BLOCAGE IMPRESSION] Erreur d\'accès au fichier PDF :', e.message);
            return;
          }

          // Step 2: Print ONLY if PDF is verified and valid
          // Résoudre le nom de l'imprimante (auto-install réseau si PRINTER_IP)
          const resolvedPrinterName = await resolveNetworkPrinter();
          const effectivePrinterName = resolvedPrinterName || cleanPrinterName;
          const targetPrinterLog = effectivePrinterName
            ? `l'imprimante "${effectivePrinterName}"`
            : (printerIp ? `réseau ${printerIp}` : "l'imprimante par DÉFAUT de Windows");
          console.log(`🖨️ [IMPRESSION WINDOWS] Envoi du PDF vers ${targetPrinterLog}...`);

          // Méthode N°1 : Bibliothèque officielle pdf-to-printer (Moteur SumatraPDF d'impression directe sous Windows)
          console.log(`▶️ Execution Méthode N°1 (pdf-to-printer / SumatraPDF)...`);
          const ptpOptions = {
            ...(effectivePrinterName ? { printer: effectivePrinterName } : {}),
            win32: ['-print-settings "noscale"']
          };

          try {
            await ptp.print(pdfPath, ptpOptions);
            console.log(`✅ [SUCCÈS IMPRESSION] Fichier PDF imprimé avec succès via pdf-to-printer sur ${targetPrinterLog}`);
            return;
          } catch (ptpErr) {
            console.warn(`⚠️ Méthode N°1 (pdf-to-printer) échouée (${ptpErr.message}), tentative via Méthode N°2 (Windows Shell)...`);
          }


          // Méthode 2: Impression directe via le handler PDF natif Windows
          const printCmd2 = cleanPrinterName
            ? `powershell -Command "Start-Process -FilePath '${pdfPath}' -Verb PrintTo -ArgumentList '\"${cleanPrinterName}\"'" `
            : `powershell -Command "Start-Process -FilePath '${pdfPath}' -Verb Print"`;

          console.log(`▶️ Execution Méthode 2 (Windows Native Shell Print) : ${printCmd2}`);

          exec(printCmd2, (err2) => {
            if (!err2) {
              console.log(`✅ [SUCCÈS IMPRESSION] Fichier PDF imprimé avec succès via le Shell Windows sur ${targetPrinterLog}`);
              return;
            }
            console.warn(`⚠️ Méthode 2 échouée (${err2.message}), tentative Méthode 3 (Chromium Direct)...`);

            // Méthode 3: Chromium Direct PDF Print (--headless=old)
            const printerArg = cleanPrinterName ? `--printer-name="${cleanPrinterName}"` : '';
            const printCmd3 = `"${browserBin}" --headless=old --no-sandbox --disable-gpu --print-to-printer ${printerArg} "${pdfPath}"`;
            console.log(`▶️ Execution Méthode 3 (Chromium Direct) : ${printCmd3}`);

            exec(printCmd3, (err3) => {
              if (!err3) {
                console.log(`✅ [SUCCÈS IMPRESSION] Fichier PDF imprimé avec succès via Chromium Direct sur ${targetPrinterLog}`);
              } else {
                console.error(`❌ [ÉCHEC IMPRESSION TOTAL] Impossible d'envoyer le ticket sur l'imprimante : ${err3?.message}`);
              }
            });
          });
        });
      } else {
        console.warn('Ni Chrome ni Edge n\'ont été trouvés sous Windows. Veuillez installer Google Chrome.');
      }
    }

    res.json({ ok: true, path: `/print_jobs/print_${timestamp}.html` });
  } catch (err) {
    console.error('Print endpoint error', err);
    res.status(500).json({ error: 'Failed to enqueue print job' });
  }
});

// Diagnostic route: List Windows / Linux installed printers
app.get('/api/printers', async (req, res) => {
  try {
    const { exec } = await import('child_process');
    if (process.platform === 'win32') {
      exec('powershell -Command "Get-CimInstance Win32_Printer | Select-Object Name, Default, PrinterStatus | ConvertTo-Json"', (err, stdout) => {
        if (err) return res.status(500).json({ error: err.message });
        try {
          const printers = JSON.parse(stdout);
          res.json({ configured: process.env.PRINTER_NAME || 'Default', printers });
        } catch {
          res.json({ configured: process.env.PRINTER_NAME || 'Default', raw: stdout });
        }
      });
    } else {
      exec('lpstat -p', (err, stdout) => {
        if (err) return res.json({ configured: process.env.PRINTER_NAME || 'Default', printers: [] });
        res.json({ configured: process.env.PRINTER_NAME || 'Default', raw: stdout });
      });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
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
