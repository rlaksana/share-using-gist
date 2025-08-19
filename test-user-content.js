const fs = require('fs');

console.log('🔍 TESTING USER EXACT CONTENT');
const content = fs.readFileSync('user-test.md', 'utf8');

console.log('Original content length:', content.length);
console.log('\nFirst 200 chars:');
console.log(JSON.stringify(content.substring(0, 200)));

// Exact regex dari plugin main.ts line 573
const improperMermaidRegex = /```\s*\n((?:flowchart|graph)[\s\S]*?)\n```/g;
let matches = [];
let match;

console.log('\n🔍 TESTING REGEX MATCHES...');
improperMermaidRegex.lastIndex = 0; // Reset

while ((match = improperMermaidRegex.exec(content)) !== null) {
    matches.push({
        full: match[0],
        content: match[1],
        index: match.index
    });
    console.log(`\nMatch ${matches.length}:`);
    console.log('  Position:', match.index);
    console.log('  Full match (first 50 chars):', JSON.stringify(match[0].substring(0, 50)));
    console.log('  Content type:', match[1].trim().split('\n')[0]);
}

console.log(`\n📊 SUMMARY: ${matches.length} matches found`);

if (matches.length > 0) {
    console.log('\n🔧 APPLYING FIXES...');
    let result = content;
    
    // Apply fixes in reverse order to avoid index shifting
    matches.reverse().forEach((m, i) => {
        const fixed = `\`\`\`mermaid\n${m.content}\n\`\`\``;
        console.log(`Fix ${matches.length - i}: Replacing at position ${m.index}`);
        result = result.substring(0, m.index) + fixed + result.substring(m.index + m.full.length);
    });
    
    fs.writeFileSync('user-test-fixed.md', result);
    console.log('\n✅ Fixed content saved to user-test-fixed.md');
    
    // Show difference
    const originalMermaidBlocks = (content.match(/```\s*\n(?:flowchart|graph)/g) || []).length;
    const fixedMermaidBlocks = (result.match(/```mermaid\s*\n(?:flowchart|graph)/g) || []).length;
    
    console.log('\n📈 BEFORE/AFTER:');
    console.log(`  Broken mermaid blocks: ${originalMermaidBlocks}`);
    console.log(`  Fixed mermaid blocks: ${fixedMermaidBlocks}`);
    console.log(`  ✅ Should show interactive diagrams: ${fixedMermaidBlocks > 0 ? 'YES' : 'NO'}`);
    
} else {
    console.log('\n❌ NO MATCHES FOUND');
    console.log('This means the regex is not catching the broken mermaid blocks');
    
    // Debug: show what we actually have
    const allCodeBlocks = content.match(/```[\s\S]*?```/g) || [];
    console.log(`\nDEBUG: Found ${allCodeBlocks.length} total code blocks:`);
    allCodeBlocks.forEach((block, i) => {
        const firstLine = block.split('\n')[0];
        console.log(`  ${i+1}: ${firstLine}`);
    });
}