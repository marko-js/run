# Loading

```html
report=report.2024.pdf
```

# Step 0
ctx=>staticFileWins(ctx)

# Step 1
ctx=>staticFileWinsForHead(ctx)

# Step 2
ctx=>extensionlessStaticFileServes(ctx)

# Step 3
ctx=>dottedPathRoutes(ctx)

# Step 4
ctx=>postSkipsTheStaticFile(ctx)

# Step 5
ctx=>unmatchedPathRendersThe404Page(ctx)

