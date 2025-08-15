// Test the original broken Gist content with our fixed plugin
const fs = require('fs');

// Read the original content
const originalContent = fs.readFileSync('original-gist-content.md', 'utf8');

console.log('📋 ORIGINAL GIST CONTENT ANALYSIS:');
console.log('='.repeat(50));

// Check for Mermaid blocks
const mermaidBlocks = originalContent.match(/```\s*[\s\S]*?flowchart|graph[\s\S]*?```/g);
console.log(`🔍 Found ${mermaidBlocks ? mermaidBlocks.length : 0} potential Mermaid blocks`);

if (mermaidBlocks) {
    mermaidBlocks.forEach((block, index) => {
        console.log(`\n📊 Mermaid Block ${index + 1}:`);
        console.log('Current format:', block.substring(0, 20) + '...');
        
        // Check if it has proper mermaid identifier
        if (block.startsWith('```mermaid')) {
            console.log('✅ Properly tagged for GitHub rendering');
        } else if (block.startsWith('```')) {
            console.log('❌ Missing mermaid language identifier');
            console.log('Should be: ```mermaid instead of ```');
        }
    });
}

// Create corrected version
let correctedContent = originalContent;

// Fix: Replace generic ``` with ```mermaid for flowchart/graph blocks
correctedContent = correctedContent.replace(
    /```\s*\n((?:flowchart|graph)[\s\S]*?)```/g,
    '```mermaid\n$1```'
);

console.log('\n🔧 CORRECTED VERSION:');
console.log('='.repeat(50));

// Save corrected version
fs.writeFileSync('original-content-corrected.md', correctedContent);

console.log('✅ Corrected version saved to original-content-corrected.md');
console.log('\n📊 CHANGES MADE:');
console.log('- Added "mermaid" language identifier to all flowchart/graph blocks');
console.log('- This enables GitHub Gist native Mermaid rendering');

// Count corrected blocks
const correctedMermaidBlocks = correctedContent.match(/```mermaid[\s\S]*?```/g);
console.log(`🎯 Result: ${correctedMermaidBlocks ? correctedMermaidBlocks.length : 0} properly tagged Mermaid blocks`);