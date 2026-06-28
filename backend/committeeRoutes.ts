import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

const toNumber = (value: any, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

// 1. Get all committees
router.get('/api/committees', async (req, res) => {
  try {
    const { status } = req.query;
    const where: any = {};
    if (status) where.status = String(status);

    const committees = await prisma.committee.findMany({
      where,
      include: {
        _count: { select: { participants: true, months: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(committees);
  } catch (err) {
    console.error('Fetch committees error:', err);
    return res.status(500).json({ error: 'Failed to fetch committees' });
  }
});

// 2. Create new committee
router.post('/api/committees', async (req, res) => {
  try {
    const {
      name,
      type = 'MONTHLY',
      startDate,
      endDate,
      totalParticipants,
      installmentAmount,
      drawDate,
      winnerSelectionMethod = 'MANUAL',
      notes
    } = req.body;

    const cleanName = String(name || '').trim();
    const participantsCount = toNumber(totalParticipants);
    const installment = toNumber(installmentAmount);

    if (!cleanName) return res.status(400).json({ error: 'Committee name is required' });
    if (!startDate) return res.status(400).json({ error: 'Start date is required' });
    if (!participantsCount || participantsCount <= 0) return res.status(400).json({ error: 'Total participants must be greater than 0' });
    if (!installment || installment <= 0) return res.status(400).json({ error: 'Installment amount must be greater than 0' });

    const parsedStartDate = new Date(startDate);
    if (Number.isNaN(parsedStartDate.getTime())) {
      return res.status(400).json({ error: 'Invalid start date' });
    }

    const totalPool = participantsCount * installment;
    const parsedEndDate = endDate ? new Date(endDate) : addMonths(parsedStartDate, participantsCount);

    const result = await prisma.$transaction(async (tx) => {
      const committee = await tx.committee.create({
        data: {
          name: cleanName,
          type: String(type || 'MONTHLY'),
          startDate: parsedStartDate,
          endDate: Number.isNaN(parsedEndDate.getTime()) ? null : parsedEndDate,
          totalParticipants: participantsCount,
          installmentAmount: installment,
          totalPool,
          drawDate: drawDate ? toNumber(drawDate) : null,
          winnerSelectionMethod: String(winnerSelectionMethod || 'MANUAL'),
          notes: notes || null,
          status: 'ACTIVE'
        }
      });

      // In Besi/BC, normally one month/cycle per participant.
      let currentDate = new Date(parsedStartDate);
      for (let i = 0; i < participantsCount; i++) {
        const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        const monthEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        await tx.committeeMonth.create({
          data: {
            committeeId: committee.id,
            monthName,
            startDate: new Date(currentDate),
            endDate: monthEndDate,
            status: 'PENDING'
          }
        });

        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      await tx.committeeAuditLog.create({
        data: {
          committeeId: committee.id,
          action: 'COMMITTEE_CREATED',
          description: `Created ${cleanName} with ${participantsCount} participants and Rs ${installment} installment`
        }
      });

      return committee;
    });

    return res.status(201).json(result);
  } catch (err: any) {
    console.error('Create committee error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to create committee' });
  }
});

// 3. Get single committee details
router.get('/api/committees/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid committee id' });

    const committee = await prisma.committee.findUnique({
      where: { id },
      include: {
        participants: { orderBy: { participantNo: 'asc' } },
        months: {
          include: {
            collections: {
              include: { participant: true },
              orderBy: { participant: { participantNo: 'asc' } }
            },
            winners: { include: { participant: true, payout: true } }
          },
          orderBy: { startDate: 'asc' }
        }
      }
    });

    if (!committee) return res.status(404).json({ error: 'Committee not found' });
    return res.json(committee);
  } catch (err) {
    console.error('Fetch committee detail error:', err);
    return res.status(500).json({ error: 'Failed to fetch committee details' });
  }
});

// 4. Add participant
router.post('/api/committees/:id/participants', async (req, res) => {
  try {
    const committeeId = Number(req.params.id);
    const { name, phone, cnic, shopName, address, profilePicture, openingBalance, notes } = req.body;

    const cleanName = String(name || '').trim();
    if (!committeeId) return res.status(400).json({ error: 'Invalid committee id' });
    if (!cleanName) return res.status(400).json({ error: 'Participant name is required' });

    const committee = await prisma.committee.findUnique({ where: { id: committeeId } });
    if (!committee) return res.status(404).json({ error: 'Committee not found' });

    const currentParticipants = await prisma.committeeParticipant.count({ where: { committeeId } });
    if (currentParticipants >= committee.totalParticipants) {
      return res.status(400).json({ error: 'Committee is full' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const participant = await tx.committeeParticipant.create({
        data: {
          committeeId,
          name: cleanName,
          phone: phone || null,
          cnic: cnic || null,
          shopName: shopName || null,
          address: address || null,
          profilePicture: profilePicture || null,
          openingBalance: toNumber(openingBalance),
          notes: notes || null,
          participantNo: currentParticipants + 1,
          status: 'ACTIVE'
        }
      });

      const months = await tx.committeeMonth.findMany({ where: { committeeId } });
      for (const month of months) {
        await tx.committeeCollection.create({
          data: {
            committeeId,
            monthId: month.id,
            participantId: participant.id,
            installmentAmount: committee.installmentAmount,
            paidAmount: 0,
            remainingAmount: committee.installmentAmount,
            status: 'PENDING'
          }
        });
      }

      await tx.committeeAuditLog.create({
        data: {
          committeeId,
          participantId: participant.id,
          action: 'PARTICIPANT_ADDED',
          description: `Added participant ${participant.name}`
        }
      });

      return participant;
    });

    return res.status(201).json(result);
  } catch (err: any) {
    console.error('Add participant error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to add participant' });
  }
});

// 5. Update collection/payment. paidAmount is treated as TOTAL paid for that month row.
router.put('/api/committee-collections/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { paidAmount, paymentMethod, notes } = req.body;

    const collection = await prisma.committeeCollection.findUnique({ where: { id } });
    if (!collection) return res.status(404).json({ error: 'Collection not found' });

    const totalPaid = Math.max(0, toNumber(paidAmount));
    const remainingAmount = Math.max(0, collection.installmentAmount - totalPaid);

    let status = 'PENDING';
    if (totalPaid >= collection.installmentAmount) status = 'PAID';
    else if (totalPaid > 0) status = 'PARTIAL';

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.committeeCollection.update({
        where: { id },
        data: {
          paidAmount: totalPaid,
          remainingAmount,
          status,
          paymentDate: totalPaid > 0 ? new Date() : null,
          paymentMethod: totalPaid > 0 ? (paymentMethod || 'CASH') : null,
          notes: notes || null
        }
      });

      await tx.committeeAuditLog.create({
        data: {
          committeeId: collection.committeeId,
          participantId: collection.participantId,
          action: 'PAYMENT_UPDATED',
          description: `Collection updated. Paid: Rs ${totalPaid}, Status: ${status}`
        }
      });

      return row;
    });

    return res.json(updated);
  } catch (err: any) {
    console.error('Update collection error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to update collection' });
  }
});

