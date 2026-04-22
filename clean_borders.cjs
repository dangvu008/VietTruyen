const fs = require('fs');
const path = require('path');

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx') && !file.includes('WriterPage.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
};

const componentsPath = path.join(__dirname, 'src', 'components');
const files = walk(componentsPath);
let changedCount = 0;

files.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replace standard 1px borders with tonal shifts
  content = content.replace(/border border-border-subtle/g, 'bg-surface-container-low');
  content = content.replace(/border-b border-border-subtle/g, 'pb-4 mb-4'); // usually section dividers
  content = content.replace(/border-t border-border-subtle/g, 'pt-4 mt-4');
  content = content.replace(/divide-y divide-border-subtle/g, 'space-y-4');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changedCount++;
    console.log(`Updated borders in: ${path.relative(__dirname, file)}`);
  }
});

console.log(`Finished processing. Changed ${changedCount} files.`);
