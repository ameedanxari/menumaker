const fs = require('fs');
const path = require('path');

const tokens = JSON.parse(fs.readFileSync('src/design-tokens.json', 'utf8'));

// Generate CSS variables
let cssContent = ':root {\n';
for (const [key, value] of Object.entries(tokens.colors)) {
  if (typeof value === 'object') {
    for (const [shade, color] of Object.entries(value)) {
      cssContent += `  --color-${key}-${shade}: ${color};\n`;
    }
  } else {
    cssContent += `  --color-${key}: ${value};\n`;
  }
}
cssContent += '}\n';

fs.writeFileSync('src/styles/tokens.css', cssContent);

// Generate Tailwind tokens
const tailwindTokens = {
  theme: {
    extend: {
      colors: tokens.colors,
      borderRadius: tokens.borderRadius,
      spacing: tokens.spacing,
    }
  }
};

fs.writeFileSync('tailwind-tokens.cjs', `module.exports = ${JSON.stringify(tailwindTokens, null, 2)};`);
