// Debug test untuk Mermaid auto-fix
const fs = require('fs');

const testContent = fs.readFileSync('debug-test.md', 'utf8');

console.log('🔍 ORIGINAL CONTENT:');
console.log(testContent);
console.log('\n' + '='.repeat(50) + '\n');

// Simulasi fungsi auto-fix dari plugin
function debugMermaidFix(content) {
    const improperMermaidRegex = /```\s*\n((?:flowchart|graph)[\s\S]*?)\n```/g;
    let result = content;
    let fixCount = 0;
    let match;
    
    console.log('🔍 SEARCHING FOR BROKEN MERMAID...');
    
    // Reset regex
    improperMermaidRegex.lastIndex = 0;
    
    while ((match = improperMermaidRegex.exec(content)) !== null) {
        const originalText = match[0];
        const diagramContent = match[1];
        const fixedText = `\`\`\`mermaid\n${diagramContent}\n\`\`\``;
        
        console.log(`\n🔧 FOUND MATCH #${fixCount + 1}:`);
        console.log('Original:', JSON.stringify(originalText));
        console.log('Diagram content:', JSON.stringify(diagramContent));
        console.log('Fixed to:', JSON.stringify(fixedText));
        
        result = result.replace(originalText, fixedText);
        fixCount++;
    }
    
    console.log(`\n✅ TOTAL FIXES: ${fixCount}`);
    return { result, fixCount };
}

const { result, fixCount } = debugMermaidFix(testContent);

console.log('🎯 FIXED CONTENT:');
console.log(result);

// Save hasil
fs.writeFileSync('debug-fixed.md', result);

console.log(`\n📊 SUMMARY:`);
console.log(`- Fixes applied: ${fixCount}`);
console.log(`- Result saved to: debug-fixed.md`);
console.log(`\n${fixCount > 0 ? '✅ AUTO-FIX WORKING' : '❌ NO FIXES APPLIED'}`);