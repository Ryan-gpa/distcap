const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { Packer } = require('docx');
const { buildDocument } = require('./build2.js');

// Parse CLI args
const args = process.argv.slice(2);
let inputPath = null;
let outputPath = null;
let isTemplate = false;
let highlightFilled = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--input' || args[i] === '-i') {
    inputPath = args[i + 1];
    i++;
  } else if (args[i] === '--output' || args[i] === '-o') {
    outputPath = args[i + 1];
    i++;
  } else if (args[i] === '--template' || args[i] === '-t') {
    isTemplate = true;
  } else if (args[i] === '--highlight' || args[i] === '-hl') {
    highlightFilled = true;
  }
}

if (isTemplate) {
  if (!outputPath) {
    outputPath = 'DistCap_Proposal_Template.docx';
  }
} else {
  if (!inputPath || !outputPath) {
    console.error('Usage: node generate_cli.js --input <path_to_json> --output <path_to_docx> [--template] [--highlight]');
    process.exit(1);
  }
}

let answers = {};
if (!isTemplate) {
  try {
    const jsonStr = fs.readFileSync(inputPath, 'utf8');
    answers = JSON.parse(jsonStr);
    if (highlightFilled) {
      answers.highlight_filled = 'true';
    }
  } catch (err) {
    console.error(`Error reading input JSON: ${err.message}`);
    process.exit(1);
  }
}

console.log(`Generating document (isTemplate = ${isTemplate})...`);
const doc = buildDocument(answers, { isTemplate });

Packer.toBuffer(doc).then(buf => {
  try {
    fs.writeFileSync(outputPath, buf);
    console.log(`Saved temporary document to ${outputPath} (${buf.length} bytes)`);
    
    // Spawn Python validator script
    console.log('Running validation gate and bug patches...');
    const pythonCmd = 'python';
    const pyArgs = [path.join(__dirname, 'patch_and_validate.py'), outputPath];
    if (isTemplate) {
      pyArgs.push('--template');
    }
    
    const pyRun = spawnSync(pythonCmd, pyArgs, { encoding: 'utf8' });
    console.log(pyRun.stdout);
    
    if (pyRun.status !== 0) {
      console.error('Validation / Patching failed:');
      console.error(pyRun.stderr);
      // Clean up failed output document
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      process.exit(1);
    }
    
    console.log(`SUCCESS! Document ready at: ${outputPath}`);
  } catch (err) {
    console.error(`Error writing / processing output document: ${err.message}`);
    process.exit(1);
  }
});