// 6. Draw winner randomly
router.post('/api/committees/:id/draw-winner', async (req, res) => {
  try {
    const committeeId = Number(req.params.id);
    const monthId = Number(req.body.monthId);

    const committee = await prisma.committee.findUnique({ where: { id: committeeId } });
    if (!committee) return res.status(404).json({ error: 'Committee not found' });
    if (!monthId) return res.status(400).json({ error: 'Month is required' });

    const existingWinner = await prisma.committeeWinner.findFirst({ where: { committeeId, monthId } });
    if (existingWinner) return res.status(400).json({ error: 'Winner already exists for this month' });

    const pastWinners = await prisma.committeeWinner.findMany({ where: { committeeId } });
    const pastWinnerIds = pastWinners.map(w => w.participantId);

    const eligibleParticipants = await prisma.committeeParticipant.findMany({
      where: {
        committeeId,
        status: 'ACTIVE',
        id: { notIn: pastWinnerIds }
      }
    });

    if (eligibleParticipants.length === 0) {
      return res.status(400).json({ error: 'No eligible participants left for a draw' });
    }

    const winnerParticipant = eligibleParticipants[Math.floor(Math.random() * eligibleParticipants.length)];

    const result = await prisma.$transaction(async (tx) => {
      const winner = await tx.committeeWinner.create({
        data: {
          committeeId,
          monthId,
          participantId: winnerParticipant.id,
          totalPool: committee.totalPool,
          notes: 'Random Draw'
        }
      });

      await tx.committeePayout.create({
        data: {
          committeeId,
          winnerId: winner.id,
          participantId: winnerParticipant.id,
          totalPoolAmount: committee.totalPool,
          deductions: 0,
          finalPayable: committee.totalPool,
          paidAmount: 0,
          status: 'PENDING'
        }
      });

      await tx.committeeAuditLog.create({
        data: {
          committeeId,
          participantId: winnerParticipant.id,
          action: 'DRAW_WINNER',
          description: `Random draw selected ${winnerParticipant.name}`
        }
      });

      return winner;
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Draw winner error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to draw winner' });
  }
});

// 7. Manual winner selection
router.post('/api/committees/:id/manual-winner', async (req, res) => {
  try {
    const committeeId = Number(req.params.id);
    const monthId = Number(req.body.monthId);
    const participantId = Number(req.body.participantId);
    const { notes } = req.body;

    const committee = await prisma.committee.findUnique({ where: { id: committeeId } });
    if (!committee) return res.status(404).json({ error: 'Committee not found' });
    if (!monthId) return res.status(400).json({ error: 'Month is required' });
    if (!participantId) return res.status(400).json({ error: 'Participant is required' });

    const existingWinner = await prisma.committeeWinner.findFirst({ where: { committeeId, monthId } });
    if (existingWinner) return res.status(400).json({ error: 'Winner already exists for this month' });

    const participant = await prisma.committeeParticipant.findUnique({ where: { id: participantId } });
    if (!participant) return res.status(404).json({ error: 'Participant not found' });

    const result = await prisma.$transaction(async (tx) => {
      const winner = await tx.committeeWinner.create({
        data: {
          committeeId,
          monthId,
          participantId,
          totalPool: committee.totalPool,
          notes: notes || 'Manual Selection'
        }
      });

      await tx.committeePayout.create({
        data: {
          committeeId,
          winnerId: winner.id,
          participantId,
          totalPoolAmount: committee.totalPool,
          deductions: 0,
          finalPayable: committee.totalPool,
          paidAmount: 0,
          status: 'PENDING'
        }
      });

      await tx.committeeAuditLog.create({
        data: {
          committeeId,
          participantId,
          action: 'MANUAL_WINNER',
          description: `Manually selected ${participant.name}`
        }
      });

      return winner;
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Manual winner error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to manually select winner' });
  }
});

// 8. Update payout
router.put('/api/committee-payouts/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { deductions, paidAmount, paymentMethod, proof, notes } = req.body;

    const payout = await prisma.committeePayout.findUnique({ where: { id } });
    if (!payout) return res.status(404).json({ error: 'Payout not found' });

    const numDeductions = Math.max(0, toNumber(deductions));
    const numPaid = Math.max(0, toNumber(paidAmount));
    const finalPayable = Math.max(0, payout.totalPoolAmount - numDeductions);

    let status = 'PENDING';
    if (numPaid >= finalPayable) status = 'PAID';
    else if (numPaid > 0) status = 'PARTIAL';

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.committeePayout.update({
        where: { id },
        data: {
          deductions: numDeductions,
          finalPayable,
          paidAmount: numPaid,
          paymentMethod: numPaid > 0 ? (paymentMethod || 'CASH') : null,
          payoutDate: numPaid > 0 ? new Date() : null,
          proof: proof || null,
          notes: notes || null,
          status
        }
      });

      await tx.committeeAuditLog.create({
        data: {
          committeeId: payout.committeeId,
          participantId: payout.participantId,
          action: 'PAYOUT_UPDATED',
          description: `Payout updated. Final Payable: Rs ${finalPayable}, Paid: Rs ${numPaid}`
        }
      });

      return row;
    });

    return res.json(updated);
  } catch (err: any) {
    console.error('Update payout error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to update payout' });
  }
});

