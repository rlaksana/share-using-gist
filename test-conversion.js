// Simple test script to validate the conversion logic
const fs = require('fs');

// Read the test content
const testContent = fs.readFileSync('./test-content.md', 'utf-8');

console.log('=== ORIGINAL CONTENT ===');
console.log(testContent);
console.log('\n=== TESTING GITHUB NATIVE MODE ===');

// Simulate GitHub Native mode processing
let processedContent = testContent;

// In GitHub Native mode, these should be PRESERVED:
console.log('\n✅ Elements that should be PRESERVED in GitHub Native mode:');
console.log('- Mermaid diagrams (```mermaid)');
console.log('- Math expressions ($...$ and $$...$$)');
console.log('- GitHub Alerts (> [!NOTE], > [!WARNING], > [!TIP])');

// These should be CONVERTED:
console.log('\n🔄 Elements that should be CONVERTED:');

// 1. Wikilinks conversion
const wikilinkMatches = processedContent.match(/\[\[([^\]]+)\]\]/g);
if (wikilinkMatches) {
    console.log(`- Found ${wikilinkMatches.length} wikilinks to convert:`, wikilinkMatches);
}

// 2. Tags conversion  
const tagMatches = processedContent.match(/#[\w\-\/]+/g);
if (tagMatches) {
    console.log(`- Found ${tagMatches.length} tags to convert:`, tagMatches);
}

// 3. Comments conversion
const commentMatches = processedContent.match(/%%[\s\S]*?%%/g);
if (commentMatches) {
    console.log(`- Found ${commentMatches.length} comments to convert:`, commentMatches);
}

// 4. Dataview conversion
const dataviewMatches = processedContent.match(/```dataview\n([\s\S]*?)\n```/g);
if (dataviewMatches) {
    console.log(`- Found ${dataviewMatches.length} dataview queries to convert:`, dataviewMatches);
}

console.log('\n=== CONVERSION SIMULATION ===');

// Simulate basic conversions that would happen in GitHub Native mode
// 1. Convert wikilinks
processedContent = processedContent.replace(/\[\[([^\|\]]+)\|([^\]]+)\]\]/g, '[$2]($1.md)');
processedContent = processedContent.replace(/\[\[([^\]]+)\]\]/g, '[$1]($1.md)');

// 2. Convert comments to HTML comments
processedContent = processedContent.replace(/%%([^%]+)%%/g, '<!-- $1 -->');

// 3. Preserve tags (GitHub Native mode)
console.log('Tags preserved as-is for GitHub compatibility');

// 4. Convert dataview
processedContent = processedContent.replace(/```dataview\n([\s\S]*?)\n```/g, 
    '**📈 Dataview Query:**\n\n*This was a dynamic query that would have displayed data from your vault:*\n\n```sql\n$1\n```');

console.log('\n=== PROCESSED CONTENT (GitHub Native Mode) ===');
console.log(processedContent);

// Write processed content for Gist creation
fs.writeFileSync('./processed-content.md', processedContent);
console.log('\n✅ Processed content saved to processed-content.md');