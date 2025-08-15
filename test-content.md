# Test File untuk Share Using Gist

## Testing GitHub Native Features

### 1. Mermaid Diagram (Should be preserved for GitHub native rendering)
```mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Fix it]
    D --> A
```

### 2. Math Expressions (Should be preserved for GitHub native rendering)
Inline math: $E = mc^2$

Block math:
$$
\sum_{i=1}^{n} x_i = \frac{n(n+1)}{2}
$$

### 3. GitHub Alerts/Callouts (Should be preserved for GitHub native rendering)
> [!NOTE]
> This is a note that GitHub Gist supports natively since November 2023.

> [!WARNING]
> This warning should work natively in GitHub Gist.

> [!TIP]
> GitHub native alerts are better than converted blockquotes.

### 4. Obsidian-Specific Elements (Should be converted)

#### Wikilinks
Link to [[Another Note]] and [[File with Spaces|Custom Text]].

#### Tags
This note has tags: #important #test #obsidian-plugin

#### Comments
%%This is an internal comment that should be converted to HTML comment%%

#### Dataview Query
```dataview
TABLE file.mtime as "Modified"
FROM #test
SORT file.mtime DESC
```

### 5. Regular Markdown (Should remain unchanged)
- Regular **bold** and *italic*
- [External link](https://github.com)
- `inline code`

```javascript
// Regular code block
console.log("Hello World!");
```