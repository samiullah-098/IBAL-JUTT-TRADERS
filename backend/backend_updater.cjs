const fs = require('fs');

let content = fs.readFileSync('index.ts', 'utf8');

// Find the start and end of the Advanced Purchases APIs block
const startMarker = '// -- Advanced Purchases APIs --';
const endMarker = '// -- Advanced Sales / POS APIs --';

const startIndex1 = content.indexOf(startMarker);
const endIndex1 = content.indexOf(endMarker);

// There's a second start marker further down!
const startIndex2 = content.indexOf(startMarker, endIndex1);
const endMarker2 = '// -- Advanced Party Khata APIs --';
const endIndex2 = content.indexOf(endMarker2, startIndex2);

// First let's remove the second block completely
if (startIndex2 !== -1 && endIndex2 !== -1) {
  content = content.substring(0, startIndex2) + content.substring(endIndex2);
}

// Now replace the first block with our new unified implementation
const newImplementation = `// -- Advanced Purchases APIs --

app.get('/api/purchases', async (req, res) => {
  try {
    const { search } = req.query;
    let whereClause: any = {};
    if (search) {
      const searchStr = String(search);
      whereClause.OR = [
        { billNumber: { contains: searchStr } },
        { truckNumber: { contains: searchStr } },
        { party: { name: { contains: searchStr } } }
      ];
    }
    const purchases = await prisma.purchase.findMany({
      where: whereClause,
      include: { party: true, items: { include: { inventoryItem: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(purchases);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

app.post('/api/purchases', async (req, res) => {
  try {
    const { 
      billNumber, partyId, newSupplier, purchaseDate, status, truckNumber, 
      driverPhone, amountPaid, notes, items,
      paymentMethod, paymentStatus, discountType, totalDiscount, billImage
    } = req.body;
    
    const parsedTotalDiscount = parseFloat(totalDiscount) || 0;
    const parsedAmountPaid = parseFloat(amountPaid) || 0;

    // Calculate gross amount from items
    const grossTotal = items.reduce((acc: number, item: any) => acc + (parseFloat(item.quantity) * parseFloat(item.rate)), 0);
    const netTotalAmount = grossTotal - parsedTotalDiscount;
    const balanceDue = netTotalAmount - parsedAmountPaid;

    const result = await prisma.$transaction(async (tx) => {
      let finalPartyId = Number(partyId);

      if (newSupplier) {
        const openingBalance = parseFloat(newSupplier.openingBalance) || 0;
        const party = await tx.party.create({
          data: {
            name: newSupplier.name,
            type: 'SELLER',
            phone: newSupplier.phone || null,
            shopName: newSupplier.shopName || null,
            city: newSupplier.city || null,
            address: newSupplier.address || null,
            openingBalance: openingBalance,
            outstanding: openingBalance,
            status: 'ACTIVE'
          }
        });
        
        if (openingBalance !== 0) {
          await tx.transaction.create({
            data: {
              partyId: party.id,
              type: 'OPENING_BALANCE',
              amount: Math.abs(openingBalance),
              description: 'Account Opening Balance',
              date: new Date()
            }
          });
        }
        finalPartyId = party.id;
      }

      let processedItems = [];
      for (const item of items) {
        if (item.isNewItem && item.newItemDetails) {
          const newInvItem = await tx.inventoryItem.create({
            data: {
              category: item.newItemDetails.category || 'Yarn',
              variant: item.newItemDetails.variant,
              notes: item.newItemDetails.notes || '',
              sellingPrice: parseFloat(item.newItemDetails.sellingPrice) || 0,
              sellingMargin: parseFloat(item.newItemDetails.sellingMargin) || 0,
              purchaseRate: parseFloat(item.rate) || 0,
              unit: item.unit || 'Kg',
              quantity: 0
            }
          });
          processedItems.push({
            ...item,
            inventoryItemId: newInvItem.id
          });
        } else {
          processedItems.push(item);
        }
      }

      const newPurchase = await tx.purchase.create({
        data: {
          billNumber,
          partyId: finalPartyId,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
          status: status || 'RECEIVED',
          truckNumber,
          driverPhone,
          totalAmount: netTotalAmount, // store net amount after discount
          amountPaid: parsedAmountPaid,
          balanceDue,
          notes,
          paymentMethod: paymentMethod || null,
          paymentStatus: paymentStatus || null,
          discountType: discountType || null,
          totalDiscount: parsedTotalDiscount,
          billImage: billImage || null,
          items: {
            create: processedItems.map((item: any) => ({
              inventoryItemId: Number(item.inventoryItemId),
              bags: item.bags ? parseFloat(item.bags) : null,
              weightPerUnit: item.weightPerBag ? parseFloat(item.weightPerBag) : null,
              unit: item.unit || null,
              note: item.note || null,
              quantity: parseFloat(item.quantity),
              rate: parseFloat(item.rate),
              total: parseFloat(item.quantity) * parseFloat(item.rate),
              itemDiscount: parseFloat(item.itemDiscount) || 0,
              expectedProfit: parseFloat(item.expectedProfit) || 0
            }))
          }
        },
        include: { items: true, party: true }
      });

      for (const item of processedItems) {
        await tx.inventoryItem.update({
          where: { id: Number(item.inventoryItemId) },
          data: { 
            quantity: { increment: parseFloat(item.quantity) },
            purchaseRate: parseFloat(item.rate) // update purchase rate to latest
          }
        });
      }

      // Record transaction and update Khata
      if (netTotalAmount > 0) {
        await tx.party.update({
          where: { id: finalPartyId },
          data: { outstanding: { increment: netTotalAmount } }
        });
        
        await tx.transaction.create({
          data: {
            partyId: finalPartyId,
            type: 'PURCHASE',
            amount: netTotalAmount,
            description: \`Purchase Bill \${billNumber}\`,
            date: purchaseDate ? new Date(purchaseDate) : new Date()
          }
        });
      }

      if (parsedAmountPaid > 0) {
        await tx.transaction.create({
          data: {
            partyId: finalPartyId,
            type: 'PAYMENT_OUT',
            amount: parsedAmountPaid,
            paymentMethod: paymentMethod || 'CASH',
            description: \`Payment for Purchase \${billNumber}\`,
            date: purchaseDate ? new Date(purchaseDate) : new Date()
          }
        });

        await tx.party.update({
          where: { id: finalPartyId },
          data: { outstanding: { decrement: parsedAmountPaid } }
        });
      }

      return newPurchase;
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create purchase' });
  }
});

app.delete('/api/purchases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { id: Number(id) },
        include: { items: true }
      });
      if (!purchase) throw new Error('Purchase not found');
      
      // Revert Inventory
      for (const item of purchase.items) {
        await tx.inventoryItem.update({
          where: { id: item.inventoryItemId },
          data: { quantity: { decrement: item.quantity } }
        });
      }
      
      // Revert Party Khata for the total amount
      await tx.party.update({
        where: { id: purchase.partyId },
        data: { outstanding: { decrement: purchase.totalAmount } }
      });

      // Revert Payment
      if (purchase.amountPaid > 0) {
        await tx.party.update({
          where: { id: purchase.partyId },
          data: { outstanding: { increment: purchase.amountPaid } }
        });
      }
      
      // We log a PAYMENT_IN to reverse the PURCHASE (if we don't delete the transaction)
      // Actually, deleting the transactions is cleaner, but the current DB doesn't link them explicitly.
      // So we will just create reversal transactions.
      
      await tx.transaction.create({
         data: {
           partyId: purchase.partyId,
           type: 'PAYMENT_IN',
           amount: purchase.balanceDue, // We are reversing the balance due
           description: \`Reversal of Deleted Bill \${purchase.billNumber}\`,
           date: new Date()
         }
      });
      
      await tx.purchase.delete({ where: { id: Number(id) } });
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete purchase' });
  }
});

`;

content = content.substring(0, startIndex1) + newImplementation + content.substring(endIndex1);

fs.writeFileSync('index.ts', content, 'utf8');
console.log('Update successful');
