import { translate } from '@vitalets/google-translate-api';
import fs from 'fs';
import path from 'path';

async function main() {
  const strings = JSON.parse(fs.readFileSync('chinese_strings.json', 'utf8'));
  const dict = {};
  
  console.log(`Translating ${strings.length} strings...`);
  
  for (let i = 0; i < strings.length; i++) {
    const text = strings[i];
    try {
      const { text: translated } = await translate(text, { to: 'vi' });
      dict[text] = translated;
      console.log(`[${i+1}/${strings.length}] ${text} -> ${translated}`);
    } catch (e) {
      console.error(`Error translating ${text}:`, e.message);
      dict[text] = text; // fallback
    }
  }
  
  fs.writeFileSync('chinese_to_vi.json', JSON.stringify(dict, null, 2));
  
  // Now replace in files
  const dir = './src/data/story_templates';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    
    for (const [cn, vi] of Object.entries(dict)) {
      if (content.includes(cn) && cn !== vi) {
        content = content.replaceAll(cn, vi);
        changed = true;
      }
    }
    
    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${file}`);
    }
  }
  
  console.log('Done.');
}

main().catch(console.error);
