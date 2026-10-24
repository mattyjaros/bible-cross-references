import { CARD_HEIGHT, CARD_WIDTH, paintVerseCard, type VerseCardInput } from './verse-card.ts';

/**
 * The card as a PNG, ready to hand to the system share sheet.
 *
 * Only the canvas and the encoding live here; what is drawn is `paintVerseCard`, which is tested.
 * The fonts are awaited first — a card drawn before the serif has loaded is set in Times, and
 * nobody looks at the same verse twice to find out it looks better now.
 */
export async function renderVerseCard(input: VerseCardInput): Promise<Blob> {
  await document.fonts.ready;

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('A canvas is needed to draw the card.');
  }

  paintVerseCard(context, input);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('The card could not be encoded.'));
      }
    }, 'image/png');
  });
}