// 9. Summary
router.get('/api/committees/:id/summary', async (req, res) => {
  try {
    const committeeId = Number(req.params.id);
    const committee = await prisma.committee.findUnique({ where: { id: committeeId } });
    if (!committee) return res.status(404).json({ error: 'Committee not found' });

    const currentMonth = await prisma.committeeMonth.findFirst({
      where: { committeeId, status: 'PENDING' },
      orderBy: { startDate: 'asc' },
      include: {
        collections: true,
        winners: { include: { participant: true, payout: true } }
      }
    });

    const totalCollected = currentMonth?.collections.reduce((sum, c) => sum + c.paidAmount, 0) || 0;
    const totalPending = currentMonth?.collections.reduce((sum, c) => sum + c.remainingAmount, 0) || 0;
    const paidParticipants = currentMonth?.collections.filter(c => c.status === 'PAID').length || 0;
    const partialParticipants = currentMonth?.collections.filter(c => c.status === 'PARTIAL').length || 0;
    const pendingParticipants = currentMonth?.collections.filter(c => c.status === 'PENDING').length || 0;

    return res.json({
      committee,
      currentMonth,
      totalCollected,
      totalPending,
      paidParticipants,
      partialParticipants,
      pendingParticipants,
      winner: currentMonth?.winners?.[0] || null
    });
  } catch (err) {
    console.error('Summary error:', err);
    return res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

export default router;
