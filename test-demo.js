// Demo file - now fixed
function calculateTotal(items) {
  let total = 0;
  for (let item of items) {
    // FIX: Added null check before accessing price
    if (item && typeof item.price === 'number') {
      total += item.price;
    }
  }
  return total;
}

module.exports = { calculateTotal };
