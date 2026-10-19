# Loading

```html
<main>
  <p>
    layout one
  </p>
  <p>
    page content
  </p>
</main>
```

# Step 0
ctx=>changeServerLabel(ctx,"second")

# Step 1
ctx=>editLayoutWithoutRestart(ctx)

# Step 2
ctx=>editViteConfig(ctx)

# Step 3
ctx=>changeServerLabel(ctx,"third")

# Step 4
ctx=>restoreAndSettle(ctx)

