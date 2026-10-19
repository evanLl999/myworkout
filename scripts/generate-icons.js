const { Jimp } = require('jimp');

async function makeIcon(size) {
  const img = new Jimp({ width: size, height: size, color: 0x181715FF });
  const cx = size / 2;
  const cy = size / 2;

  // 米白哑铃
  const barW = Math.floor(size * 0.045);   // 细握把
  const headR = Math.floor(size * 0.095);  // 铃片半径
  const headDist = Math.floor(size * 0.18); // 铃片中心距

  // 左铃片
  drawCircle(img, cx - headDist, cy, headR, 0xFFFCF7FF);
  // 右铃片
  drawCircle(img, cx + headDist, cy, headR, 0xFFFCF7FF);

  // 铃片内圈（焦橙）
  const innerR = Math.floor(headR * 0.62);
  drawCircle(img, cx - headDist, cy, innerR, 0xC9451BFF);
  drawCircle(img, cx + headDist, cy, innerR, 0xC9451BFF);

  // 握把
  for (let x = cx - headDist + headR * 0.6; x < cx + headDist - headR * 0.6; x++) {
    for (let y = cy - barW; y < cy + barW; y++) {
      if (x >= 0 && x < size && y >= 0 && y < size) {
        img.setPixelColor(0xFFFCF7FF, x, y);
      }
    }
  }

  // 圆角处理（简单：四角画圆遮罩）
  const r = Math.floor(size * 0.21);
  for (let y = 0; y < r; y++) {
    for (let x = 0; x < r; x++) {
      if ((x - r) ** 2 + (y - r) ** 2 > r ** 2) {
        img.setPixelColor(0x00000000, x, y); // 左上
        img.setPixelColor(0x00000000, size - 1 - x, y); // 右上
        img.setPixelColor(0x00000000, x, size - 1 - y); // 左下
        img.setPixelColor(0x00000000, size - 1 - x, size - 1 - y); // 右下
      }
    }
  }

  await img.write(`public/icon-${size}.png`);
  console.log(`Created icon-${size}.png`);
}

function drawCircle(img, cx, cy, r, color) {
  for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(img.bitmap.height, Math.ceil(cy + r)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(img.bitmap.width, Math.ceil(cx + r)); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r ** 2) {
        img.setPixelColor(color, x, y);
      }
    }
  }
}

makeIcon(192).then(() => makeIcon(512)).catch(console.error);
