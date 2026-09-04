export const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;
export const gbpShort = (pence: number) => (pence % 100 === 0 ? `£${pence / 100}` : gbp(pence));
export const toPence = (pounds: number) => Math.round(pounds * 100);
