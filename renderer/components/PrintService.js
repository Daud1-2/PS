export async function printReceipt(receipt) {
  if (!receipt) {
    throw new Error('No receipt available to print.');
  }

  return window.posAPI.printReceipt(receipt);
}

export async function printLastReceipt(receipt) {
  return printReceipt(receipt);
}
