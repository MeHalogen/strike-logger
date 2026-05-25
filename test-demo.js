// Demo file with intentional bug
function calculateTotal(items) {
  let total = 0;
  for (let item of items) {
    total += item.price; // Bug: accessing .price without checking if it exists
  }
  return total;
}

module.exports = { calculateTotal };
